import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { developerId, listId } = await request.json();
  if (!developerId || !listId) {
    return Response.json({ error: "developerId and listId are required" }, { status: 400 });
  }

  const list = await prisma.candidateList.findUnique({
    where: { id: listId, userId: session.user.id },
  });
  if (!list) {
    return Response.json({ error: "List not found" }, { status: 404 });
  }

  const existing = await prisma.candidateEntry.findUnique({
    where: { listId_developerId: { listId, developerId } },
  });
  if (existing) {
    return Response.json({ error: "Developer already in this list", entryId: existing.id }, { status: 409 });
  }

  const entry = await prisma.candidateEntry.create({
    data: { listId, developerId, stage: "identified" },
  });

  return Response.json({ id: entry.id, stage: entry.stage }, { status: 201 });
}
