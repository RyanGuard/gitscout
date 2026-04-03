import { getAuthUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { safeErrorMessage } from "@/lib/api-error";
import { runClassifyCore } from "@/lib/market-map/classifyCore";

export const maxDuration = 60;

export async function POST(request: Request) {
  const userId = await getAuthUserId(request);
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const {
    map_id,
    company_id,
    role_brief,
    candidates,
    company_news,
    company_news_events,
    job_postings,
    company_growth_rate,
  } = body;

  if (!map_id || !company_id || !candidates?.length) {
    return Response.json({ error: "map_id, company_id, candidates required" }, { status: 400 });
  }

  const map = await prisma.marketMap.findFirst({
    where: { id: map_id, userId },
    select: { id: true },
  });
  if (!map) {
    return Response.json({ error: "Map not found" }, { status: 404 });
  }

  const companyOnMap = await prisma.mapCompany.findFirst({
    where: { id: company_id, mapId: map_id },
    select: { id: true },
  });
  if (!companyOnMap) {
    return Response.json({ error: "Company not found" }, { status: 404 });
  }

  try {
    const result = await runClassifyCore({
      mapId: map_id,
      companyId: company_id,
      roleBrief: role_brief || {},
      candidates,
      companyNews: company_news || null,
      companyNewsEvents: company_news_events || [],
      jobPostings: job_postings,
      companyGrowthRate: company_growth_rate || null,
    });
    return Response.json({
      classified: result.classified,
      total: result.total,
      highRisk: result.highRisk,
      mediumRisk: result.mediumRisk,
    });
  } catch (error) {
    console.error("[market-map] Classification failed:", error);
    return Response.json(
      { error: safeErrorMessage(error, "Classification failed") },
      { status: 500 }
    );
  }
}
