import { prisma } from "@/lib/prisma";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; companyId: string }> }
) {
  const { companyId } = await params;
  const body = await request.json().catch(() => ({}));

  const updateData: Record<string, unknown> = {};
  if (body.tier) {
    updateData.tier = body.tier.toUpperCase();
    updateData.tierOverride = true;
  }

  if (Object.keys(updateData).length === 0) {
    return Response.json({ error: "Nothing to update" }, { status: 400 });
  }

  try {
    const updated = await prisma.mapCompany.update({
      where: { id: companyId },
      data: updateData,
    });
    return Response.json({ id: updated.id, tier: updated.tier, tierOverride: updated.tierOverride });
  } catch {
    return Response.json({ error: "Company not found" }, { status: 404 });
  }
}
