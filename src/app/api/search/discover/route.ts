import { NextRequest, NextResponse } from "next/server";

const GITHUB_API = "https://api.github.com";

function githubHeaders(): HeadersInit {
  const headers: HeadersInit = {
    Accept: "application/vnd.github+json",
    "User-Agent": "Scout/1.0",
  };
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  return headers;
}

interface ContributorProfile {
  id: number;
  login: string;
  name: string | null;
  avatar_url: string;
  bio: string | null;
  company: string | null;
  location: string | null;
  followers: number;
  following: number;
  public_repos: number;
  blog: string | null;
  email: string | null;
  hireable: boolean;
  twitter_username: string | null;
  created_at: string;
  discoveredVia: string; // repo name where we found them
}

/**
 * GET /api/search/discover?q=kubernetes&location=SF
 *
 * Repo-based people discovery:
 * 1. Search GitHub for top repos matching the query
 * 2. Get contributors from those repos
 * 3. Fetch full profiles for top contributors
 * 4. Return unique, diverse set of developers
 *
 * This finds people by what they BUILD, not their bio.
 */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q");
  const location = req.nextUrl.searchParams.get("location");
  const limit = Math.min(parseInt(req.nextUrl.searchParams.get("limit") || "15"), 30);

  if (!q) {
    return NextResponse.json({ error: "q parameter required" }, { status: 400 });
  }

  try {
    // Step 1: Search for top repos matching the query
    const repoQuery = `${q} stars:>50 pushed:>${getRecentDate(180)}`;
    const repoRes = await fetch(
      `${GITHUB_API}/search/repositories?q=${encodeURIComponent(repoQuery)}&sort=stars&per_page=8`,
      { headers: githubHeaders() }
    );

    if (!repoRes.ok) {
      return NextResponse.json({ error: "GitHub search failed", status: repoRes.status }, { status: 502 });
    }

    const repoData = await repoRes.json();
    const repos = (repoData.items || []).slice(0, 8);

    if (repos.length === 0) {
      return NextResponse.json({ developers: [], repos: [], total: 0 });
    }

    // Step 2: Get contributors from each repo (parallel, max 5 per repo)
    const seenLogins = new Set<string>();
    const candidateLogins: Array<{ login: string; repo: string; contributions: number }> = [];

    await Promise.all(
      repos.map(async (repo: { full_name: string; name: string; owner: { login: string } }) => {
        try {
          const contribRes = await fetch(
            `${GITHUB_API}/repos/${repo.full_name}/contributors?per_page=10&anon=false`,
            { headers: githubHeaders() }
          );
          if (!contribRes.ok) return;

          const contributors = await contribRes.json();
          if (!Array.isArray(contributors)) return;

          for (const c of contributors) {
            // Skip bots and the repo owner (often an org)
            if (c.type === "Bot" || c.login?.endsWith("[bot]")) continue;
            if (c.login === repo.owner.login) continue;
            if (seenLogins.has(c.login)) continue;

            seenLogins.add(c.login);
            candidateLogins.push({
              login: c.login,
              repo: repo.name,
              contributions: c.contributions || 0,
            });
          }
        } catch {
          // Skip failed repos
        }
      })
    );

    // Step 3: Sort by contribution count and take top candidates
    candidateLogins.sort((a, b) => b.contributions - a.contributions);
    const topCandidates = candidateLogins.slice(0, limit * 2); // Fetch more than needed for location filtering

    // Step 4: Fetch full profiles (parallel, batched)
    const profiles: ContributorProfile[] = [];

    const batches = [];
    for (let i = 0; i < topCandidates.length; i += 5) {
      batches.push(topCandidates.slice(i, i + 5));
    }

    for (const batch of batches) {
      const batchProfiles = await Promise.all(
        batch.map(async (candidate) => {
          try {
            const userRes = await fetch(
              `${GITHUB_API}/users/${candidate.login}`,
              { headers: githubHeaders() }
            );
            if (!userRes.ok) return null;

            const user = await userRes.json();

            // Location filter
            if (location) {
              const userLoc = (user.location || "").toLowerCase();
              const targetLoc = location.toLowerCase();
              if (!userLoc.includes(targetLoc) && !targetLoc.includes(userLoc)) {
                // Relaxed match — check for state/country
                const locParts = targetLoc.split(/[,\s]+/);
                if (!locParts.some((p: string) => userLoc.includes(p))) {
                  return null;
                }
              }
            }

            return {
              id: user.id,
              login: user.login,
              name: user.name,
              avatar_url: user.avatar_url,
              bio: user.bio,
              company: user.company,
              location: user.location,
              followers: user.followers || 0,
              following: user.following || 0,
              public_repos: user.public_repos || 0,
              blog: user.blog,
              email: user.email,
              hireable: user.hireable || false,
              twitter_username: user.twitter_username,
              created_at: user.created_at,
              discoveredVia: candidate.repo,
            } as ContributorProfile;
          } catch {
            return null;
          }
        })
      );

      profiles.push(...batchProfiles.filter((p): p is ContributorProfile => p !== null));

      // Stop if we have enough
      if (profiles.length >= limit) break;
    }

    // Step 5: Score and sort
    const scored = profiles.slice(0, limit).map((p) => {
      const followerSignal = Math.min(10, Math.log10(1 + p.followers) * 1.85);
      const repoSignal = Math.min(5, Math.log10(1 + p.public_repos) * 2.5);
      const ratio = p.following > 0 ? p.followers / p.following : Math.min(p.followers, 100);
      const ratioBonus = ratio >= 10 ? 1.5 : ratio >= 5 ? 1 : ratio >= 2 ? 0.5 : 0;
      const profileBonus = (p.bio ? 0.5 : 0) + (p.email ? 0.3 : 0) + (p.blog ? 0.3 : 0);
      const raw = followerSignal * 4 + repoSignal * 2 + ratioBonus * 3 + profileBonus * 2;
      const score = Math.round(Math.min(100, raw) * 10) / 10;
      const tier = score >= 90 ? "Unicorn" : score >= 75 ? "On Fire" : score >= 60 ? "Gem" : score >= 40 ? "Seedling" : "Mystery";

      return {
        id: `gh-${p.id}`,
        githubId: p.id,
        username: p.login,
        name: p.name,
        email: p.email,
        avatarUrl: p.avatar_url,
        bio: p.bio,
        company: p.company,
        location: p.location,
        blog: p.blog,
        twitterUsername: p.twitter_username,
        publicRepos: p.public_repos,
        followers: p.followers,
        following: p.following,
        hireable: p.hireable,
        primaryLanguage: null,
        totalCommits: 0,
        totalStars: 0,
        score,
        tier,
        languages: [],
        repositories: [],
        source: "discover" as const,
        discoveredVia: p.discoveredVia,
      };
    });

    return NextResponse.json({
      developers: scored,
      total: scored.length,
      repos: repos.map((r: { name: string; full_name: string; stargazers_count: number; description: string }) => ({
        name: r.name,
        fullName: r.full_name,
        stars: r.stargazers_count,
        description: r.description,
      })),
      method: "repo_discovery",
    });
  } catch (error) {
    console.error("[search/discover] Failed:", error);
    return NextResponse.json({ error: "Discovery search failed" }, { status: 500 });
  }
}

function getRecentDate(daysAgo: number): string {
  const d = new Date(Date.now() - daysAgo * 86400000);
  return d.toISOString().split("T")[0];
}
