import { prisma } from "@/lib/prisma";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; candidateId: string }> }
) {
  const { candidateId } = await params;
  const body = await request.json().catch(() => ({}));

  const updateData: Record<string, unknown> = {};
  if (body.status) updateData.status = body.status;
  if (body.fitScore !== undefined) updateData.fitScore = body.fitScore;

  if (Object.keys(updateData).length === 0) {
    return Response.json({ error: "Nothing to update" }, { status: 400 });
  }

  try {
    const updated = await prisma.mapCandidate.update({
      where: { id: candidateId },
      data: updateData,
    });
    return Response.json({ id: updated.id, status: updated.status });
  } catch {
    return Response.json({ error: "Candidate not found" }, { status: 404 });
  }
}
