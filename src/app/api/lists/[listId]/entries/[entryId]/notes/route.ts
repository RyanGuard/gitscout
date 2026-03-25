import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function verifyEntry(userId: string, listId: string, entryId: string) {
  return prisma.candidateEntry.findFirst({
    where: {
      id: entryId,
      listId,
      list: { userId },
    },
  });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ listId: string; entryId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { listId, entryId } = await params;

  const entry = await verifyEntry(session.user.id, listId, entryId);
  if (!entry) {
    return Response.json({ error: "Entry not found" }, { status: 404 });
  }

  const notes = await prisma.candidateNote.findMany({
    where: { entryId },
    orderBy: { createdAt: "desc" },
  });

  return Response.json({
    notes: notes.map((n) => ({
      id: n.id,
      content: n.content,
      createdAt: n.createdAt.toISOString(),
    })),
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ listId: string; entryId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { listId, entryId } = await params;

  const entry = await verifyEntry(session.user.id, listId, entryId);
  if (!entry) {
    return Response.json({ error: "Entry not found" }, { status: 404 });
  }

  const { content } = await request.json();
  if (!content || typeof content !== "string" || content.trim().length === 0) {
    return Response.json({ error: "Content is required" }, { status: 400 });
  }

  const note = await prisma.candidateNote.create({
    data: { entryId, content: content.trim() },
  });

  return Response.json(
    {
      id: note.id,
      content: note.content,
      createdAt: note.createdAt.toISOString(),
    },
    { status: 201 }
  );
}
