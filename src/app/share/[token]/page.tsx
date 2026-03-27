import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { SharedMapView } from "@/components/map/SharedMapView";

interface Props {
  params: Promise<{ token: string }>;
}

export default async function SharedMapPage({ params }: Props) {
  const { token } = await params;

  const share = await prisma.mapShare.findUnique({
    where: { shareToken: token },
    include: {
      user: { select: { name: true, image: true } },
    },
  });

  if (!share) notFound();

  const expired = share.expiresAt && new Date(share.expiresAt) < new Date();
  if (expired) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-2">Link Expired</h1>
          <p className="text-neutral-400">
            This shared map link has expired. Ask the recruiter for a new link.
          </p>
        </div>
      </div>
    );
  }

  // Increment view count
  await prisma.mapShare.update({
    where: { id: share.id },
    data: {
      viewCount: { increment: 1 },
      lastViewedAt: new Date(),
    },
  });

  // Fetch map data
  const map = await prisma.marketMap.findUnique({
    where: { id: share.mapId },
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

  if (!map) notFound();

  // Build tier data based on permission level
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tiers: Record<string, Record<string, any>[]> = { A: [], B: [], C: [] };

  for (const co of map.companies) {
    if (share.permissionLevel === "overview") {
      const candidateCount = co.candidates.length;
      const avgFit =
        candidateCount > 0
          ? Math.round(
              co.candidates.reduce((s, c) => s + (c.fitScore || 0), 0) /
                candidateCount
            )
          : 0;
      const highFlightRisk = co.candidates.filter(
        (c) => c.flightRisk === "high"
      ).length;

      tiers[co.tier]?.push({
        id: co.id,
        companyName: co.companyName,
        companyDomain: co.companyDomain,
        tier: co.tier,
        headcount: co.headcount,
        hqCity: co.hqCity,
        hqCountry: co.hqCountry,
        fundingStage: co.fundingStage,
        growthRate: co.growthRate,
        enrichmentStatus: co.enrichmentStatus,
        flightRiskCompany: co.flightRiskCompany,
        candidateCount,
        avgFitScore: avgFit,
        highFlightRiskCount: highFlightRisk,
      });
    } else {
      const sanitizedCandidates = co.candidates.map((c) => ({
        id: c.id,
        name: c.name,
        title: c.title,
        seniority: c.seniority,
        city: c.city,
        state: c.state,
        linkedinUrl: c.linkedinUrl,
        fitScore: c.fitScore,
        fitReasoning: c.fitReasoning,
        flightRisk: c.flightRisk,
        flightRiskSignals: c.flightRiskSignals,
        tenureMonths: c.tenureMonths,
        gitscoutScore: c.gitscoutScore,
      }));

      tiers[co.tier]?.push({
        id: co.id,
        companyName: co.companyName,
        companyDomain: co.companyDomain,
        tier: co.tier,
        headcount: co.headcount,
        engHeadcount: co.engHeadcount,
        hqCity: co.hqCity,
        hqCountry: co.hqCountry,
        fundingStage: co.fundingStage,
        growthRate: co.growthRate,
        techStack: co.techStack,
        flightRiskCompany: co.flightRiskCompany,
        enrichmentStatus: co.enrichmentStatus,
        candidates: sanitizedCandidates,
      });
    }
  }

  const totalCandidates = map.companies.reduce(
    (s, c) => s + c.candidates.length,
    0
  );
  const avgFitScore =
    totalCandidates > 0
      ? Math.round(
          map.companies.reduce(
            (s, c) =>
              s + c.candidates.reduce((cs, p) => cs + (p.fitScore || 0), 0),
            0
          ) / totalCandidates
        )
      : 0;

  const statusCounts: Record<string, number> = {};
  for (const co of map.companies) {
    for (const c of co.candidates) {
      statusCounts[c.status] = (statusCounts[c.status] || 0) + 1;
    }
  }

  const data = {
    permissionLevel: share.permissionLevel,
    sharedBy: share.user.name || "A Scout recruiter",
    expiresAt: share.expiresAt?.toISOString() || null,
    map: {
      name: map.name,
      roleTitle: map.roleTitle,
      roleLevel: map.roleLevel,
      roleStack: map.roleStack,
      geography: map.geography,
      tiers,
      stats: {
        totalCompanies: map.companies.length,
        totalCandidates,
        avgFitScore,
        statusCounts,
      },
    },
  };

  return <SharedMapView data={data} />;
}
