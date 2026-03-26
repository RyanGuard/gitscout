import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
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
  } catch (error) {
    console.error("[stats] DB error:", error instanceof Error ? error.message : error);
    return Response.json({
      totalDevelopers: 0,
      totalRepositories: 0,
      totalActivities: 0,
      lastSyncedAt: null,
      error: "Database temporarily unavailable",
    });
  }
}
