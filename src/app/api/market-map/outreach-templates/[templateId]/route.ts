import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ templateId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { templateId } = await params;
  const body = await request.json().catch(() => ({}));

  const updateData: Record<string, unknown> = {};
  if (body.name !== undefined) updateData.name = body.name;
  if (body.tone !== undefined) updateData.tone = body.tone;
  if (body.selling_points !== undefined)
    updateData.sellingPoints = body.selling_points;
  if (body.custom_instructions !== undefined)
    updateData.customInstructions = body.custom_instructions;
  if (body.body_template !== undefined)
    updateData.bodyTemplate = body.body_template;

  if (Object.keys(updateData).length === 0) {
    return Response.json({ error: "Nothing to update" }, { status: 400 });
  }

  try {
    const template = await prisma.outreachTemplate.update({
      where: { id: templateId, userId: session.user.id },
      data: updateData,
    });
    return Response.json({ template });
  } catch {
    return Response.json({ error: "Template not found" }, { status: 404 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ templateId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { templateId } = await params;

  const deleted = await prisma.outreachTemplate.deleteMany({
    where: { id: templateId, userId: session.user.id },
  });

  if (deleted.count === 0) {
    return Response.json({ error: "Template not found" }, { status: 404 });
  }

  return Response.json({ success: true });
}
