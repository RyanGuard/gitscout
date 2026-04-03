import { runEnrichmentProcessorSweep } from "@/lib/market-map/enrichCompanyPipeline";

export const maxDuration = 60;

/**
 * Optional batch worker (manual or your own cron): drains queued / in-flight companies globally.
 * Not required for normal use — POST /enrich-company runs phased work inline.
 * Auth: Authorization: Bearer CRON_SECRET (same as /api/cron).
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const chainRaw = request.headers.get("x-gitscout-enrich-chain");
  const chainDepth = Math.min(20, Math.max(0, parseInt(chainRaw || "0", 10) || 0));

  const { phasesRun, pending } = await runEnrichmentProcessorSweep(chainDepth, true, null);

  return Response.json({
    ok: true,
    phasesRun,
    requeued: pending && chainDepth < 15,
  });
}
