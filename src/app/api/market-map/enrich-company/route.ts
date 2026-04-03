import { getAuthUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { runEnrichmentProcessorSweep } from "@/lib/market-map/enrichCompanyPipeline";

// Phased enrichment runs in this request (no CRON_SECRET / Vercel cron required). Hobby: still capped by platform ~60s.
export const maxDuration = 60;

async function jsonResponseAfterSweep(companyId: string) {
  const co = await prisma.mapCompany.findUnique({
    where: { id: companyId },
    select: { enrichmentStatus: true, enrichmentError: true },
  });
  const candidatesFound = await prisma.mapCandidate.count({ where: { companyId } });

  if (co?.enrichmentStatus === "complete") {
    return Response.json({
      status: "complete",
      companyId,
      candidatesFound,
    });
  }
  if (co?.enrichmentStatus === "failed") {
    return Response.json(
      { error: co.enrichmentError || "Enrichment failed" },
      { status: 500 }
    );
  }
  // Still enriching (e.g. hit serverless wall) — client can reload or POST again to resume phases.
  return Response.json(
    { status: "processing", companyId, candidatesFound },
    { status: 202 }
  );
}

export async function POST(request: Request) {
  const userId = await getAuthUserId(request);
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const { map_id, company_id, company_domain } = body;

  if (!map_id || !company_id || !company_domain) {
    return Response.json({ error: "map_id, company_id, company_domain required" }, { status: 400 });
  }

  const companyRow = await prisma.mapCompany.findFirst({
    where: { id: company_id, mapId: map_id, map: { userId } },
    select: { id: true, companyDomain: true },
  });
  if (!companyRow) {
    return Response.json({ error: "Company not found" }, { status: 404 });
  }
  if (String(company_domain).toLowerCase() !== companyRow.companyDomain.toLowerCase()) {
    return Response.json({ error: "company_domain does not match this record" }, { status: 400 });
  }

  if (!process.env.APOLLO_API_KEY) {
    return Response.json({ error: "APOLLO_API_KEY not configured" }, { status: 500 });
  }

  const lockResult = await prisma.mapCompany.updateMany({
    where: {
      id: company_id,
      enrichmentStatus: { notIn: ["enriching", "queued"] },
    },
    data: {
      enrichmentStatus: "queued",
      enrichmentSubstatus: null,
      enrichmentError: null,
    },
  });

  if (lockResult.count === 0) {
    const cur = await prisma.mapCompany.findFirst({
      where: { id: company_id, mapId: map_id },
      select: { enrichmentStatus: true },
    });
    if (cur?.enrichmentStatus === "queued") {
      await runEnrichmentProcessorSweep(0, false, company_id);
      return jsonResponseAfterSweep(company_id);
    }
    if (cur?.enrichmentStatus === "enriching") {
      return Response.json({ status: "already_enriching" }, { status: 200 });
    }
    return Response.json({ error: "Could not queue enrichment" }, { status: 409 });
  }

  await runEnrichmentProcessorSweep(0, false, company_id);
  return jsonResponseAfterSweep(company_id);
}
