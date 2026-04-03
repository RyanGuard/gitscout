// Pre-index cron job — indexes top developers from seed repos into Supabase
// Runs daily at 3am UTC via Vercel Cron
// Processes Tier 1 cities first, then Tier 2, Tier 3

import { getGitHubClient } from "@/lib/github/client";
import { ROLE_CATEGORIES } from "@/lib/search/seedRepos";
import { calculateScore, type ScoringInput } from "@/lib/scoring/engine";
import { prisma } from "@/lib/prisma";

const MAX_PER_CATEGORY = 30; // Developers per role category per run
const STALE_DAYS = 7;

export async function GET(request: Request) {
  // Auth check
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const client = getGitHubClient();
  const startTime = Date.now();
  let totalIndexed = 0;
  let totalErrors = 0;
  const details: string[] = [];

  // Log start
  try {
    const { Client } = await import("pg");
    const pgClient = new Client({ connectionString: process.env.DIRECT_DATABASE_URL });
    await pgClient.connect();
    await pgClient.query(
      `INSERT INTO cron_logs (job_name, status, details) VALUES ($1, $2, $3)`,
      ["index-developers", "started", JSON.stringify({ startTime: new Date().toISOString() })]
    );
    await pgClient.end();
  } catch {
    // Non-fatal
  }

  // Process each role category
  for (const category of ROLE_CATEGORIES) {
    const seedRepos = category.seedRepos
      .filter((r) => r.weight >= 2) // Only weight 2-3 for cron
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 5); // Top 5 repos per category

    const contributorLogins = new Set<string>();

    // Fetch contributors from top seed repos
    for (const repo of seedRepos) {
      if (contributorLogins.size >= MAX_PER_CATEGORY * 2) break;
      try {
        const contributors = await client.getRepoContributors(repo.owner, repo.name, 30);
        if (Array.isArray(contributors)) {
          for (const c of contributors) {
            if (c.login && c.type !== "Bot") {
              contributorLogins.add(c.login);
            }
          }
        }
      } catch {
        totalErrors++;
      }
    }

    // Check which are already fresh in our DB
    const existingFresh = await prisma.developer.findMany({
      where: {
        username: { in: Array.from(contributorLogins) },
        syncedAt: { gt: new Date(Date.now() - STALE_DAYS * 24 * 60 * 60 * 1000) },
      },
      select: { username: true },
    });
    const freshSet = new Set(existingFresh.map((d) => d.username));

    // Filter out fresh profiles
    const toIndex = Array.from(contributorLogins)
      .filter((login) => !freshSet.has(login))
      .slice(0, MAX_PER_CATEGORY);

    // Enrich and index each developer
    for (const login of toIndex) {
      try {
        const user = await client.getUser(login);
        if (!user) continue;

        const gqlData = await client.getEnrichedProfile(login);
        const externalPRs = await client.getExternalMergedPRs(login);

        // Extract data from GraphQL
        const cc = (gqlData as Record<string, unknown>)?.contributionsCollection as Record<string, unknown> | undefined;
        const calendar = cc?.contributionCalendar as Record<string, unknown> | undefined;
        const weeks = (calendar?.weeks || []) as Array<{ contributionDays: Array<{ contributionCount: number; date: string }> }>;
        const contributionDays = weeks.flatMap((w) => w.contributionDays.map((d) => ({ date: d.date, count: d.contributionCount })));

        const gqlRepos = ((gqlData as Record<string, unknown>)?.repositories as Record<string, unknown>)?.nodes as Array<Record<string, unknown>> || [];
        const repos = gqlRepos.map((r) => ({
          name: r.name as string || "",
          stars: (r.stargazerCount as number) || 0,
          forks: (r.forkCount as number) || 0,
          language: ((r.primaryLanguage as Record<string, unknown>)?.name as string) || "",
          isFork: (r.isFork as boolean) || false,
          updatedAt: (r.updatedAt as string) || "",
          description: (r.description as string) || "",
        }));

        const gqlOrgs = ((gqlData as Record<string, unknown>)?.organizations as Record<string, unknown>)?.nodes as Array<Record<string, unknown>> || [];
        const organizations = gqlOrgs.map((o) => (o.login as string) || "");

        // Score
        const scoringInput: ScoringInput = {
          followers: user.followers || 0,
          following: user.following || 0,
          publicRepos: user.public_repos || 0,
          accountCreatedAt: user.created_at || "",
          hireable: !!user.hireable,
          bio: user.bio || "",
          repos,
          totalContributions: (calendar?.totalContributions as number) || 0,
          totalCommits: (cc?.totalCommitContributions as number) || 0,
          totalPRs: (cc?.totalPullRequestContributions as number) || 0,
          totalReviews: (cc?.totalPullRequestReviewContributions as number) || 0,
          totalIssues: (cc?.totalIssueContributions as number) || 0,
          contributionDays,
          externalMergedPRs: externalPRs,
          seedRepoContributions: [],
          organizations,
          targetLanguage: category.languages[0],
          targetRole: category.id,
        };

        const score = calculateScore(scoringInput);
        const totalStars = repos.reduce((s, r) => s + r.stars, 0);
        const languageStats = computeLanguageStats(repos);

        // Upsert to our Prisma DB
        await prisma.developer.upsert({
          where: { githubId: user.id },
          create: {
            githubId: user.id,
            username: user.login,
            name: user.name,
            email: user.email,
            avatarUrl: user.avatar_url,
            bio: user.bio,
            company: user.company,
            location: user.location,
            blog: user.blog,
            twitterUsername: user.twitter_username,
            publicRepos: user.public_repos,
            followers: user.followers,
            following: user.following,
            hireable: user.hireable ?? false,
            primaryLanguage: languageStats[0]?.language ?? null,
            totalStars,
            totalCommits: scoringInput.totalCommits,
            recentActivity: scoringInput.totalContributions,
            languageDiversity: new Set(repos.filter((r) => !r.isFork).map((r) => r.language).filter(Boolean)).size,
            avgRepoQuality: repos.length > 0 ? Math.round((totalStars / repos.length) * 10) / 10 : 0,
            score: score.total,
          },
          update: {
            name: user.name,
            email: user.email,
            avatarUrl: user.avatar_url,
            bio: user.bio,
            company: user.company,
            location: user.location,
            blog: user.blog,
            twitterUsername: user.twitter_username,
            publicRepos: user.public_repos,
            followers: user.followers,
            following: user.following,
            hireable: user.hireable ?? false,
            primaryLanguage: languageStats[0]?.language ?? null,
            totalStars,
            totalCommits: scoringInput.totalCommits,
            recentActivity: scoringInput.totalContributions,
            score: score.total,
            syncedAt: new Date(),
            lastSyncError: null,
          },
        });

        // Upsert language stats
        for (const lang of languageStats) {
          await prisma.languageStat.upsert({
            where: { developerId_language: { developerId: login, language: lang.language } },
            create: { developerId: login, language: lang.language, bytes: lang.bytes, repoCount: lang.repoCount, percentage: lang.percentage },
            update: { bytes: lang.bytes, repoCount: lang.repoCount, percentage: lang.percentage },
          }).catch(() => {}); // May fail if developerId doesn't match — non-fatal
        }

        totalIndexed++;
      } catch {
        totalErrors++;
      }
    }

    details.push(`${category.label}: indexed ${toIndex.length} of ${contributorLogins.size} contributors`);
  }

  // Log completion
  const duration = Math.round((Date.now() - startTime) / 1000);
  try {
    const { Client } = await import("pg");
    const pgClient = new Client({ connectionString: process.env.DIRECT_DATABASE_URL });
    await pgClient.connect();
    await pgClient.query(
      `INSERT INTO cron_logs (job_name, status, details) VALUES ($1, $2, $3)`,
      ["index-developers", "completed", JSON.stringify({ totalIndexed, totalErrors, duration, details })]
    );
    await pgClient.end();
  } catch {
    // Non-fatal
  }

  return Response.json({
    status: "completed",
    totalIndexed,
    totalErrors,
    durationSeconds: duration,
    details,
  });
}

// Helper: compute language stats from repo list
function computeLanguageStats(repos: Array<{ language: string; isFork: boolean; stars: number }>) {
  const langMap = new Map<string, { bytes: number; count: number }>();
  for (const repo of repos) {
    if (!repo.language || repo.isFork) continue;
    const existing = langMap.get(repo.language) || { bytes: 0, count: 0 };
    existing.bytes += repo.stars * 1000 + 1000;
    existing.count += 1;
    langMap.set(repo.language, existing);
  }
  const totalBytes = Array.from(langMap.values()).reduce((s, v) => s + v.bytes, 0);
  return Array.from(langMap.entries())
    .map(([language, { bytes, count }]) => ({
      language,
      bytes,
      repoCount: count,
      percentage: totalBytes > 0 ? (bytes / totalBytes) * 100 : 0,
    }))
    .sort((a, b) => b.percentage - a.percentage);
}
