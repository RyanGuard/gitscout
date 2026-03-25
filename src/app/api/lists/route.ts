import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const lists = await prisma.candidateList.findMany({
    where: { userId: session.user.id },
    include: { _count: { select: { entries: true } } },
    orderBy: { updatedAt: "desc" },
  });

  const result = lists.map((l) => ({
    id: l.id,
    name: l.name,
    description: l.description,
    entryCount: l._count.entries,
    createdAt: l.createdAt.toISOString(),
    updatedAt: l.updatedAt.toISOString(),
  }));

  return Response.json({ lists: result });
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { name, description } = await request.json();
  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return Response.json({ error: "Name is required" }, { status: 400 });
  }

  const list = await prisma.candidateList.create({
    data: {
      userId: session.user.id,
      name: name.trim(),
      description: description?.trim() || null,
    },
  });

  return Response.json(
    {
      id: list.id,
      name: list.name,
      description: list.description,
      entryCount: 0,
      createdAt: list.createdAt.toISOString(),
      updatedAt: list.updatedAt.toISOString(),
    },
    { status: 201 }
  );
}
