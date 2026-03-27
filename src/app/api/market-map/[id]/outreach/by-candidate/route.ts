import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: mapId } = await params;
  const url = new URL(request.url);
  const candidateId = url.searchParams.get("candidateId");

  if (!candidateId) {
    return Response.json({ error: "candidateId required" }, { status: 400 });
  }

  const messages = await prisma.outreachMessage.findMany({
    where: {
      mapId,
      candidateId,
      userId: session.user.id,
    },
    orderBy: { createdAt: "desc" },
  });

  return Response.json({ messages });
}
