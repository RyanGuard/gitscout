import { prisma } from "@/lib/prisma";
import { syncOneUser } from "@/pipeline/github";

/**
 * Resolves a developer ID that may be a local DB ID (cuid) or a
 * GitHub-only synthetic ID (gh-{githubId}). If it's gh-XXXX and the
 * developer isn't indexed locally, auto-indexes them via the pipeline.
 *
 * Returns the local Prisma cuid.
 */
export async function resolveDeveloperId(developerId: string): Promise<string> {
  // If it doesn't look like a GitHub-only ID, return as-is
  const ghMatch = developerId.match(/^gh-(\d+)$/);
  if (!ghMatch) return developerId;

  const githubId = parseInt(ghMatch[1], 10);

  // Check if already indexed by githubId
  const existing = await prisma.developer.findUnique({
    where: { githubId },
    select: { id: true },
  });
  if (existing) return existing.id;

  // Not indexed — fetch username from GitHub and sync
  const headers: HeadersInit = {
    Accept: "application/vnd.github+json",
    "User-Agent": "GitScout/1.0",
  };
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  const res = await fetch(`https://api.github.com/user/${githubId}`, { headers });
  if (!res.ok) {
    throw new Error(`GitHub user ${githubId} not found (HTTP ${res.status})`);
  }

  const user = await res.json();
  const developer = await syncOneUser(user.login);
  if (!developer) {
    throw new Error(`Failed to index GitHub user ${user.login}`);
  }

  return developer.id;
}
