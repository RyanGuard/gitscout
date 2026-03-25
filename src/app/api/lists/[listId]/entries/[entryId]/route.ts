import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const VALID_STAGES = ["identified", "enriched", "contacted", "replied", "interested", "passed"];

async function verifyEntry(userId: string, listId: string, entryId: string) {
  return prisma.candidateEntry.findFirst({
    where: {
      id: entryId,
      listId,
      list: { userId },
    },
  });
}

export async function PATCH(
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

  const { stage, addTags, removeTags } = await request.json();

  if (stage && !VALID_STAGES.includes(stage)) {
    return Response.json({ error: "Invalid stage" }, { status: 400 });
  }

  // Update stage if provided
  if (stage) {
    await prisma.candidateEntry.update({
      where: { id: entryId },
      data: { stage },
    });
  }

  // Add tags
  if (addTags?.length) {
    const existingTags = await prisma.candidateTag.findMany({
      where: { entryId, tag: { in: addTags } },
      select: { tag: true },
    });
    const existingSet = new Set(existingTags.map((t) => t.tag));
    const newTags = (addTags as string[]).filter((t) => !existingSet.has(t));

    if (newTags.length) {
      await prisma.candidateTag.createMany({
        data: newTags.map((tag) => ({ entryId, tag })),
      });
    }
  }

  // Remove tags
  if (removeTags?.length) {
    await prisma.candidateTag.deleteMany({
      where: { entryId, tag: { in: removeTags } },
    });
  }

  // Return updated entry
  const updated = await prisma.candidateEntry.findUnique({
    where: { id: entryId },
    include: { tags: true, notes: { take: 1, orderBy: { createdAt: "desc" } } },
  });

  return Response.json({
    id: updated!.id,
    stage: updated!.stage,
    tags: updated!.tags.map((t) => t.tag),
    lastNote: updated!.notes[0]?.content ?? null,
  });
}

export async function DELETE(
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

  await prisma.candidateEntry.delete({ where: { id: entryId } });

  return Response.json({ success: true });
}
