import { prisma } from "@/lib/prisma";
import { computeScore } from "@/lib/scoring";
import { fetchContributions } from "@/pipeline/graphql";
import type { GitHubUser, GitHubRepo } from "@/types";

const GITHUB_API = "https://api.github.com";

// --- Rate Limit State ---

let rateLimitRemaining = Infinity;
let rateLimitReset = 0;
let searchRateLimitRemaining = Infinity;
let searchRateLimitReset = 0;

function updateRateLimit(headers: Headers, isSearch = false) {
  const remaining = headers.get("x-ratelimit-remaining");
  const reset = headers.get("x-ratelimit-reset");

  if (remaining !== null) {
    const val = parseInt(remaining, 10);
    if (isSearch) {
      searchRateLimitRemaining = val;
    } else {
      rateLimitRemaining = val;
    }
    console.log(`[rate-limit] ${isSearch ? "search" : "core"} remaining: ${val}`);
  }
  if (reset !== null) {
    const val = parseInt(reset, 10);
    if (isSearch) {
      searchRateLimitReset = val;
    } else {
      rateLimitReset = val;
    }
  }
}

async function waitForRateLimit(isSearch = false) {
  const remaining = isSearch ? searchRateLimitRemaining : rateLimitRemaining;
  const reset = isSearch ? searchRateLimitReset : rateLimitReset;

  if (remaining < 10 && reset > 0) {
    const waitMs = Math.max(0, reset * 1000 - Date.now()) + 1000;
    console.log(`[rate-limit] ${isSearch ? "search" : "core"} low (${remaining}), waiting ${Math.ceil(waitMs / 1000)}s until reset`);
    await new Promise((r) => setTimeout(r, waitMs));
  }
}

// --- Retry Logic ---

class GitHubApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public retryable: boolean,
  ) {
    super(message);
    this.name = "GitHubApiError";
  }
}

async function fetchWithRetry(
  url: string,
  options: { isSearch?: boolean } = {},
): Promise<Response> {
  const maxAttempts = 3;
  const backoffBase = [1000, 3000, 9000];

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await waitForRateLimit(options.isSearch);

    const res = await fetch(url, { headers: githubHeaders() });
    updateRateLimit(res.headers, options.isSearch);

    if (res.ok) return res;

    // Rate limited — wait for reset and retry
    if (res.status === 403 || res.status === 429) {
      const resetHeader = res.headers.get("x-ratelimit-reset");
      if (resetHeader) {
        const resetTime = parseInt(resetHeader, 10);
        const waitMs = Math.max(0, resetTime * 1000 - Date.now()) + 1000;
        console.log(`[rate-limit] HTTP ${res.status}, waiting ${Math.ceil(waitMs / 1000)}s for reset`);
        await new Promise((r) => setTimeout(r, waitMs));
        continue;
      }
    }

    // 404 — don't retry
    if (res.status === 404) {
      throw new GitHubApiError(`Not found: ${url}`, 404, false);
    }

    // 5xx — retry with backoff
    if (res.status >= 500) {
      if (attempt < maxAttempts - 1) {
        const delay = backoffBase[attempt];
        console.log(`[retry] HTTP ${res.status} on attempt ${attempt + 1}, retrying in ${delay}ms`);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
    }

    // Other errors — throw non-retryable
    throw new GitHubApiError(
      `GitHub API error ${res.status}: ${url}`,
      res.status,
      false,
    );
  }

  throw new GitHubApiError(`All ${maxAttempts} attempts failed for: ${url}`, 0, false);
}

// --- GitHub API Functions ---

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

async function fetchGitHubUser(username: string): Promise<GitHubUser | null> {
  try {
    const res = await fetchWithRetry(`${GITHUB_API}/users/${username}`);
    return res.json();
  } catch (err) {
    if (err instanceof GitHubApiError && err.status === 404) return null;
    throw err;
  }
}

async function fetchGitHubRepos(username: string): Promise<GitHubRepo[]> {
  try {
    const res = await fetchWithRetry(
      `${GITHUB_API}/users/${username}/repos?per_page=100&sort=stars&direction=desc`,
    );
    return res.json();
  } catch (err) {
    if (err instanceof GitHubApiError && err.status === 404) return [];
    throw err;
  }
}

async function searchGitHubUsers(
  query: string,
  pages = 1,
): Promise<string[]> {
  const allLogins: string[] = [];

  for (let page = 1; page <= pages; page++) {
    try {
      const res = await fetchWithRetry(
        `${GITHUB_API}/search/users?q=${encodeURIComponent(query)}&per_page=30&page=${page}`,
        { isSearch: true },
      );
      const data = await res.json();
      const logins = (data.items || []).map((u: { login: string }) => u.login);
      allLogins.push(...logins);

      if (logins.length < 30) break;
    } catch (err) {
      console.error(`[search] Failed to fetch page ${page}: ${err}`);
      break;
    }
  }

  return allLogins;
}

// --- Stats ---

function computeLanguageStats(repos: GitHubRepo[]) {
  const langMap = new Map<string, { bytes: number; count: number }>();

  for (const repo of repos) {
    if (!repo.language || repo.fork) continue;
    const existing = langMap.get(repo.language) || { bytes: 0, count: 0 };
    existing.bytes += repo.stargazers_count * 1000 + 1000;
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

// --- Sync Logic ---

export async function syncOneUser(username: string) {
  const user = await fetchGitHubUser(username);
  if (!user) return null;

  const repos = await fetchGitHubRepos(username);
  const nonForkRepos = repos.filter((r) => !r.fork && !r.archived);
  const languageStats = computeLanguageStats(repos);
  const totalStars = repos.reduce((s, r) => s + r.stargazers_count, 0);

  // Fetch commit data via GraphQL (falls back to null if no token or on error)
  const contributions = await fetchContributions(username);

  const {
    score,
    totalCommits,
    recentActivity,
    languageDiversity,
    avgRepoQuality,
  } = computeScore({ user, repos, contributions });

  const developer = await prisma.developer.upsert({
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
      totalCommits,
      recentActivity,
      languageDiversity,
      avgRepoQuality,
      score,
    },
    update: {
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
      totalCommits,
      recentActivity,
      languageDiversity,
      avgRepoQuality,
      score,
      syncedAt: new Date(),
      lastSyncError: null,
    },
  });

  for (const lang of languageStats) {
    await prisma.languageStat.upsert({
      where: {
        developerId_language: {
          developerId: developer.id,
          language: lang.language,
        },
      },
      create: {
        developerId: developer.id,
        language: lang.language,
        bytes: lang.bytes,
        repoCount: lang.repoCount,
        percentage: lang.percentage,
      },
      update: {
        bytes: lang.bytes,
        repoCount: lang.repoCount,
        percentage: lang.percentage,
      },
    });
  }

  const currentLanguages = languageStats.map((l) => l.language);
  await prisma.languageStat.deleteMany({
    where: {
      developerId: developer.id,
      language: { notIn: currentLanguages },
    },
  });

  for (const repo of nonForkRepos.slice(0, 20)) {
    await prisma.repository.upsert({
      where: { githubId: repo.id },
      create: {
        githubId: repo.id,
        name: repo.name,
        fullName: repo.full_name,
        description: repo.description,
        language: repo.language,
        stars: repo.stargazers_count,
        forks: repo.forks_count,
        topics: repo.topics,
        pushedAt: repo.pushed_at ? new Date(repo.pushed_at) : null,
        developerId: developer.id,
      },
      update: {
        name: repo.name,
        fullName: repo.full_name,
        description: repo.description,
        language: repo.language,
        stars: repo.stargazers_count,
        forks: repo.forks_count,
        topics: repo.topics,
        pushedAt: repo.pushed_at ? new Date(repo.pushed_at) : null,
      },
    });
  }

  return developer;
}

export async function syncDevelopers({
  usernames,
  query,
  pages,
}: {
  usernames: string[];
  query?: string;
  pages?: number;
}) {
  const log = await prisma.syncLog.create({ data: {} });
  let synced = 0;
  let errors = 0;

  const allUsernames = [...usernames];
  if (query) {
    const searched = await searchGitHubUsers(query, pages ?? 1);
    allUsernames.push(...searched);
  }

  const unique = [...new Set(allUsernames)];

  for (const username of unique) {
    try {
      const result = await syncOneUser(username);
      if (result) {
        synced++;
      } else {
        errors++;
        await prisma.developer.updateMany({
          where: { username },
          data: { lastSyncError: `User not found: ${username}` },
        });
      }
    } catch (err) {
      errors++;
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[sync] Failed to sync ${username}: ${message}`);
      await prisma.developer.updateMany({
        where: { username },
        data: { lastSyncError: message },
      }).catch(() => {});
    }
  }

  await prisma.syncLog.update({
    where: { id: log.id },
    data: {
      status: errors > 0 && synced === 0 ? "failed" : "completed",
      developers: synced,
      errors,
      completedAt: new Date(),
    },
  });

  return { synced, errors, total: unique.length };
}
