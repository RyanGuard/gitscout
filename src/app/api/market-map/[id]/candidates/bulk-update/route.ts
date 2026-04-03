import { getAuthUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logStatusChange } from "@/lib/map/statusHistory";
import { safeErrorMessage } from "@/lib/api-error";

const VALID_STATUSES = ["mapped", "shortlisted", "contacted", "responded", "screening", "offer", "rejected"];

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getAuthUserId(request);
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: mapId } = await params;
  const body = await request.json().catch(() => ({}));
  const { candidate_ids, update } = body;

  if (!candidate_ids?.length || !update) {
    return Response.json({ error: "candidate_ids and update required" }, { status: 400 });
  }

  if (candidate_ids.length > 100) {
    return Response.json({ error: "Max 100 candidates per bulk update" }, { status: 400 });
  }

  // Validate status if being updated
  if (update.status && !VALID_STATUSES.includes(update.status)) {
    return Response.json({ error: `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}` }, { status: 400 });
  }

  try {
    const map = await prisma.marketMap.findFirst({
      where: { id: mapId, userId },
      select: { id: true },
    });
    if (!map) {
      return Response.json({ error: "Map not found" }, { status: 404 });
    }

    // Fetch current statuses for history logging
    let oldStatuses: Map<string, string> | null = null;
    if (update.status) {
      const current = await prisma.mapCandidate.findMany({
        where: { id: { in: candidate_ids }, mapId },
        select: { id: true, status: true },
      });
      oldStatuses = new Map(current.map((c) => [c.id, c.status]));
    }

    const result = await prisma.mapCandidate.updateMany({
      where: {
        id: { in: candidate_ids },
        mapId,
      },
      data: update,
    });

    // Log status changes
    if (update.status && oldStatuses) {
      const historyPromises = [];
      for (const [candidateId, oldStatus] of oldStatuses) {
        if (oldStatus !== update.status) {
          historyPromises.push(
            logStatusChange(
              candidateId,
              mapId,
              oldStatus,
              update.status,
              userId
            )
          );
        }
      }
      await Promise.allSettled(historyPromises);
    }

    // Auto-generate shortlist notes on bulk status change to shortlisted
    if (update.status === "shortlisted") {
      const candidates = await prisma.mapCandidate.findMany({
        where: { id: { in: candidate_ids }, mapId, shortlistNote: null },
        select: { id: true, fitScore: true, fitReasoning: true, flightRisk: true, flightRiskSignals: true },
      });
      for (const c of candidates) {
        const parts: string[] = [];
        if (c.fitScore != null) parts.push(`Fit: ${c.fitScore}/100`);
        if (c.fitReasoning) parts.push(c.fitReasoning);
        if (c.flightRisk === "high") {
          parts.push(`High flight risk: ${(c.flightRiskSignals || []).map((s: string) => s.replace(/_/g, " ").toLowerCase()).join(", ")}`);
        }
        if (parts.length > 0) {
          await prisma.mapCandidate.update({
            where: { id: c.id },
            data: { shortlistNote: parts.join(" · ") },
          });
        }
      }
    }

    return Response.json({ updated: result.count });
  } catch (error) {
    console.error("[bulk-update] Failed:", error);
    return Response.json(
      { error: safeErrorMessage(error, "Bulk update failed") },
      { status: 500 }
    );
  }
}
