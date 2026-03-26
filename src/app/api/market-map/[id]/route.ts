import { prisma } from "@/lib/prisma";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const map = await prisma.marketMap.findUnique({
    where: { id },
    include: {
      companies: {
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
    stats: {
      totalCompanies: map.companies.length,
      totalCandidates,
      openCandidates,
      avgFitScore,
    },
  });
}
