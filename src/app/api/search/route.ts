import { prisma } from "@/lib/prisma";
import type { GitHubUser } from "@/types";

// ═══ POST — SSE Streaming Orchestrator (quick + deep in parallel) ═══
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const { roleCategory, language, location, minFollowers, minStars, query: freeText, perPage, page } = body;

  const encoder = new TextEncoder();
  const baseUrl = request.url.replace(/\/api\/search.*/, "");

  const stream = new ReadableStream({
    async start(controller) {
      function sendEvent(event: string, data: unknown) {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      }

      try {
        // --- Quick search (fast path, always runs) ---
        sendEvent("status", { message: "Running quick search..." });

        const quickRes = await fetch(`${baseUrl}/api/search/quick`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            language,
            location,
            minFollowers: minFollowers || 10,
            query: freeText,
            perPage: perPage || 30,
            page: page || 1,
          }),
        });

        if (quickRes.ok) {
          const quickData = await quickRes.json();
          sendEvent("quick_results", quickData);
        }

        // --- Deep search (quality path, runs if roleCategory specified) ---
        if (roleCategory) {
          sendEvent("deep_progress", { message: `Scanning ${roleCategory} contributors...`, progress: 0.1 });

          // 50s timeout to fit within Vercel's 60s function limit
          const deepController = new AbortController();
          const deepTimeout = setTimeout(() => deepController.abort(), 50000);

          const deepRes = await fetch(`${baseUrl}/api/search/deep`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              roleCategory,
              language,
              location,
              minStars,
              activeInDays: 90,
              maxResults: 50,
            }),
            signal: deepController.signal,
          }).finally(() => clearTimeout(deepTimeout));

          sendEvent("deep_progress", { message: "Enriching profiles and scoring...", progress: 0.6 });

          if (deepRes.ok) {
            const deepData = await deepRes.json();
            sendEvent("deep_results", deepData);
            sendEvent("complete", {
              quickCount: 0,
              deepCount: deepData.total_count,
              unicorns: deepData.meta?.unicorns || 0,
            });
          } else {
            sendEvent("complete", { quickCount: 0, deepCount: 0, unicorns: 0 });
          }
        } else {
          sendEvent("complete", { quickCount: 0, deepCount: 0, unicorns: 0 });
        }
      } catch (error) {
        sendEvent("error", { message: error instanceof Error ? error.message : "Search failed" });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

// Sanitize user input to prevent XSS in JSON responses
function sanitizeQuery(q: string): string {
  return q.replace(/[<>]/g, "").slice(0, 200);
}

// ═══ GET — Existing live GitHub search (kept for backward compat) ═══

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

// Known programming languages for extraction from natural language queries
const KNOWN_LANGUAGES = new Set([
  "javascript", "typescript", "python", "rust", "go", "golang", "java", "c", "c++",
  "c#", "csharp", "ruby", "php", "swift", "kotlin", "scala", "elixir", "haskell",
  "dart", "r", "lua", "zig", "perl", "shell", "bash", "sql", "html", "css",
  "objective-c", "clojure", "erlang", "fortran", "julia", "ocaml", "vue", "svelte",
]);

const LANGUAGE_ALIASES: Record<string, string> = {
  js: "javascript", ts: "typescript", golang: "go", "c#": "csharp",
  "c sharp": "csharp", node: "javascript", react: "javascript",
  "node.js": "javascript", nodejs: "javascript",
};

// Patterns that indicate location in natural language
const LOCATION_PATTERNS = [
  /\bin\s+(.+?)(?:\s+(?:who|that|with|and|looking|developers?|engineers?|devs?)|\s*$)/i,
  /\bfrom\s+(.+?)(?:\s+(?:who|that|with|and|looking|developers?|engineers?|devs?)|\s*$)/i,
  /\bbased\s+in\s+(.+?)(?:\s+(?:who|that|with|and)|\s*$)/i,
  /\blocated\s+in\s+(.+?)(?:\s+(?:who|that|with|and)|\s*$)/i,
];

// Known cities/locations for start-of-query detection (when no "in" prefix)
const KNOWN_LOCATIONS = [
  "san francisco", "sf", "bay area", "silicon valley", "new york", "nyc",
  "austin", "seattle", "los angeles", "la", "boston", "miami", "denver",
  "boulder", "portland", "chicago", "london", "berlin", "tel aviv",
  "bangalore", "toronto", "vancouver", "buenos aires", "sao paulo",
  "são paulo", "lagos", "kyiv", "warsaw", "remote",
];

// GitHub doesn't recognize informal location names — map to actual cities
const LOCATION_ALIASES: Record<string, string> = {
  "bay area": "San Francisco",
  "sf": "San Francisco",
  "silicon valley": "San Francisco",
  "nyc": "New York",
  "la": "Los Angeles",
  "socal": "Los Angeles",
  "norcal": "San Francisco",
  "dmv": "Washington",
  "dfw": "Dallas",
  "rdu": "Raleigh",
  "pnw": "Seattle",
};

// Role keywords → inferred languages (the key insight for quality results)
const ROLE_TO_LANGUAGES: Record<string, string[]> = {
  frontend: ["javascript", "typescript"],
  "front-end": ["javascript", "typescript"],
  "full-stack": ["javascript", "typescript"],
  fullstack: ["javascript", "typescript"],
  backend: ["go", "python", "java"],
  "back-end": ["go", "python", "java"],
  mobile: ["swift", "kotlin", "dart"],
  ios: ["swift"],
  android: ["kotlin", "java"],
  devops: ["go", "python"],
  infrastructure: ["go", "python"],
  infra: ["go", "python"],
  sre: ["go", "python"],
  ml: ["python"],
  "machine learning": ["python"],
  ai: ["python"],
  data: ["python"],
  "data science": ["python"],
  systems: ["rust", "c++"],
  embedded: ["c", "c++", "rust"],
  blockchain: ["rust", "solidity"],
  web3: ["rust", "solidity", "typescript"],
  security: ["python", "go", "c"],
  platform: ["go", "python", "java"],
};

// Role keywords → search terms to inject back into the GitHub query
// (so "frontend engineer" doesn't become empty after stripping role + filler words)
const ROLE_SEARCH_TERMS: Record<string, string> = {
  frontend: "frontend",
  "front-end": "frontend",
  fullstack: "fullstack",
  "full-stack": "fullstack",
  backend: "backend",
  "back-end": "backend",
  mobile: "mobile",
  ios: "ios",
  android: "android",
  devops: "devops",
  infrastructure: "infrastructure",
  infra: "infrastructure",
  sre: "sre",
  ml: "machine learning",
  "machine learning": "machine learning",
  ai: "artificial intelligence",
  data: "data",
  "data science": "data science",
  systems: "systems",
  embedded: "embedded",
  blockchain: "blockchain",
  web3: "web3",
  security: "security",
  platform: "platform",
};

// Words to strip from the query (not useful for GitHub search)
const FILLER_WORDS = new Set([
  "developers", "developer", "engineers", "engineer", "devs", "dev",
  "programmers", "programmer", "coders", "coder", "looking", "for",
  "find", "search", "show", "me", "the", "best", "top", "senior",
  "junior", "mid", "level", "experienced", "who", "that", "are",
  "with", "and", "or", "a", "an", "hiring", "staff", "principal",
  "lead", "head",
]);

// Parse a natural language search into structured GitHub query parts
function parseNaturalQuery(raw: string): {
  searchTerms: string[];
  languages: string[];
  location: string | null;
  roleDetected: string | null;
  roleSearchTerm: string | null;
  minFollowers: number;
} {
  let text = raw.trim();
  const languages: string[] = [];
  let location: string | null = null;
  let roleDetected: string | null = null;
  let minFollowers = 5; // default

  // Extract location from patterns like "in San Francisco", "from Berlin"
  for (const pattern of LOCATION_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      location = match[1].trim().replace(/[,.]$/, "").replace(/^the\s+/i, "");
      text = text.replace(match[0], " ").trim();
      break;
    }
  }

  // If no "in X" pattern found, check for known city names anywhere in the query
  if (!location) {
    const lowerForLoc = text.toLowerCase();
    for (const city of KNOWN_LOCATIONS) {
      if (lowerForLoc.includes(city)) {
        location = city;
        // Remove the city from the text
        text = text.replace(new RegExp(city, "gi"), " ").trim();
        break;
      }
    }
  }

  // Detect role keywords BEFORE tokenizing (check multi-word roles first)
  const lowerText = text.toLowerCase();
  for (const [role, roleLangs] of Object.entries(ROLE_TO_LANGUAGES)) {
    if (lowerText.includes(role)) {
      roleDetected = role;
      // Add inferred languages if no explicit ones found yet
      for (const lang of roleLangs) {
        if (!languages.includes(lang)) languages.push(lang);
      }
      // Role searches should have higher quality floor
      minFollowers = 50;
      text = text.replace(new RegExp(role, "gi"), " ").trim();
      break;
    }
  }

  // Tokenize remaining text and extract languages
  const words = text.toLowerCase().split(/\s+/);
  const remainingTerms: string[] = [];

  for (const word of words) {
    const clean = word.replace(/[,.:;!?]/g, "");
    const aliased = LANGUAGE_ALIASES[clean] || clean;

    if (KNOWN_LANGUAGES.has(aliased)) {
      if (!languages.includes(aliased)) languages.push(aliased);
    } else if (!FILLER_WORDS.has(clean) && clean.length > 1) {
      remainingTerms.push(clean);
    }
  }

  // If a role was detected, grab its search term so we can inject it back into the query
  const roleSearchTerm = roleDetected ? (ROLE_SEARCH_TERMS[roleDetected] || roleDetected) : null;

  return { searchTerms: remainingTerms, languages, location, roleDetected, roleSearchTerm, minFollowers };
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

  // Parse natural language from the main query
  const parsed = parseNaturalQuery(params.q);

  // Add remaining search terms — but NOT role keywords when we have location
  // (adding "platform" to a location+language query kills results on GitHub)
  if (parsed.searchTerms.length > 0) {
    parts.push(parsed.searchTerms.join(" "));
  } else if (parsed.roleSearchTerm && !parsed.location && !params.location) {
    // Role-only query with NO location — inject the keyword so GitHub has something
    parts.push(parsed.roleSearchTerm);
  }
  // When we have role + location, the language filter alone is sufficient
  // (e.g. "platform engineers in Bay Area" → language:go location:"San Francisco")

  // Merge languages: explicit filter + extracted from query
  const allLanguages = [
    ...(params.languages || []),
    ...parsed.languages,
  ];
  const uniqueLanguages = [...new Set(allLanguages)];
  if (uniqueLanguages.length > 0) {
    parts.push(`language:${uniqueLanguages[0]}`);
  }

  // Merge location: explicit filter takes priority, then extracted
  // Apply alias to convert informal names to GitHub-recognized cities
  const rawLoc = params.location || parsed.location;
  const loc = rawLoc ? (LOCATION_ALIASES[rawLoc.toLowerCase()] || rawLoc) : null;
  if (loc) {
    parts.push(`location:"${loc}"`);
  }

  if (params.minStars) {
    parts.push(`repos:>=${Math.max(1, Math.floor(params.minStars / 50))}`);
  }

  // Quality floor — lower when location is specified (smaller pools)
  // Role-only (no location): 50+ followers for quality
  // Role + location: 10+ followers to avoid missing good devs in smaller markets
  const followerFloor = loc ? Math.min(parsed.minFollowers, 10) : parsed.minFollowers;
  parts.push(`followers:>=${followerFloor}`);

  // Ensure we have enough query substance for GitHub to accept
  if (parsed.searchTerms.length === 0 && !loc && !parsed.roleSearchTerm) {
    parts.push("repos:>10");
  }

  // Filter out organizations — only return actual users
  parts.push("type:user");

  // If we have nothing useful, fall back to the raw query
  if (parts.length <= 1 && params.q) {
    parts.push(params.q);
  }

  return parts.join(" ");
}

// Quick surface score from REST API data only (no GraphQL needed)
// This is a fast estimate — full 5-pillar score comes after indexing
function quickScore(user: GitHubUser): { score: number; tier: string } {
  // Follower signal — logarithmic scale, no hard cap
  // 100 followers ≈ 3.6, 1K ≈ 5.6, 10K ≈ 7.4, 100K ≈ 9.3, 293K ≈ 10
  const followerSignal = Math.min(10, Math.log10(1 + user.followers) * 1.85);

  // Repo signal — having repos is good but not as important
  const repoSignal = Math.min(5, Math.log10(1 + user.public_repos) * 2.5);

  // Follower/following ratio — high ratio indicates genuine influence
  const ratio = user.following > 0 ? user.followers / user.following : Math.min(user.followers, 100);
  const ratioBonus = ratio >= 20 ? 2 : ratio >= 10 ? 1.5 : ratio >= 5 ? 1 : ratio >= 2 ? 0.5 : 0;

  // Profile completeness — bio, email, blog, hireable all signal engaged developer
  const profileBonus = (user.bio ? 0.5 : 0) + (user.email ? 0.3 : 0) + (user.blog ? 0.3 : 0) + (user.hireable ? 0.4 : 0);

  // Account age bonus — older accounts with high followers are more credible
  const accountAge = user.created_at
    ? (Date.now() - new Date(user.created_at).getTime()) / (365.25 * 24 * 60 * 60 * 1000)
    : 0;
  const ageBonus = accountAge >= 8 ? 1 : accountAge >= 5 ? 0.5 : 0;

  const raw = followerSignal * 4 + repoSignal * 2 + ratioBonus * 3 + profileBonus * 2 + ageBonus * 2;
  const score = Math.round(Math.min(100, raw) * 10) / 10;

  const tier = score >= 90 ? "Unicorn" : score >= 75 ? "On Fire" : score >= 60 ? "Gem" : score >= 40 ? "Seedling" : "Mystery";
  return { score, tier };
}

// Convert a raw GitHub user into our DeveloperProfile shape
function githubUserToProfile(user: GitHubUser) {
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
      query: sanitizeQuery(q),
    });
  }

  // --- 1. Query GitHub Search API live ---
  const ghQuery = buildGitHubQuery({ q, languages, location: location || undefined, minStars, hireable });

  const ghSort =
    sort === "stars" ? "repositories"
    : sort === "joined" ? "joined"
    : "followers"; // default: most followed first

  const ghParams = new URLSearchParams({
    q: ghQuery,
    per_page: String(limit),
    page: String(page),
  });
  if (ghSort) ghParams.set("sort", ghSort);

  let githubUsers: { login: string; id: number; avatar_url: string }[] = [];
  let githubTotal = 0;
  let warning: string | undefined;

  try {
    const res = await fetch(`${GITHUB_API}/search/users?${ghParams}`, {
      headers: githubHeaders(),
    });
    if (res.ok) {
      const data = await res.json();
      githubUsers = data.items || [];
      githubTotal = Math.min(data.total_count || 0, 1000);
    } else if (res.status === 403 || res.status === 429) {
      warning = "GitHub API rate limit reached. Results may be incomplete. Try again in a minute.";
      console.warn(`[search] GitHub rate limited: ${res.status}`);
    }
  } catch {
    warning = "GitHub search temporarily unavailable.";
  }

  // --- 2. Check which of these users we already have locally ---
  const githubIds = githubUsers.map((u) => u.id);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let localDevs: any[] = [];
  try {
    localDevs = githubIds.length > 0
      ? await prisma.developer.findMany({
          where: { githubId: { in: githubIds } },
          include: {
            languages: { orderBy: { percentage: "desc" }, take: 5 },
            repositories: { orderBy: { stars: "desc" }, take: 3 },
          },
        })
      : [];
  } catch (dbErr) {
    console.error("[search] Prisma query failed:", dbErr instanceof Error ? dbErr.message : dbErr);
    // Continue with GitHub-only results
  }

  const localByGithubId = new Map(localDevs.map((d) => [d.githubId, d]));

  // --- 3. Fetch full profiles from GitHub for users we DON'T have locally ---
  // With GITHUB_TOKEN we get 5000 req/hr — fetching 20-30 profiles per search is fine
  const unknownUsers = githubUsers.filter((u) => !localByGithubId.has(u.id));
  const profileFetches = unknownUsers.map(async (u) => {
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
        tier: local.score >= 90 ? "Unicorn" : local.score >= 75 ? "On Fire" : local.score >= 60 ? "Gem" : local.score >= 40 ? "Seedling" : "Mystery",
        languages: local.languages,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        repositories: local.repositories.map((r: any) => ({
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

    // Minimal profile — profile fetch failed (rate limit or error)
    // Don't fabricate scores — mark as unscored
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
      tier: "Unscored",
      languages: [] as { language: string; bytes: number; repoCount: number; percentage: number }[],
      repositories: [] as { id: string; name: string; fullName: string; description: string | null; language: string | null; stars: number; forks: number; topics: string[]; pushedAt: string | null }[],
      source: "github" as const,
    };
  });

  // --- 5. Filter out empty profiles (failed fetches) and sort ---
  const validDevelopers = developers.filter(
    (d) => d.name || d.followers > 0 || d.publicRepos > 0 || d.source === "local"
  );

  // Only re-sort by score when user selected "score" sort (or default)
  // For followers/stars/joined, GitHub already sorted by that — preserve order
  if (sort === "score") {
    validDevelopers.sort((a, b) => (b.score || 0) - (a.score || 0));
  }

  return Response.json({
    developers: validDevelopers,
    total: githubTotal,
    page,
    totalPages: Math.ceil(githubTotal / limit),
    query: sanitizeQuery(q),
    ...(warning ? { warning } : {}),
  }, {
    headers: {
      // Cache for 2 minutes on CDN — same search within 2min returns cached
      "Cache-Control": "public, s-maxage=120, stale-while-revalidate=300",
    },
  });
}
