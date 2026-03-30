import type { ApolloPerson } from "./apollo";
import { getCached, setCache } from "./cache";

const GITHUB_API = "https://api.github.com";

function githubHeaders(): HeadersInit {
  const h: HeadersInit = {
    Accept: "application/vnd.github+json",
    "User-Agent": "Scout/2.0",
  };
  const token = process.env.GITHUB_TOKEN;
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

interface GithubMatch {
  username: string;
  confidence: "high" | "medium" | "low";
}

/**
 * Try to match an Apollo person to a GitHub profile.
 * Returns null if no match found.
 */
export async function matchGithubProfiles(
  person: ApolloPerson
): Promise<GithubMatch | null> {
  // Strategy 1: Search by name + company (medium reliability)
  if (person.first_name && person.last_name) {
    const match = await searchGithubByName(
      person.first_name,
      person.last_name
    );
    if (match) return match;
  }

  // Strategy 2: Try common username patterns (low reliability)
  if (person.first_name && person.last_name) {
    const match = await tryUsernameGuesses(
      person.first_name,
      person.last_name
    );
    if (match) return match;
  }

  return null;
}

async function searchGithubByName(
  firstName: string,
  lastName: string
): Promise<GithubMatch | null> {
  try {
    const query = encodeURIComponent(`${firstName} ${lastName}`);
    const res = await fetch(
      `${GITHUB_API}/search/users?q=${query}&per_page=5`,
      { headers: githubHeaders() }
    );

    if (!res.ok) return null;

    const data = await res.json();
    const users = data.items || [];

    if (users.length === 0) return null;

    // Check the top result — if the name matches closely, it's likely right
    for (const user of users.slice(0, 3)) {
      const profileRes = await fetch(`${GITHUB_API}/users/${user.login}`, {
        headers: githubHeaders(),
      });
      if (!profileRes.ok) continue;

      const profile = await profileRes.json();
      const profileName = (profile.name || "").toLowerCase();
      const searchName = `${firstName} ${lastName}`.toLowerCase();

      if (profileName === searchName || profileName.includes(searchName)) {
        return { username: user.login, confidence: "medium" };
      }
    }

    return null;
  } catch {
    return null;
  }
}

async function tryUsernameGuesses(
  firstName: string,
  lastName: string
): Promise<GithubMatch | null> {
  const guesses = [
    `${firstName.toLowerCase()}${lastName.toLowerCase()}`,
    `${firstName[0].toLowerCase()}${lastName.toLowerCase()}`,
    `${firstName.toLowerCase()}-${lastName.toLowerCase()}`,
  ];

  for (const guess of guesses) {
    try {
      const res = await fetch(`${GITHUB_API}/users/${guess}`, {
        headers: githubHeaders(),
      });

      if (res.ok) {
        const profile = await res.json();
        const profileName = (profile.name || "").toLowerCase();
        const searchName = `${firstName} ${lastName}`.toLowerCase();

        // Only accept if the name on the profile matches
        if (profileName === searchName || profileName.includes(lastName.toLowerCase())) {
          return { username: guess, confidence: "low" };
        }
      }
    } catch {
      continue;
    }

    // Small delay between guesses
    await new Promise((r) => setTimeout(r, 200));
  }

  return null;
}

interface ContributedRepo {
  fullName: string;
  url: string;
  type: "commit" | "pr_merged" | "pr_open" | "issue";
  count: number;
  lastAt: string | null;
}

/**
 * Fetch repos a user contributes to. Uses Events API to find external contributions.
 */
export async function fetchContributedRepos(
  username: string
): Promise<ContributedRepo[]> {
  const cacheKey = `github_repos:${username}`;
  const cached = await getCached<ContributedRepo[]>(cacheKey);
  if (cached) return cached;

  const repos: Map<string, ContributedRepo> = new Map();

  try {
    // Method 1: User's own repos (only non-forks with some activity)
    const repoRes = await fetch(
      `${GITHUB_API}/users/${username}/repos?type=all&sort=pushed&per_page=30`,
      { headers: githubHeaders() }
    );

    if (repoRes.ok) {
      const repoData = await repoRes.json();
      for (const repo of repoData) {
        if (!repo.fork && repo.stargazers_count > 0) {
          repos.set(repo.full_name, {
            fullName: repo.full_name,
            url: repo.html_url,
            type: "commit",
            count: 1,
            lastAt: repo.pushed_at,
          });
        }
      }
    }

    // Small delay
    await new Promise((r) => setTimeout(r, 300));

    // Method 2: Events API — find external contributions (PRs, issues)
    const eventsRes = await fetch(
      `${GITHUB_API}/users/${username}/events?per_page=100`,
      { headers: githubHeaders() }
    );

    if (eventsRes.ok) {
      const events = await eventsRes.json();
      for (const event of events) {
        const repoName = event.repo?.name;
        if (!repoName) continue;

        // Skip own repos — we want external contributions
        if (repoName.startsWith(`${username}/`)) continue;

        const eventType =
          event.type === "PullRequestEvent"
            ? event.payload?.action === "opened"
              ? "pr_open"
              : "pr_merged"
            : event.type === "IssuesEvent"
              ? "issue"
              : event.type === "PushEvent"
                ? "commit"
                : null;

        if (!eventType) continue;

        const existing = repos.get(repoName);
        if (existing) {
          existing.count++;
          if (event.created_at && (!existing.lastAt || event.created_at > existing.lastAt)) {
            existing.lastAt = event.created_at;
          }
        } else {
          repos.set(repoName, {
            fullName: repoName,
            url: `https://github.com/${repoName}`,
            type: eventType as ContributedRepo["type"],
            count: 1,
            lastAt: event.created_at || null,
          });
        }
      }
    }
  } catch (err) {
    console.error(`[github] Failed to fetch repos for ${username}:`, err);
  }

  const result = Array.from(repos.values());
  if (result.length > 0) {
    await setCache(cacheKey, "github_repos", result);
  }

  return result;
}

/**
 * Fetch contributed repos for a target company person (for GitHub overlap detection).
 * Lighter version — just returns repo names.
 */
export async function fetchTargetPersonRepos(
  username: string
): Promise<string[]> {
  const cacheKey = `github_target_repos:${username}`;
  const cached = await getCached<string[]>(cacheKey);
  if (cached) return cached;

  const repoNames = new Set<string>();

  try {
    // Events API for external contributions
    const eventsRes = await fetch(
      `${GITHUB_API}/users/${username}/events?per_page=100`,
      { headers: githubHeaders() }
    );

    if (eventsRes.ok) {
      const events = await eventsRes.json();
      for (const event of events) {
        const repoName = event.repo?.name;
        if (repoName) repoNames.add(repoName);
      }
    }

    // Also owned repos
    const repoRes = await fetch(
      `${GITHUB_API}/users/${username}/repos?type=all&sort=pushed&per_page=30`,
      { headers: githubHeaders() }
    );

    if (repoRes.ok) {
      const repos = await repoRes.json();
      for (const repo of repos) {
        repoNames.add(repo.full_name);
      }
    }
  } catch {
    // Non-fatal
  }

  const result = Array.from(repoNames);
  if (result.length > 0) {
    await setCache(cacheKey, "github_repos", result);
  }

  return result;
}
