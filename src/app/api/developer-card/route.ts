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

function getTierEmoji(score: number): string {
  if (score >= 90) return "\u{1F984}"; // unicorn
  if (score >= 75) return "\u{1F525}"; // fire
  if (score >= 60) return "\u{1F48E}"; // gem
  if (score >= 40) return "\u{1F331}"; // seedling
  return "\u{1F32B}\u{FE0F}"; // mystery
}

function formatNumber(num: number): string {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toString();
}

const LANGUAGE_COLORS: Record<string, string> = {
  TypeScript: "#3178c6",
  JavaScript: "#f1e05a",
  Python: "#3572A5",
  Rust: "#dea584",
  Go: "#00ADD8",
  Java: "#b07219",
  "C++": "#f34b7d",
  C: "#555555",
  Ruby: "#701516",
  PHP: "#4F5D95",
  Swift: "#F05138",
  Kotlin: "#A97BFF",
  Scala: "#c22d40",
  Shell: "#89e051",
  Dart: "#00B4AB",
  Elixir: "#6e4a7e",
  Haskell: "#5e5086",
  Lua: "#000080",
  R: "#198CE7",
  Vue: "#41b883",
  Svelte: "#ff3e00",
  Zig: "#ec915c",
};

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

interface CardData {
  username: string;
  name: string | null;
  avatarUrl: string;
  location: string | null;
  score: number;
  totalStars: number;
  followers: number;
  publicRepos: number;
  createdAt: string | null;
  languages: { language: string; percentage: number }[];
}

function buildSvg(data: CardData): string {
  const {
    username,
    name,
    avatarUrl,
    location,
    score,
    totalStars,
    followers,
    publicRepos,
    createdAt,
    languages,
  } = data;

  const displayName = escapeXml(name || username);
  const tierEmoji = getTierEmoji(score);
  const joinYear = createdAt ? new Date(createdAt).getFullYear() : null;

  // Build language bars (top 3)
  const topLangs = languages.slice(0, 3);
  const langBars = topLangs
    .map((lang, i) => {
      const y = 340 + i * 60;
      const color = LANGUAGE_COLORS[lang.language] || "#8b8b8b";
      const pct = Math.round(lang.percentage);
      const barWidth = Math.max(20, (pct / 100) * 500);
      const langName = escapeXml(lang.language);
      return `
      <text x="80" y="${y}" fill="#a3a3a3" font-size="22" font-family="system-ui, -apple-system, sans-serif">${langName}</text>
      <rect x="280" y="${y - 18}" width="500" height="24" rx="6" fill="#262626"/>
      <rect x="280" y="${y - 18}" width="${barWidth}" height="24" rx="6" fill="${color}"/>
      <text x="800" y="${y}" fill="#737373" font-size="20" font-family="system-ui, -apple-system, sans-serif">${pct}%</text>`;
    })
    .join("");

  // Stats row y position
  const statsY = 270;

  return `<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <clipPath id="avatar-clip">
      <circle cx="140" cy="130" r="55"/>
    </clipPath>
    <linearGradient id="bg-grad" x1="0" y1="0" x2="1200" y2="630" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#0a0a0a"/>
      <stop offset="100%" stop-color="#141414"/>
    </linearGradient>
    <linearGradient id="accent" x1="0" y1="0" x2="300" y2="0" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#8b5cf6"/>
      <stop offset="100%" stop-color="#3b82f6"/>
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="1200" height="630" fill="url(#bg-grad)"/>

  <!-- Subtle border -->
  <rect x="1" y="1" width="1198" height="628" rx="16" fill="none" stroke="#262626" stroke-width="2"/>

  <!-- Top accent line -->
  <rect x="40" y="30" width="200" height="3" rx="1.5" fill="url(#accent)"/>

  <!-- Avatar -->
  <image href="${escapeXml(avatarUrl)}" x="85" y="75" width="110" height="110" clip-path="url(#avatar-clip)"/>
  <circle cx="140" cy="130" r="55" fill="none" stroke="#404040" stroke-width="2"/>

  <!-- Name & Username -->
  <text x="220" y="115" fill="#ffffff" font-size="36" font-weight="700" font-family="system-ui, -apple-system, sans-serif">${displayName}</text>
  <text x="220" y="150" fill="#737373" font-size="22" font-family="system-ui, -apple-system, sans-serif">@${escapeXml(username)}</text>
  ${location ? `<text x="220" y="180" fill="#a3a3a3" font-size="20" font-family="system-ui, -apple-system, sans-serif">\u{1F4CD} ${escapeXml(location)}</text>` : ""}

  <!-- Score -->
  <text x="1050" y="100" fill="#ffffff" font-size="48" font-weight="700" font-family="system-ui, -apple-system, sans-serif" text-anchor="middle">${score}</text>
  <text x="1050" y="130" fill="#a3a3a3" font-size="18" font-family="system-ui, -apple-system, sans-serif" text-anchor="middle">${tierEmoji} Score</text>

  <!-- Divider -->
  <line x1="80" y1="220" x2="1120" y2="220" stroke="#262626" stroke-width="1"/>

  <!-- Stats row -->
  <text x="80" y="${statsY}" fill="#fbbf24" font-size="22" font-family="system-ui, -apple-system, sans-serif">\u{2B50} ${formatNumber(totalStars)}</text>
  <text x="280" y="${statsY}" fill="#60a5fa" font-size="22" font-family="system-ui, -apple-system, sans-serif">\u{1F465} ${formatNumber(followers)}</text>
  <text x="480" y="${statsY}" fill="#a78bfa" font-size="22" font-family="system-ui, -apple-system, sans-serif">\u{1F4C2} ${publicRepos} repos</text>
  ${joinYear ? `<text x="720" y="${statsY}" fill="#737373" font-size="22" font-family="system-ui, -apple-system, sans-serif">\u{1F4C5} Since ${joinYear}</text>` : ""}

  <!-- Divider -->
  <line x1="80" y1="300" x2="1120" y2="300" stroke="#262626" stroke-width="1"/>

  <!-- Language bars -->
  ${langBars}

  <!-- Bottom branding -->
  <line x1="80" y1="560" x2="1120" y2="560" stroke="#262626" stroke-width="1"/>
  <text x="80" y="595" fill="#525252" font-size="20" font-weight="600" font-family="system-ui, -apple-system, sans-serif">Scout</text>
  <text x="220" y="595" fill="#404040" font-size="18" font-family="system-ui, -apple-system, sans-serif">gitscout.dev</text>
</svg>`;
}

async function fetchDeveloperData(username: string): Promise<CardData | null> {
  // Try local DB first
  const local = await prisma.developer.findUnique({
    where: { username },
    include: {
      languages: { orderBy: { percentage: "desc" }, take: 3 },
    },
  });

  if (local) {
    return {
      username: local.username,
      name: local.name,
      avatarUrl:
        local.avatarUrl || `https://github.com/${local.username}.png`,
      location: local.location,
      score: local.score,
      totalStars: local.totalStars,
      followers: local.followers,
      publicRepos: local.publicRepos,
      createdAt: local.createdAt?.toISOString() ?? null,
      languages: local.languages.map((l) => ({
        language: l.language,
        percentage: l.percentage,
      })),
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

  // Compute language stats
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
    .sort((a, b) => b.percentage - a.percentage)
    .slice(0, 3);

  const totalStars = nonFork.reduce((s, r) => s + r.stargazers_count, 0);

  return {
    username: user.login,
    name: user.name,
    avatarUrl: user.avatar_url,
    location: user.location,
    score: 0,
    totalStars,
    followers: user.followers,
    publicRepos: user.public_repos,
    createdAt: user.created_at,
    languages,
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const username = searchParams.get("username");

  if (!username) {
    return new Response("Missing username parameter", { status: 400 });
  }

  const data = await fetchDeveloperData(username);
  if (!data) {
    return new Response("Developer not found", { status: 404 });
  }

  const svg = buildSvg(data);

  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
