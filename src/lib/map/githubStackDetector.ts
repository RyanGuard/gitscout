import { FRAMEWORK_MAP, TOOL_MAP } from "@/lib/jd-parser";
import { generateBoardSlugs } from "./slugGenerator";

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

export interface GitHubStackResult {
  orgName: string;
  repoCount: number;
  languages: Record<string, number>;
  frameworks: string[];
  tools: string[];
}

interface Repo {
  name: string;
  full_name: string;
  fork: boolean;
  archived: boolean;
  stargazers_count: number;
  language: string | null;
}

const FRAMEWORK_KEYS = Object.keys(FRAMEWORK_MAP);
const TOOL_KEYS = Object.keys(TOOL_MAP);

function matchDeps(depNames: string[]): { frameworks: string[]; tools: string[] } {
  const frameworks = new Set<string>();
  const tools = new Set<string>();

  for (const dep of depNames) {
    const lower = dep.toLowerCase().replace(/[^a-z0-9.]/g, "");
    for (const key of FRAMEWORK_KEYS) {
      if (lower.includes(key)) {
        frameworks.add(FRAMEWORK_MAP[key]);
        break;
      }
    }
    for (const key of TOOL_KEYS) {
      if (lower.includes(key)) {
        tools.add(TOOL_MAP[key]);
        break;
      }
    }
  }

  return { frameworks: Array.from(frameworks), tools: Array.from(tools) };
}

async function fetchDepFile(
  org: string,
  repo: string,
  path: string,
  headers: HeadersInit
): Promise<string | null> {
  try {
    const res = await fetch(`${GITHUB_API}/repos/${org}/${repo}/contents/${path}`, {
      headers,
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.encoding === "base64" && data.content) {
      return Buffer.from(data.content, "base64").toString("utf-8");
    }
    return null;
  } catch {
    return null;
  }
}

function parsePackageJson(content: string): string[] {
  try {
    const pkg = JSON.parse(content);
    return [
      ...Object.keys(pkg.dependencies || {}),
      ...Object.keys(pkg.devDependencies || {}),
    ];
  } catch {
    return [];
  }
}

function parseGoMod(content: string): string[] {
  const requireBlock = content.match(/require\s*\(([\s\S]*?)\)/);
  if (!requireBlock) return [];
  return requireBlock[1]
    .split("\n")
    .map((line) => line.trim().split(/\s+/)[0])
    .filter(Boolean);
}

function parseGemfile(content: string): string[] {
  return content
    .split("\n")
    .filter((line) => line.match(/^\s*gem\s+['"]/))
    .map((line) => {
      const match = line.match(/gem\s+['"]([^'"]+)['"]/);
      return match ? match[1] : "";
    })
    .filter(Boolean);
}

function parseRequirementsTxt(content: string): string[] {
  return content
    .split("\n")
    .map((line) => line.trim().split(/[>=<!\s]/)[0])
    .filter((name) => name && !name.startsWith("#") && !name.startsWith("-"));
}

function parseCargoToml(content: string): string[] {
  const deps: string[] = [];
  const depSection = content.match(/\[dependencies\]([\s\S]*?)(\[|$)/);
  if (depSection) {
    depSection[1].split("\n").forEach((line) => {
      const match = line.match(/^(\w[\w-]*)\s*=/);
      if (match) deps.push(match[1]);
    });
  }
  return deps;
}

function parsePomXml(content: string): string[] {
  const matches = content.matchAll(/<artifactId>([^<]+)<\/artifactId>/g);
  return Array.from(matches).map((m) => m[1]);
}

const DEP_FILES: Array<{
  path: string;
  parser: (content: string) => string[];
}> = [
  { path: "package.json", parser: parsePackageJson },
  { path: "go.mod", parser: parseGoMod },
  { path: "Gemfile", parser: parseGemfile },
  { path: "requirements.txt", parser: parseRequirementsTxt },
  { path: "Cargo.toml", parser: parseCargoToml },
  { path: "pom.xml", parser: parsePomXml },
];

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Detects a company's tech stack by probing their GitHub org.
 */
export async function detectGitHubStack(
  companyName: string,
  companyDomain: string
): Promise<GitHubStackResult | null> {
  const headers = githubHeaders();
  const slugs = generateBoardSlugs(companyName, companyDomain);

  // Find the org
  let orgName: string | null = null;
  for (const slug of slugs) {
    try {
      const res = await fetch(`${GITHUB_API}/orgs/${slug}`, {
        headers,
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) {
        const data = await res.json();
        orgName = data.login;
        break;
      }
    } catch {
      continue;
    }
  }

  if (!orgName) return null;

  // Fetch repos
  let repos: Repo[] = [];
  try {
    const res = await fetch(
      `${GITHUB_API}/orgs/${orgName}/repos?sort=pushed&per_page=30`,
      { headers, signal: AbortSignal.timeout(10000) }
    );
    if (!res.ok) return null;
    repos = await res.json();

    // Check rate limit
    const remaining = parseInt(res.headers.get("x-ratelimit-remaining") || "100");
    if (remaining < 10) {
      return { orgName, repoCount: repos.length, languages: {}, frameworks: [], tools: [] };
    }
  } catch {
    return null;
  }

  // Filter out forks and archived
  const activeRepos = repos.filter((r) => !r.fork && !r.archived);
  const topByStars = [...activeRepos].sort((a, b) => b.stargazers_count - a.stargazers_count);

  // Aggregate language stats from top 10
  const languageStats: Record<string, number> = {};
  const langRepos = topByStars.slice(0, 10);
  for (const repo of langRepos) {
    try {
      const res = await fetch(`${GITHUB_API}/repos/${orgName}/${repo.name}/languages`, {
        headers,
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) {
        const langs: Record<string, number> = await res.json();
        for (const [lang, bytes] of Object.entries(langs)) {
          languageStats[lang] = (languageStats[lang] || 0) + bytes;
        }
      }
      const remaining = parseInt(res.headers.get("x-ratelimit-remaining") || "100");
      if (remaining < 10) break;
      await delay(200);
    } catch {
      continue;
    }
  }

  // Parse dependency files from top 5
  const allFrameworks = new Set<string>();
  const allTools = new Set<string>();
  const depRepos = topByStars.slice(0, 5);

  for (const repo of depRepos) {
    for (const { path, parser } of DEP_FILES) {
      const content = await fetchDepFile(orgName, repo.name, path, headers);
      if (content) {
        const depNames = parser(content);
        const matched = matchDeps(depNames);
        matched.frameworks.forEach((f) => allFrameworks.add(f));
        matched.tools.forEach((t) => allTools.add(t));
        break; // one dep file per repo is enough
      }
    }
    await delay(200);
  }

  return {
    orgName,
    repoCount: activeRepos.length,
    languages: languageStats,
    frameworks: Array.from(allFrameworks),
    tools: Array.from(allTools),
  };
}
