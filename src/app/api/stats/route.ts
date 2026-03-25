import { prisma } from "@/lib/prisma";

export async function GET() {
  const [totalDevelopers, totalRepositories, lastSync] = await Promise.all([
    prisma.developer.count(),
    prisma.repository.count(),
    prisma.syncLog.findFirst({
      where: { status: "completed" },
      orderBy: { completedAt: "desc" },
    }),
  ]);

  return Response.json({
    totalDevelopers,
    totalRepositories,
    totalActivities: 0,
    lastSyncedAt: lastSync?.completedAt?.toISOString() ?? null,
  });
}
