import { prisma } from "@/lib/prisma";

// Simple in-memory rate limiter: 10 requests per minute per token
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(token: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(token);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(token, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (entry.count >= 10) return false;
  entry.count++;
  return true;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  if (!checkRateLimit(token)) {
    return Response.json(
      { error: "Too many requests. Try again in a minute." },
      { status: 429 }
    );
  }

  const share = await prisma.mapShare.findUnique({
    where: { shareToken: token },
    include: {
      user: { select: { name: true, image: true } },
    },
  });

  if (!share) {
    return Response.json({ error: "Share link not found" }, { status: 404 });
  }

  // Check expiration
  if (share.expiresAt && new Date(share.expiresAt) < new Date()) {
    return Response.json({ error: "This share link has expired" }, { status: 410 });
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

  if (!map) {
    return Response.json({ error: "Map no longer exists" }, { status: 404 });
  }

  // Group companies by tier
  const tiers: Record<string, unknown[]> = { A: [], B: [], C: [] };

  for (const co of map.companies) {
    if (share.permissionLevel === "overview") {
      // Overview: company-level only, no candidate names
      const candidateCount = co.candidates.length;
      const avgFit = candidateCount > 0
        ? Math.round(co.candidates.reduce((s, c) => s + (c.fitScore || 0), 0) / candidateCount)
        : 0;
      const highFlightRisk = co.candidates.filter((c) => c.flightRisk === "high").length;

      if (tiers[co.tier]) {
        tiers[co.tier].push({
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
      }
    } else {
      // Full: include candidates but strip emails/phones and internal outreach data
      const sanitizedCandidates = co.candidates.map((c) => ({
        id: c.id,
        name: c.name,
        firstName: c.firstName,
        lastName: c.lastName,
        title: c.title,
        seniority: c.seniority,
        city: c.city,
        state: c.state,
        country: c.country,
        linkedinUrl: c.linkedinUrl,
        headline: c.headline,
        fitScore: c.fitScore,
        fitReasoning: c.fitReasoning,
        flightRisk: c.flightRisk,
        flightRiskSignals: c.flightRiskSignals,
        tenureMonths: c.tenureMonths,
        gitscoutScore: c.gitscoutScore,
        // Never share: email, phone, status, outreachStatus
      }));

      if (tiers[co.tier]) {
        tiers[co.tier].push({
          id: co.id,
          companyName: co.companyName,
          companyDomain: co.companyDomain,
          tier: co.tier,
          headcount: co.headcount,
          engHeadcount: co.engHeadcount,
          hqCity: co.hqCity,
          hqCountry: co.hqCountry,
          fundingStage: co.fundingStage,
          fundingAmount: co.fundingAmount,
          growthRate: co.growthRate,
          techStack: co.techStack,
          flightRiskCompany: co.flightRiskCompany,
          enrichmentStatus: co.enrichmentStatus,
          candidates: sanitizedCandidates,
        });
      }
    }
  }

  // Compute stats
  const totalCandidates = map.companies.reduce((s, c) => s + c.candidates.length, 0);
  const avgFitScore = totalCandidates > 0
    ? Math.round(
        map.companies.reduce(
          (s, c) => s + c.candidates.reduce((cs, p) => cs + (p.fitScore || 0), 0),
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

  return Response.json({
    permissionLevel: share.permissionLevel,
    sharedBy: share.user.name || "A GitScout recruiter",
    sharedByImage: share.user.image,
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
  });
}
