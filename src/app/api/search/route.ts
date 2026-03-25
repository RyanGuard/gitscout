import { prisma } from "@/lib/prisma";
import type { GitHubUser } from "@/types";

const GITHUB_API = "https://api.github.com";

function githubHeaders(): HeadersInit {
  const headers: HeadersInit = {
    Accept: "application/vnd.github+json",
    "User-Agent": "GitScout/1.0",
  };
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  return headers;
}

// Build a GitHub users search query string from our filters
function buildGitHubQuery(params: {
  q: string;
  languages?: string[];
  location?: string;
  minStars?: number;
  hireable?: boolean;
}): string {
  const parts: string[] = [];

  // Main query — could be a name, keyword, or tech
  if (params.q) parts.push(params.q);

  if (params.languages && params.languages.length > 0) {
    // GitHub search supports one language filter, use the first
    parts.push(`language:${params.languages[0]}`);
  }
  if (params.location) {
    parts.push(`location:"${params.location}"`);
  }
  if (params.minStars) {
    parts.push(`repos:>=${Math.max(1, Math.floor(params.minStars / 50))}`);
  }

  return parts.join(" ");
}

// Convert a raw GitHub user into our DeveloperProfile shape (lightweight, no repos/languages)
function githubUserToProfile(user: GitHubUser) {
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
    score: 0,
    languages: [] as { language: string; bytes: number; repoCount: number; percentage: number }[],
    repositories: [] as { id: string; name: string; fullName: string; description: string | null; language: string | null; stars: number; forks: number; topics: string[]; pushedAt: string | null }[],
    source: "github" as const,
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") || "";
  const languages = searchParams.get("languages")?.split(",").filter(Boolean);
  const location = searchParams.get("location");
  const minStars = searchParams.get("minStars")
    ? parseInt(searchParams.get("minStars")!)
    : undefined;
  const hireable = searchParams.get("hireable") === "true";
  const sort = searchParams.get("sort") || "followers";
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const limit = Math.min(30, Math.max(1, parseInt(searchParams.get("limit") || "20")));

  if (!q && !languages?.length && !location) {
    return Response.json({
      developers: [],
      total: 0,
      page,
      totalPages: 0,
      query: q,
    });
  }

  // --- 1. Query GitHub Search API live ---
  const ghQuery = buildGitHubQuery({ q, languages, location: location || undefined, minStars, hireable });

  const ghSort =
    sort === "stars" ? "repositories"
    : sort === "followers" ? "followers"
    : sort === "joined" ? "joined"
    : ""; // default: best match

  const ghParams = new URLSearchParams({
    q: ghQuery,
    per_page: String(limit),
    page: String(page),
  });
  if (ghSort) ghParams.set("sort", ghSort);

  let githubUsers: { login: string; id: number; avatar_url: string }[] = [];
  let githubTotal = 0;

  try {
    const res = await fetch(`${GITHUB_API}/search/users?${ghParams}`, {
      headers: githubHeaders(),
    });
    if (res.ok) {
      const data = await res.json();
      githubUsers = data.items || [];
      githubTotal = Math.min(data.total_count || 0, 1000); // GitHub caps at 1000
    }
  } catch {
    // GitHub API failed — fall through to local-only
  }

  // --- 2. Check which of these users we already have locally ---
  const githubIds = githubUsers.map((u) => u.id);
  const localDevs = githubIds.length > 0
    ? await prisma.developer.findMany({
        where: { githubId: { in: githubIds } },
        include: {
          languages: { orderBy: { percentage: "desc" }, take: 5 },
          repositories: { orderBy: { stars: "desc" }, take: 3 },
        },
      })
    : [];

  const localByGithubId = new Map(localDevs.map((d) => [d.githubId, d]));

  // --- 3. Fetch full profiles from GitHub for users we DON'T have locally ---
  // (parallel fetch, but limit to avoid rate limits)
  const unknownUsers = githubUsers.filter((u) => !localByGithubId.has(u.id));
  const profileFetches = unknownUsers.slice(0, 10).map(async (u) => {
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

  const fetchedProfiles = await Promise.all(profileFetches);
  const profileMap = new Map<number, GitHubUser>();
  for (const p of fetchedProfiles) {
    if (p) profileMap.set(p.id, p);
  }

  // --- 4. Merge: local data wins, GitHub fills in the rest ---
  const developers = githubUsers.map((ghUser) => {
    const local = localByGithubId.get(ghUser.id);
    if (local) {
      return {
        id: local.id,
        githubId: local.githubId,
        username: local.username,
        name: local.name,
        email: local.email,
        avatarUrl: local.avatarUrl,
        bio: local.bio,
        company: local.company,
        location: local.location,
        blog: local.blog,
        twitterUsername: local.twitterUsername,
        publicRepos: local.publicRepos,
        followers: local.followers,
        following: local.following,
        hireable: local.hireable,
        primaryLanguage: local.primaryLanguage,
        totalCommits: local.totalCommits,
        totalStars: local.totalStars,
        score: local.score,
        languages: local.languages,
        repositories: local.repositories.map((r) => ({
          id: r.id,
          name: r.name,
          fullName: r.fullName,
          description: r.description,
          language: r.language,
          stars: r.stars,
          forks: r.forks,
          topics: r.topics,
          pushedAt: r.pushedAt?.toISOString() ?? null,
        })),
        source: "local" as const,
      };
    }

    // Use fetched full profile if available, otherwise minimal data from search result
    const full = profileMap.get(ghUser.id);
    if (full) {
      return { ...githubUserToProfile(full), source: "github" as const };
    }

    // Minimal profile from search result (no bio, no followers count, etc.)
    return {
      id: `gh-${ghUser.id}`,
      githubId: ghUser.id,
      username: ghUser.login,
      name: null as string | null,
      email: null as string | null,
      avatarUrl: ghUser.avatar_url,
      bio: null as string | null,
      company: null as string | null,
      location: null as string | null,
      blog: null as string | null,
      twitterUsername: null as string | null,
      publicRepos: 0,
      followers: 0,
      following: 0,
      hireable: false,
      primaryLanguage: null as string | null,
      totalCommits: 0,
      totalStars: 0,
      score: 0,
      languages: [] as { language: string; bytes: number; repoCount: number; percentage: number }[],
      repositories: [] as { id: string; name: string; fullName: string; description: string | null; language: string | null; stars: number; forks: number; topics: string[]; pushedAt: string | null }[],
      source: "github" as const,
    };
  });

  return Response.json({
    developers,
    total: githubTotal,
    page,
    totalPages: Math.ceil(githubTotal / limit),
    query: q,
  });
}
