import { getAuthUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { safeErrorMessage } from "@/lib/api-error";
import { runEnrichNewsCore } from "@/lib/market-map/enrichNewsCore";

export const maxDuration = 60;

export async function POST(request: Request) {
  const userId = await getAuthUserId(request);
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const { map_id, company_id, company_name } = body;

  if (!map_id || !company_id || !company_name) {
    return Response.json({ error: "map_id, company_id, and company_name required" }, { status: 400 });
  }

  const companyRow = await prisma.mapCompany.findFirst({
    where: { id: company_id, mapId: map_id, map: { userId } },
    select: { id: true, apolloOrgId: true, companyDomain: true, companyName: true },
  });
  if (!companyRow) {
    return Response.json({ error: "Company not found" }, { status: 404 });
  }

  if (!process.env.APOLLO_API_KEY) {
    return Response.json({ error: "APOLLO_API_KEY not configured" }, { status: 500 });
  }

  try {
    const result = await runEnrichNewsCore({
      companyId: company_id,
      companyName: String(company_name),
      companyDomain: companyRow.companyDomain,
      apolloOrgId: companyRow.apolloOrgId,
    });
    return Response.json({
      events: result.events,
      flightRisk: result.flightRisk,
      summary: result.summary,
      articlesAnalyzed: result.articlesAnalyzed,
    });
  } catch (error) {
    console.error("[enrich-news] Failed:", error);
    return Response.json(
      { error: safeErrorMessage(error, "News enrichment failed") },
      { status: 500 }
    );
  }
}
