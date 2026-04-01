import { getAuthUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { safeErrorMessage } from "@/lib/api-error";

export async function GET(request: Request) {
  const userId = await getAuthUserId(request);
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const maps = await prisma.marketMap.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      include: {
        companies: {
          where: { hidden: false },
          select: {
            id: true,
            tier: true,
            _count: { select: { candidates: true } },
          },
        },
      },
      take: 20,
    });

    const results = maps.map((m) => {
      const totalCandidates = m.companies.reduce((s, c) => s + c._count.candidates, 0);
      const daysSinceUpdate = Math.floor((Date.now() - m.updatedAt.getTime()) / 86400000);

      return {
        id: m.id,
        name: m.name,
        roleTitle: m.roleTitle,
        roleLevel: m.roleLevel,
        status: daysSinceUpdate > 14 ? "stale" : m.status,
        companyCount: m.companies.length,
        candidateCount: totalCandidates,
        tierBreakdown: {
          A: m.companies.filter((c) => c.tier === "A").length,
          B: m.companies.filter((c) => c.tier === "B").length,
          C: m.companies.filter((c) => c.tier === "C").length,
        },
        createdAt: m.createdAt.toISOString(),
        updatedAt: m.updatedAt.toISOString(),
        daysSinceUpdate,
      };
    });

    return Response.json({ maps: results });
  } catch (error) {
    console.error("[market-map/list] Failed:", error);
    return Response.json({ error: safeErrorMessage(error, "Failed to load maps") }, { status: 500 });
  }
}
