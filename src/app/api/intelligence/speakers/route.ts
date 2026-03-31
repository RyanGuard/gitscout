import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";

const APOLLO_API = "https://api.apollo.io/api/v1";
const GITHUB_API = "https://api.github.com";

interface Speaker {
  name: string;
  username?: string;
  title?: string;
  company?: string;
  source: "github" | "apollo";
  profileUrl: string;
  evidence: string;
}

/**
 * Search GitHub for repos that are conference talk repos.
 * Repo owners are often the speakers themselves.
 */
async function findGitHubSpeakers(keyword: string): Promise<Speaker[]> {
  const token = process.env.GITHUB_TOKEN;
  const headers: HeadersInit = {
    Accept: "application/vnd.github+json",
    "User-Agent": "Scout/1.0",
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const query = encodeURIComponent(
    `${keyword} conference talk slides in:readme`
  );
  const url = `${GITHUB_API}/search/repositories?q=${query}&sort=stars&per_page=10`;

  const res = await fetch(url, { headers });
  if (!res.ok) return [];

  const data = await res.json();
  const repos = data.items || [];

  // Deduplicate by owner login
  const seen = new Set<string>();
  const speakers: Speaker[] = [];

  for (const repo of repos) {
    const owner = repo.owner;
    if (!owner || seen.has(owner.login)) continue;
    seen.add(owner.login);

    // Fetch owner profile for name/company details
    let name = owner.login;
    let company: string | undefined;
    try {
      const userRes = await fetch(`${GITHUB_API}/users/${owner.login}`, {
        headers,
      });
      if (userRes.ok) {
        const user = await userRes.json();
        name = user.name || owner.login;
        company = user.company?.replace(/^@/, "") || undefined;
      }
    } catch {
      // Fall back to login as name
    }

    speakers.push({
      name,
      username: owner.login,
      company,
      source: "github",
      profileUrl: `https://github.com/${owner.login}`,
      evidence: `Owner of "${repo.full_name}" (${repo.stargazers_count} stars) — ${repo.description || "conference talk repo"}`,
    });
  }

  return speakers;
}

/**
 * Search Apollo for developer advocates, evangelists, and speakers
 * associated with a given technology or conference.
 */
async function findApolloSpeakers(keyword: string): Promise<Speaker[]> {
  const apiKey = process.env.APOLLO_API_KEY;
  if (!apiKey) return [];

  const titleKeywords = [
    "developer advocate",
    "developer relations",
    "evangelist",
    "developer experience",
    "speaker",
  ];

  const res = await fetch(`${APOLLO_API}/mixed_people/api_search`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Api-Key": apiKey,
    },
    body: JSON.stringify({
      q_keywords: keyword,
      person_titles: titleKeywords,
      page: 1,
      per_page: 15,
    }),
  });

  if (!res.ok) return [];

  const data = await res.json();
  const people = data.people || [];

  return people.map(
    (p: {
      first_name?: string;
      last_name?: string;
      title?: string;
      organization_name?: string;
      linkedin_url?: string;
      id?: string;
    }) => ({
      name: [p.first_name, p.last_name].filter(Boolean).join(" "),
      title: p.title || undefined,
      company: p.organization_name || undefined,
      source: "apollo" as const,
      profileUrl:
        p.linkedin_url || `https://api.apollo.io/people/${p.id || ""}`,
      evidence: `${p.title || "Speaker"} at ${p.organization_name || "Unknown"} — matched keyword "${keyword}"`,
    })
  );
}

/**
 * Deduplicate speakers from both sources by name similarity.
 * Prefers GitHub entries (they include a username) over Apollo ones.
 */
function deduplicateSpeakers(speakers: Speaker[]): Speaker[] {
  const seen = new Map<string, Speaker>();

  for (const speaker of speakers) {
    const key = speaker.name.toLowerCase().trim();
    const existing = seen.get(key);

    if (!existing) {
      seen.set(key, speaker);
    } else if (existing.source === "apollo" && speaker.source === "github") {
      // Prefer GitHub entry since it includes a username
      seen.set(key, speaker);
    }
  }

  return Array.from(seen.values());
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const technology = request.nextUrl.searchParams.get("technology");
  const conference = request.nextUrl.searchParams.get("conference");
  const keyword = technology || conference;

  if (!keyword) {
    return NextResponse.json(
      { error: "technology or conference query parameter is required" },
      { status: 400 }
    );
  }

  try {
    // Run both searches in parallel
    const [githubSpeakers, apolloSpeakers] = await Promise.all([
      findGitHubSpeakers(keyword),
      findApolloSpeakers(keyword),
    ]);

    const combined = [...githubSpeakers, ...apolloSpeakers];
    const speakers = deduplicateSpeakers(combined);

    return NextResponse.json({
      speakers,
      meta: {
        keyword,
        source: technology ? "technology" : "conference",
        githubResults: githubSpeakers.length,
        apolloResults: apolloSpeakers.length,
        totalAfterDedup: speakers.length,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Speaker discovery failed",
      },
      { status: 500 }
    );
  }
}
