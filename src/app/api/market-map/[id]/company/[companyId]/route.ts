import { getAuthUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; companyId: string }> }
) {
  const { id: mapId, companyId } = await params;

  const userId = await getAuthUserId(request);
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));

  const updateData: Record<string, unknown> = {};

  if (body.tier) {
    const t = String(body.tier).toUpperCase();
    if (!["A", "B", "C"].includes(t)) {
      return Response.json({ error: "tier must be A, B, or C" }, { status: 400 });
    }
    updateData.tier = t;
    updateData.tierOverride = true;
  }

  if (typeof body.hidden === "boolean") {
    updateData.hidden = body.hidden;
  }

  if (Object.keys(updateData).length === 0) {
    return Response.json({ error: "Nothing to update" }, { status: 400 });
  }

  const owned = await prisma.marketMap.findFirst({
    where: { id: mapId, userId },
    select: { id: true },
  });
  if (!owned) {
    return Response.json({ error: "Map not found" }, { status: 404 });
  }

  try {
    const updated = await prisma.mapCompany.update({
      where: { id: companyId, mapId },
      data: updateData,
    });
    return Response.json({
      id: updated.id,
      tier: updated.tier,
      tierOverride: updated.tierOverride,
      hidden: updated.hidden,
    });
  } catch {
    return Response.json({ error: "Company not found" }, { status: 404 });
  }
}
