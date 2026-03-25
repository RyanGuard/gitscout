import { prisma } from "@/lib/prisma";
import type { GitHubUser, GitHubRepo } from "@/types";

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

async function fetchGitHubUser(username: string): Promise<GitHubUser | null> {
  const res = await fetch(`${GITHUB_API}/users/${username}`, {
    headers: githubHeaders(),
  });
  if (!res.ok) return null;
  return res.json();
}

async function fetchGitHubRepos(username: string): Promise<GitHubRepo[]> {
  const res = await fetch(
    `${GITHUB_API}/users/${username}/repos?per_page=100&sort=stars&direction=desc`,
    { headers: githubHeaders() }
  );
  if (!res.ok) return [];
  return res.json();
}

async function searchGitHubUsers(query: string): Promise<string[]> {
  const res = await fetch(
    `${GITHUB_API}/search/users?q=${encodeURIComponent(query)}&per_page=30`,
    { headers: githubHeaders() }
  );
  if (!res.ok) return [];
  const data = await res.json();
  return (data.items || []).map((u: { login: string }) => u.login);
}

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

function computeScore(user: GitHubUser, repos: GitHubRepo[]): number {
  const totalStars = repos.reduce((s, r) => s + r.stargazers_count, 0);
  return (
    totalStars * 2 +
    user.followers * 1.5 +
    user.public_repos * 0.5 +
    (user.hireable ? 10 : 0)
  );
}

async function syncOneUser(username: string) {
  const user = await fetchGitHubUser(username);
  if (!user) return null;

  const repos = await fetchGitHubRepos(username);
  const nonForkRepos = repos.filter((r) => !r.fork && !r.archived);
  const languageStats = computeLanguageStats(repos);
  const totalStars = repos.reduce((s, r) => s + r.stargazers_count, 0);
  const score = computeScore(user, repos);

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
      totalCommits: 0,
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
      score,
      syncedAt: new Date(),
    },
  });

  // Upsert languages
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

  // Remove stale language entries
  const currentLanguages = languageStats.map((l) => l.language);
  await prisma.languageStat.deleteMany({
    where: {
      developerId: developer.id,
      language: { notIn: currentLanguages },
    },
  });

  // Upsert repos (top 20 non-fork, non-archived)
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
}: {
  usernames: string[];
  query?: string;
}) {
  const log = await prisma.syncLog.create({ data: {} });
  let synced = 0;
  let errors = 0;

  const allUsernames = [...usernames];
  if (query) {
    const searched = await searchGitHubUsers(query);
    allUsernames.push(...searched);
  }

  const unique = [...new Set(allUsernames)];

  for (const username of unique) {
    try {
      await syncOneUser(username);
      synced++;
    } catch {
      errors++;
    }
    // Rate limit: 1 second between users
    if (unique.indexOf(username) < unique.length - 1) {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  await prisma.syncLog.update({
    where: { id: log.id },
    data: {
      status: "completed",
      developers: synced,
      errors,
      completedAt: new Date(),
    },
  });

  return { synced, errors, total: unique.length };
}
