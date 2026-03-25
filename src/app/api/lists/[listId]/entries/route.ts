import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const VALID_STAGES = ["identified", "enriched", "contacted", "replied", "interested", "passed"];

export async function POST(
  request: Request,
  { params }: { params: Promise<{ listId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { listId } = await params;

  const list = await prisma.candidateList.findUnique({
    where: { id: listId, userId: session.user.id },
  });
  if (!list) {
    return Response.json({ error: "List not found" }, { status: 404 });
  }

  const { developerId, stage, tags } = await request.json();
  if (!developerId) {
    return Response.json({ error: "developerId is required" }, { status: 400 });
  }

  if (stage && !VALID_STAGES.includes(stage)) {
    return Response.json({ error: "Invalid stage" }, { status: 400 });
  }

  const existing = await prisma.candidateEntry.findUnique({
    where: { listId_developerId: { listId, developerId } },
  });
  if (existing) {
    return Response.json({ error: "Developer already in this list" }, { status: 409 });
  }

  const entry = await prisma.candidateEntry.create({
    data: {
      listId,
      developerId,
      stage: stage || "identified",
      tags: tags?.length
        ? { create: tags.map((tag: string) => ({ tag })) }
        : undefined,
    },
    include: {
      developer: {
        include: { languages: { take: 3, orderBy: { percentage: "desc" } } },
      },
      tags: true,
    },
  });

  return Response.json(
    {
      id: entry.id,
      stage: entry.stage,
      addedAt: entry.addedAt.toISOString(),
      developer: {
        id: entry.developer.id,
        username: entry.developer.username,
        name: entry.developer.name,
        avatarUrl: entry.developer.avatarUrl,
      },
      tags: entry.tags.map((t) => t.tag),
      lastNote: null,
    },
    { status: 201 }
  );
}
