import { prisma } from "@/lib/prisma";
import type { GitHubUser, GitHubRepo } from "@/types";

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

function quickScore(user: GitHubUser): { score: number; tier: string } {
  const followerSignal = Math.min(
    10,
    (Math.log(1 + user.followers) / Math.log(1 + 500)) * 5
  );
  const repoSignal = Math.min(
    10,
    (Math.log(1 + user.public_repos) / Math.log(1 + 50)) * 5
  );
  const ratio =
    user.following > 0 ? user.followers / user.following : user.followers;
  const ratioBonus = ratio >= 5 ? 1 : ratio >= 2 ? 0.5 : 0;
  const profileBonus =
    (user.bio ? 0.3 : 0) +
    (user.email ? 0.2 : 0) +
    (user.blog ? 0.2 : 0) +
    (user.hireable ? 0.3 : 0);

  const raw =
    followerSignal * 0.45 + repoSignal * 0.3 + ratioBonus + profileBonus;
  const score = Math.round(Math.min(100, raw * 10) * 10) / 10;
  const tier =
    score >= 90
      ? "Elite"
      : score >= 75
        ? "Strong"
        : score >= 60
          ? "Solid"
          : score >= 40
            ? "Emerging"
            : "Limited Data";
  return { score, tier };
}

interface DeveloperData {
  username: string;
  location: string | null;
  followers: number;
  totalStars: number;
  languages: { language: string; percentage: number }[];
  createdAt: string | null;
}

async function getDeveloperData(
  username: string
): Promise<DeveloperData | null> {
  // Try local DB first
  const local = await prisma.developer.findUnique({
    where: { username },
    include: {
      languages: { orderBy: { percentage: "desc" }, take: 5 },
    },
  });

  if (local) {
    return {
      username: local.username,
      location: local.location,
      followers: local.followers,
      totalStars: local.totalStars,
      languages: local.languages.map((l) => ({
        language: l.language,
        percentage: l.percentage,
      })),
      createdAt: local.createdAt?.toISOString() ?? null,
    };
  }

  // Fall back to GitHub API
  const [userRes, reposRes] = await Promise.all([
    fetch(`${GITHUB_API}/users/${username}`, { headers: githubHeaders() }),
    fetch(
      `${GITHUB_API}/users/${username}/repos?per_page=20&sort=stars&direction=desc`,
      { headers: githubHeaders() }
    ),
  ]);

  if (!userRes.ok) return null;

  const user: GitHubUser = await userRes.json();
  const repos: GitHubRepo[] = reposRes.ok ? await reposRes.json() : [];
  const nonFork = repos.filter((r) => !r.fork && !r.archived);

  const langMap = new Map<string, { count: number; stars: number }>();
  for (const repo of nonFork) {
    if (!repo.language) continue;
    const existing = langMap.get(repo.language) || { count: 0, stars: 0 };
    existing.count++;
    existing.stars += repo.stargazers_count;
    langMap.set(repo.language, existing);
  }
  const totalWeight = Array.from(langMap.values()).reduce(
    (s, v) => s + v.stars + v.count,
    0
  );
  const languages = Array.from(langMap.entries())
    .map(([language, { count, stars }]) => ({
      language,
      percentage:
        totalWeight > 0 ? ((stars + count) / totalWeight) * 100 : 0,
    }))
    .sort((a, b) => b.percentage - a.percentage);

  const totalStars = nonFork.reduce((s, r) => s + r.stargazers_count, 0);

  return {
    username: user.login,
    location: user.location,
    followers: user.followers,
    totalStars,
    languages,
    createdAt: user.created_at,
  };
}

function buildSearchQuery(
  dev: DeveloperData,
  broaden: boolean
): { query: string; filters: { label: string; value: string }[] } {
  const parts: string[] = [];
  const filters: { label: string; value: string }[] = [];

  // Top languages (up to 3)
  const topLangs = dev.languages.slice(0, 3);
  if (topLangs.length > 0) {
    // GitHub user search supports one language filter
    parts.push(`language:${topLangs[0].language}`);
    filters.push({ label: "Language", value: topLangs[0].language });
  }

  // Location (skip if broadening)
  if (dev.location && !broaden) {
    parts.push(`location:"${dev.location}"`);
    filters.push({ label: "Location", value: dev.location });
  }

  // Follower range (+-50%, widen if broadening)
  if (dev.followers > 10) {
    const factor = broaden ? 0.8 : 0.5;
    const minFollowers = Math.max(
      5,
      Math.floor(dev.followers * (1 - factor))
    );
    const maxFollowers = Math.ceil(dev.followers * (1 + factor));
    parts.push(`followers:${minFollowers}..${maxFollowers}`);
    filters.push({
      label: "Followers",
      value: `${minFollowers}-${maxFollowers}`,
    });
  } else {
    parts.push("followers:>=5");
  }

  return { query: parts.join(" "), filters };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const username = searchParams.get("username");

  if (!username) {
    return Response.json({ error: "Missing username parameter" }, { status: 400 });
  }

  const dev = await getDeveloperData(username);
  if (!dev) {
    return Response.json({ error: "Developer not found" }, { status: 404 });
  }

  // Try normal search first, broaden if too few results
  let results: GitHubUser[] = [];
  let usedFilters: { label: string; value: string }[] = [];
  let locationSkipped = false;

  for (const broaden of [false, true]) {
    const { query, filters } = buildSearchQuery(dev, broaden);
    usedFilters = filters;

    if (broaden && !dev.location) continue; // nothing to broaden

    if (broaden) {
      locationSkipped = true;
    }

    const ghParams = new URLSearchParams({
      q: query,
      per_page: "30",
      sort: "followers",
    });

    try {
      const res = await fetch(
        `${GITHUB_API}/search/users?${ghParams}`,
        { headers: githubHeaders() }
      );
      if (res.ok) {
        const data = await res.json();
        results = (data.items || []) as GitHubUser[];
      }
    } catch {
      // GitHub API failed
    }

    // Filter out the current developer
    results = results.filter(
      (u) => u.login.toLowerCase() !== username.toLowerCase()
    );

    if (results.length >= 5) break;
  }

  // Fetch full profiles for the results (up to 20)
  const topResults = results.slice(0, 20);
  const profileFetches = topResults.map(async (u) => {
    try {
      const res = await fetch(`${GITHUB_API}/users/${u.login}`, {
        headers: githubHeaders(),
      });
      if (!res.ok) return null;
      return (await res.json()) as GitHubUser;
    } catch {
      return null;
    }
  });

  const profiles = (await Promise.all(profileFetches)).filter(
    (p): p is GitHubUser => p !== null
  );

  // Score and sort
  const developers = profiles
    .map((user) => {
      const { score, tier } = quickScore(user);
      return {
        id: `gh-${user.id}`,
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
        primaryLanguage: null as string | null,
        totalCommits: 0,
        totalStars: 0,
        score,
        tier,
        languages: [] as { language: string; bytes: number; repoCount: number; percentage: number }[],
        repositories: [] as { id: string; name: string; fullName: string; description: string | null; language: string | null; stars: number; forks: number; topics: string[]; pushedAt: string | null }[],
        source: "github" as const,
      };
    })
    .sort((a, b) => b.score - a.score);

  return Response.json({
    developers,
    sourceUsername: dev.username,
    filters: usedFilters,
    locationSkipped,
    total: developers.length,
  });
}
