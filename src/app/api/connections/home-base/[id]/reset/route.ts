import { getAuthUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getAuthUserId(request);
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const homeBase = await prisma.connectionHomeBase.findFirst({
    where: { id, userId },
  });

  if (!homeBase) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  // Delete the stuck record so user can start fresh
  await prisma.connectionHomeBase.delete({ where: { id } });

  return Response.json({ success: true, message: "Home base reset. You can set up again." });
}
