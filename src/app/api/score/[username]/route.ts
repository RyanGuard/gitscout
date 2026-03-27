import { prisma } from "@/lib/prisma";
import { computeScore } from "@/lib/scoring";
import { fetchContributions } from "@/pipeline/graphql";
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

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;

  try {
  // Fetch fresh data from GitHub for accurate scoring
  const [userRes, reposRes] = await Promise.all([
    fetch(`${GITHUB_API}/users/${username}`, { headers: githubHeaders() }),
    fetch(`${GITHUB_API}/users/${username}/repos?per_page=100&sort=stars&direction=desc`, {
      headers: githubHeaders(),
    }),
  ]);

  if (!userRes.ok) {
    if (userRes.status === 429 || userRes.status === 403) {
      return Response.json(
        { error: "GitHub API rate limit exceeded. Try again in a few minutes." },
        { status: 429 }
      );
    }
    return Response.json({ error: "Developer not found on GitHub" }, { status: 404 });
  }

  const user: GitHubUser = await userRes.json();
  const repos: GitHubRepo[] = reposRes.ok ? await reposRes.json() : [];

  // Fetch deep signals (GraphQL + merged PR search + package data)
  const [contributions, npmData] = await Promise.all([
    fetchContributions(username),
    // Direct npm registry check (no self-referential API call)
    fetch(`https://registry.npmjs.org/-/v1/search?text=maintainer:${username}&size=5`)
      .then(r => r.ok ? r.json() : null)
      .catch(() => null),
  ]);

  // Build package data for scoring from npm results
  let packages = null;
  if (npmData?.objects?.length > 0) {
    let totalDownloads = 0;
    for (const obj of npmData.objects.slice(0, 5)) {
      const pkgName = obj.package?.name;
      if (pkgName) {
        const dlRes = await fetch(`https://api.npmjs.org/downloads/point/last-month/${pkgName}`).then(r => r.ok ? r.json() : null).catch(() => null);
        if (dlRes?.downloads) totalDownloads += dlRes.downloads;
      }
    }
    packages = { totalDownloads, packageCount: npmData.objects.length };
  }

  // Compute full 5-pillar score
  const result = computeScore({ user, repos, contributions, packages });

  // Also update local DB if developer is indexed
  const local = await prisma.developer.findUnique({
    where: { username },
    select: { id: true },
  });

  if (local) {
    await prisma.developer.update({
      where: { id: local.id },
      data: {
        score: result.score,
        totalCommits: result.totalCommits,
        recentActivity: result.recentActivity,
        languageDiversity: result.languageDiversity,
        avgRepoQuality: result.avgRepoQuality,
      },
    });
  }

  return Response.json({
    username,
    score: result.score,
    tier: result.tier,
    confidence: result.confidence,
    confidenceValue: result.confidenceValue,
    externalMergedPRs: result.externalMergedPRs,
    totalCommits: result.totalCommits,
    recentActivity: result.recentActivity,
    pillars: {
      impact: { score: result.impactScore, max: 10, label: "Impact", description: "Stars, forks, and community validation" },
      contribution: { score: result.contributionScore, max: 10, label: "Contribution Quality", description: "Merged PRs to external repos, code reviews" },
      consistency: { score: result.consistencyScore, max: 10, label: "Consistency", description: "Activity regularity and recency" },
      technical: { score: result.technicalScore, max: 10, label: "Technical Depth", description: "Language breadth, repo complexity" },
      reputation: { score: result.reputationScore, max: 10, label: "Reputation", description: "Followers, community standing" },
    },
  }, {
    headers: {
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
    },
  });
  } catch (error) {
    console.error("[score] Error:", error instanceof Error ? error.message : error);
    return Response.json(
      { error: "Failed to compute score. Try again." },
      { status: 500 }
    );
  }
}
