import { prisma } from "@/lib/prisma";
import { syncDevelopers } from "@/pipeline/github";

const STALE_DAYS = 7;
const MAX_PER_RUN = 50;

export async function resyncStaleDevelopers() {
  const staleDate = new Date();
  staleDate.setDate(staleDate.getDate() - STALE_DAYS);

  const staleDevelopers = await prisma.developer.findMany({
    where: { syncedAt: { lt: staleDate } },
    select: { username: true },
    orderBy: { syncedAt: "asc" },
    take: MAX_PER_RUN,
  });

  if (staleDevelopers.length === 0) {
    return { synced: 0, errors: 0, staleRemaining: 0 };
  }

  const usernames = staleDevelopers.map((d) => d.username);
  const result = await syncDevelopers({ usernames });

  const staleRemaining = await prisma.developer.count({
    where: { syncedAt: { lt: staleDate } },
  });

  return { ...result, staleRemaining };
}
