// Deep Search Pipeline — Quality path that mines repo contributors
// Takes 5-15 seconds but finds actual unicorns
// Algorithm: Get seed repos → mine contributors → enrich → score → rank

import { getGitHubClient } from "@/lib/github/client";
import { getCategoryById } from "@/lib/search/seedRepos";
import { calculateScore, type ScoringInput } from "@/lib/scoring/engine";

const MAX_CONTRIBUTORS = 200;
const MAX_REPOS_TO_SCAN = 15;
const MAX_ENRICHED = 50;

// Timeout helper — prevents infinite hangs
function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const {
    roleCategory = "frontend",
    language,
    location,
    minStars,
    activeInDays = 90,
    maxResults = 50,
  } = body;

  const client = getGitHubClient();
  const category = getCategoryById(roleCategory);
  if (!category) {
    return Response.json({ error: `Unknown role category: ${roleCategory}` }, { status: 400 });
  }

  // ─── Step 1: Gather seed repos + trending repos ───
  const seedRepos = [...category.seedRepos].sort((a, b) => b.weight - a.weight);

  // Also find trending high-star repos for the primary language
  const primaryLang = language || category.languages[0];
  const ninetyDaysAgo = new Date(Date.now() - activeInDays * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  let trendingRepos: { owner: string; name: string; weight: number }[] = [];

  try {
    const trendingResult = await client.searchRepos(
      `language:${primaryLang} stars:>500 pushed:>${ninetyDaysAgo}`,
      "stars",
      20
    );
    trendingRepos = (trendingResult.items || []).map(
      (r: { owner: { login: string }; name: string }) => ({
        owner: r.owner.login,
        name: r.name,
        weight: 1,
      })
    );
  } catch {
    // Non-fatal
  }

  // Merge and deduplicate
  const allRepos = [...seedRepos];
  const seen = new Set(seedRepos.map((r) => `${r.owner}/${r.name}`));
  for (const r of trendingRepos) {
    const key = `${r.owner}/${r.name}`;
    if (!seen.has(key)) {
      allRepos.push(r);
      seen.add(key);
    }
  }

  // ─── Step 2: Mine contributors from repos ───
  const contributorMap = new Map<
    string,
    {
      login: string;
      avatarUrl: string;
      repos: Array<{ repo: string; weight: number; commits: number }>;
      totalCommits: number;
      rawRelevance: number;
    }
  >();

  let reposScanned = 0;
  for (const repo of allRepos) {
    if (contributorMap.size >= MAX_CONTRIBUTORS || reposScanned >= MAX_REPOS_TO_SCAN) break;

    try {
      const contributors = await client.getRepoContributors(repo.owner, repo.name, 30);
      if (!Array.isArray(contributors)) continue;

      for (const c of contributors) {
        if (!c.login || c.type === "Bot") continue;
        const existing = contributorMap.get(c.login) || {
          login: c.login,
          avatarUrl: c.avatar_url || "",
          repos: [] as Array<{ repo: string; weight: number; commits: number }>,
          totalCommits: 0,
          rawRelevance: 0,
        };

        existing.repos.push({
          repo: `${repo.owner}/${repo.name}`,
          weight: repo.weight,
          commits: c.contributions || 0,
        });
        existing.totalCommits += c.contributions || 0;

        // Raw relevance: repos count × weight + commits
        existing.rawRelevance =
          existing.repos.length * 10 +
          existing.repos.reduce((s, r) => s + r.weight * 5, 0) +
          Math.log(1 + existing.totalCommits) * 3;

        contributorMap.set(c.login, existing);
      }
      reposScanned++;
    } catch {
      continue;
    }
  }

  // ─── Step 3: Rank by raw relevance, take top N ───
  const ranked = Array.from(contributorMap.values())
    .sort((a, b) => b.rawRelevance - a.rawRelevance)
    .slice(0, 100); // Top 100 for enrichment

  // ─── Step 4: Fetch full profiles ───
  const enriched: Array<{
    profile: Record<string, unknown>;
    seedContribs: Array<{ repo: string; weight: number; commits: number }>;
  }> = [];

  // Process in batches of 10
  for (let i = 0; i < ranked.length && enriched.length < MAX_ENRICHED; i += 10) {
    const batch = ranked.slice(i, i + 10);
    const profiles = await Promise.all(
      batch.map(async (c) => {
        const user = await client.getUser(c.login);
        if (!user) return null;

        // Location filter (fuzzy)
        if (location) {
          const userLoc = (user.location || "").toLowerCase();
          const searchLoc = location.toLowerCase();
          if (!userLoc.includes(searchLoc) && !searchLoc.includes(userLoc)) {
            // Try common aliases
            const locOk =
              (searchLoc === "sf" && userLoc.includes("san francisco")) ||
              (searchLoc === "nyc" && userLoc.includes("new york")) ||
              (searchLoc === "la" && userLoc.includes("los angeles")) ||
              (searchLoc.includes("bay area") && (userLoc.includes("san francisco") || userLoc.includes("palo alto") || userLoc.includes("mountain view")));
            if (!locOk) return null;
          }
        }

        return { profile: user, seedContribs: c.repos };
      })
    );

    for (const p of profiles) {
      if (p) enriched.push(p);
    }
  }

  // ─── Step 5: Enrich with GraphQL + score ───
  const developers = await Promise.all(
    enriched.slice(0, maxResults).map(async ({ profile, seedContribs }) => {
      const username = profile.login as string;

      // GraphQL enrichment (5s timeout each to prevent hangs)
      const gqlData = await withTimeout(client.getEnrichedProfile(username), 5000, null);
      const externalPRs = await withTimeout(client.getExternalMergedPRs(username), 5000, 0);

      // Extract contribution data
      const cc = (gqlData as Record<string, unknown>)?.contributionsCollection as Record<string, unknown> | undefined;
      const calendar = cc?.contributionCalendar as Record<string, unknown> | undefined;
      const weeks = (calendar?.weeks || []) as Array<{ contributionDays: Array<{ contributionCount: number; date: string }> }>;
      const contributionDays = weeks.flatMap((w) => w.contributionDays.map((d) => ({ date: d.date, count: d.contributionCount })));

      // Extract repos from GraphQL
      const gqlRepos = ((gqlData as Record<string, unknown>)?.repositories as Record<string, unknown>)?.nodes as Array<Record<string, unknown>> || [];
      const repos = gqlRepos.map((r) => ({
        name: r.name as string,
        stars: (r.stargazerCount as number) || 0,
        forks: (r.forkCount as number) || 0,
        language: ((r.primaryLanguage as Record<string, unknown>)?.name as string) || "",
        isFork: (r.isFork as boolean) || false,
        updatedAt: (r.updatedAt as string) || "",
        description: (r.description as string) || "",
      }));

      // Extract orgs
      const gqlOrgs = ((gqlData as Record<string, unknown>)?.organizations as Record<string, unknown>)?.nodes as Array<Record<string, unknown>> || [];
      const organizations = gqlOrgs.map((o) => (o.login as string) || "");

      // Build scoring input
      const scoringInput: ScoringInput = {
        followers: (profile.followers as number) || 0,
        following: (profile.following as number) || 0,
        publicRepos: (profile.public_repos as number) || 0,
        accountCreatedAt: (profile.created_at as string) || "",
        hireable: !!(profile.hireable),
        bio: (profile.bio as string) || "",
        repos,
        totalContributions: (calendar?.totalContributions as number) || 0,
        totalCommits: (cc?.totalCommitContributions as number) || 0,
        totalPRs: (cc?.totalPullRequestContributions as number) || 0,
        totalReviews: (cc?.totalPullRequestReviewContributions as number) || 0,
        totalIssues: (cc?.totalIssueContributions as number) || 0,
        contributionDays,
        externalMergedPRs: externalPRs,
        seedRepoContributions: seedContribs,
        organizations,
        targetLanguage: primaryLang,
        targetRole: roleCategory,
        isSponsorable: !!((gqlData as Record<string, unknown>)?.isSponsorable),
        sponsorCount: ((gqlData as Record<string, unknown>)?.sponsorshipsAsMaintainer as Record<string, unknown>)?.totalCount as number || 0,
      };

      const score = calculateScore(scoringInput);
      const totalStars = repos.reduce((s, r) => s + r.stars, 0);

      // Language percentages
      const langMap = new Map<string, number>();
      for (const r of repos.filter((r) => !r.isFork && r.language)) {
        langMap.set(r.language, (langMap.get(r.language) || 0) + 1);
      }
      const totalLangRepos = Array.from(langMap.values()).reduce((s, v) => s + v, 0);
      const languages: Record<string, number> = {};
      for (const [lang, count] of langMap) {
        languages[lang] = Math.round((count / totalLangRepos) * 100);
      }

      return {
        username,
        displayName: (profile.name as string) || username,
        avatarUrl: (profile.avatar_url as string) || "",
        bio: (profile.bio as string) || "",
        location: (profile.location as string) || "",
        email: (profile.email as string) || null,
        company: (profile.company as string) || null,
        hireable: !!(profile.hireable),
        followers: (profile.followers as number) || 0,
        following: (profile.following as number) || 0,
        publicRepos: (profile.public_repos as number) || 0,
        createdAt: (profile.created_at as string) || "",
        profileUrl: `https://github.com/${username}`,
        source: "deep" as const,
        score: {
          total: score.total,
          impact: score.impact,
          contributionQuality: score.contributionQuality,
          consistency: score.consistency,
          technicalDepth: score.technicalDepth,
          reputation: score.reputation,
          confidence: score.confidence,
          confidenceModifier: score.confidenceModifier,
        },
        tier: score.tier,
        topRepos: repos.slice(0, 5).map((r) => ({
          name: r.name,
          stars: r.stars,
          forks: r.forks,
          language: r.language,
          updatedAt: r.updatedAt,
        })),
        languages,
        totalStars,
        totalForks: repos.reduce((s, r) => s + r.forks, 0),
        contributionsLastYear: (calendar?.totalContributions as number) || 0,
        activeWeeksLastYear: weeks.filter((w) => w.contributionDays.some((d) => d.contributionCount > 0)).length,
        externalReposContributedTo: seedContribs.map((s) => s.repo),
        organizations,
        hasEmail: !!(profile.email),
        isHireable: !!(profile.hireable),
      };
    })
  );

  // Sort by score
  developers.sort((a, b) => b.score.total - a.score.total);

  return Response.json({
    total_count: developers.length,
    developers,
    meta: {
      roleCategory,
      reposScanned,
      contributorsFound: contributorMap.size,
      enriched: enriched.length,
      unicorns: developers.filter((d) => d.score.total >= 90).length,
    },
  });
}
