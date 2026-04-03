import { getAuthUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logStatusChange } from "@/lib/map/statusHistory";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; candidateId: string }> }
) {
  const userId = await getAuthUserId(request);
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: mapId, candidateId } = await params;
  const body = await request.json().catch(() => ({}));

  const updateData: Record<string, unknown> = {};
  if (body.status) updateData.status = body.status;
  if (body.fitScore !== undefined) updateData.fitScore = body.fitScore;

  if (Object.keys(updateData).length === 0) {
    return Response.json({ error: "Nothing to update" }, { status: 400 });
  }

  try {
    const existing = await prisma.mapCandidate.findFirst({
      where: { id: candidateId, mapId, company: { map: { userId } } },
      select: {
        id: true,
        status: true,
        shortlistNote: true,
        fitScore: true,
        fitReasoning: true,
        flightRisk: true,
        flightRiskSignals: true,
      },
    });

    if (!existing) {
      return Response.json({ error: "Candidate not found" }, { status: 404 });
    }

    const oldStatus = existing.status;

    const updated = await prisma.mapCandidate.update({
      where: { id: candidateId },
      data: updateData,
    });

    if (body.status && oldStatus !== body.status) {
      await logStatusChange(candidateId, mapId, oldStatus, body.status, userId);
    }

    if (body.status === "shortlisted" && !existing.shortlistNote) {
      const parts: string[] = [];
      if (existing.fitScore != null) parts.push(`Fit: ${existing.fitScore}/100`);
      if (existing.fitReasoning) parts.push(existing.fitReasoning);
      if (existing.flightRisk === "high") {
        parts.push(
          `High flight risk: ${(existing.flightRiskSignals || [])
            .map((s: string) => s.replace(/_/g, " ").toLowerCase())
            .join(", ")}`
        );
      }
      if (parts.length > 0) {
        await prisma.mapCandidate.update({
          where: { id: candidateId },
          data: { shortlistNote: parts.join(" · ") },
        });
      }
    }

    return Response.json({ id: updated.id, status: updated.status });
  } catch {
    return Response.json({ error: "Candidate not found" }, { status: 404 });
  }
}
