import { getAuthUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ templateId: string }> }
) {
  const userId = await getAuthUserId(request);
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { templateId } = await params;

  const template = await prisma.mapTemplate.findFirst({
    where: { id: templateId, userId },
  });
  if (!template) return Response.json({ error: "Template not found" }, { status: 404 });

  await prisma.mapTemplate.delete({ where: { id: templateId } });
  return Response.json({ success: true });
}
