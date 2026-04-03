import { getAuthUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const userId = await getAuthUserId(request);
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const STALE_ENRICH_MS = 12 * 60 * 1000;

  try {
    const owned = await prisma.marketMap.findFirst({
      where: { id, userId },
      select: { id: true },
    });
    if (!owned) {
      return Response.json({ error: "Map not found" }, { status: 404 });
    }

    // Vercel can kill enrich-company past maxDuration without running catch — rows stay "enriching" forever.
    try {
      await prisma.mapCompany.updateMany({
        where: {
          mapId: id,
          enrichmentStatus: "enriching",
          updatedAt: { lt: new Date(Date.now() - STALE_ENRICH_MS) },
        },
        data: {
          enrichmentStatus: "failed",
          enrichmentSubstatus: null,
          enrichmentError: "Enrichment timed out or was interrupted. Refresh the page to retry.",
        },
      });
    } catch (unlockErr) {
      console.warn("[market-map] Stale enrichment unlock skipped (schema not migrated yet?)", unlockErr);
    }

    const map = await prisma.marketMap.findFirst({
      where: { id, userId },
      include: {
        companies: {
          where: { hidden: false },
          include: {
            candidates: {
              orderBy: { fitScore: { sort: "desc", nulls: "last" } },
            },
          },
          orderBy: { tier: "asc" },
        },
      },
    });

    if (!map) {
      return Response.json({ error: "Map not found" }, { status: 404 });
    }

    // Group companies by tier
    const tiers: Record<string, typeof map.companies> = { A: [], B: [], C: [] };
    for (const co of map.companies) {
      if (tiers[co.tier]) {
        tiers[co.tier].push(co);
      }
    }

    const totalCandidates = map.companies.reduce((s, c) => s + c.candidates.length, 0);
    const openCandidates = map.companies.reduce(
      (s, c) => s + c.candidates.filter((p) => p.flightRisk === "high" || p.status === "mapped").length,
      0
    );
    const avgFitScore = totalCandidates > 0
      ? Math.round(
          map.companies.reduce(
            (s, c) => s + c.candidates.reduce((cs, p) => cs + (p.fitScore || 0), 0),
            0
          ) / totalCandidates
        )
      : 0;

    // Get hidden companies separately
    const hiddenCompanies = await prisma.mapCompany.findMany({
      where: { mapId: id, hidden: true },
      select: { id: true, companyName: true, companyDomain: true, tier: true },
    });

    // Pipeline summary
    const statusCounts: Record<string, number> = {};
    for (const co of map.companies) {
      for (const c of co.candidates) {
        statusCounts[c.status] = (statusCounts[c.status] || 0) + 1;
      }
    }

    return Response.json({
      id: map.id,
      name: map.name,
      roleTitle: map.roleTitle,
      roleLevel: map.roleLevel,
      roleStack: map.roleStack,
      geography: map.geography,
      status: map.status,
      createdAt: map.createdAt.toISOString(),
      tiers,
      hiddenCompanies,
      stats: {
        totalCompanies: map.companies.length,
        totalCandidates,
        openCandidates,
        avgFitScore,
        statusCounts,
      },
    });
  } catch (error) {
    console.error("[market-map] Failed to load map:", error);
    return Response.json({ error: "Failed to load map" }, { status: 500 });
  }
}
