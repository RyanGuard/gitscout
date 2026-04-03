import { getAuthUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const userId = await getAuthUserId(request);
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const maps = await prisma.marketMap.findMany({
      where: { userId },
      include: {
        companies: {
          where: { hidden: false },
          include: {
            candidates: {
              select: {
                id: true,
                status: true,
                fitScore: true,
                flightRisk: true,
                outreachStatus: true,
              },
            },
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    const mapSummaries = maps.map((map) => {
      const allCandidates = map.companies.flatMap((c) => c.candidates);
      const statusCounts: Record<string, number> = {};
      for (const c of allCandidates) {
        statusCounts[c.status] = (statusCounts[c.status] || 0) + 1;
      }
      const avgFit =
        allCandidates.length > 0
          ? Math.round(
              allCandidates.reduce((s, c) => s + (c.fitScore || 0), 0) /
                allCandidates.length
            )
          : 0;

      return {
        id: map.id,
        name: map.name,
        roleTitle: map.roleTitle,
        status: map.status,
        createdAt: map.createdAt.toISOString(),
        updatedAt: map.updatedAt.toISOString(),
        totalCompanies: map.companies.length,
        totalCandidates: allCandidates.length,
        avgFitScore: avgFit,
        statusCounts,
        inPipeline:
          allCandidates.filter(
            (c) => c.status !== "mapped" && c.status !== "rejected"
          ).length,
      };
    });

    // Aggregate stats
    const totalCandidates = mapSummaries.reduce(
      (s, m) => s + m.totalCandidates,
      0
    );
    const totalInPipeline = mapSummaries.reduce(
      (s, m) => s + m.inPipeline,
      0
    );

    const allStatusCounts: Record<string, number> = {};
    for (const m of mapSummaries) {
      for (const [key, val] of Object.entries(m.statusCounts)) {
        allStatusCounts[key] = (allStatusCounts[key] || 0) + val;
      }
    }

    const contacted = allStatusCounts["contacted"] || 0;
    const responded = allStatusCounts["responded"] || 0;
    const responseRate =
      contacted + responded > 0
        ? Math.round((responded / (contacted + responded)) * 100)
        : 0;

    return Response.json({
      aggregate: {
        activeMaps: mapSummaries.filter((m) => m.status === "ready").length,
        totalCandidates,
        inPipeline: totalInPipeline,
        responseRate,
        statusCounts: allStatusCounts,
      },
      maps: mapSummaries,
    });
  } catch (error) {
    console.error("[dashboard] Failed to load dashboard:", error);
    return Response.json({ error: "Failed to load dashboard" }, { status: 500 });
  }
}
