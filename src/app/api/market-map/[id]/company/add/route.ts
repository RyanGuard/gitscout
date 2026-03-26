import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: mapId } = await params;
  const body = await request.json().catch(() => ({}));
  const { company_name, company_domain, tier, apollo_org_id } = body;

  if (!company_name || !company_domain || !tier) {
    return Response.json({ error: "company_name, company_domain, tier required" }, { status: 400 });
  }

  try {
    // Verify map exists and belongs to user
    const map = await prisma.marketMap.findFirst({
      where: { id: mapId, userId: session.user.id },
    });
    if (!map) {
      return Response.json({ error: "Map not found" }, { status: 404 });
    }

    // Create company with tier_override = true (recruiter's choice)
    const company = await prisma.mapCompany.create({
      data: {
        mapId,
        companyName: company_name,
        companyDomain: company_domain,
        tier: tier.toUpperCase(),
        tierOverride: true,
        enrichmentStatus: "pending",
        apolloOrgId: apollo_org_id || null,
      },
    });

    // Kick off enrichment in the background
    // (The frontend should call /api/market-map/enrich-company after this)

    return Response.json({
      id: company.id,
      name: company.companyName,
      domain: company.companyDomain,
      tier: company.tier,
      enrichmentStatus: company.enrichmentStatus,
    });
  } catch (error) {
    console.error("[add-company] Failed:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to add company" },
      { status: 500 }
    );
  }
}
