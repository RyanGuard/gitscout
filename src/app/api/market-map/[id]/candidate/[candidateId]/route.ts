import { prisma } from "@/lib/prisma";
import { logStatusChange } from "@/lib/map/statusHistory";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; candidateId: string }> }
) {
  const { id: mapId, candidateId } = await params;
  const body = await request.json().catch(() => ({}));
  const session = await getServerSession(authOptions);

  const updateData: Record<string, unknown> = {};
  if (body.status) updateData.status = body.status;
  if (body.fitScore !== undefined) updateData.fitScore = body.fitScore;

  if (Object.keys(updateData).length === 0) {
    return Response.json({ error: "Nothing to update" }, { status: 400 });
  }

  try {
    // Read current status before update for history logging
    let oldStatus: string | undefined;
    if (body.status) {
      const current = await prisma.mapCandidate.findUnique({
        where: { id: candidateId },
        select: { status: true },
      });
      oldStatus = current?.status;
    }

    const updated = await prisma.mapCandidate.update({
      where: { id: candidateId },
      data: updateData,
    });

    // Log status change
    if (body.status && oldStatus && oldStatus !== body.status) {
      await logStatusChange(
        candidateId,
        mapId,
        oldStatus,
        body.status,
        session?.user?.id
      );
    }

    return Response.json({ id: updated.id, status: updated.status });
  } catch {
    return Response.json({ error: "Candidate not found" }, { status: 404 });
  }
}
