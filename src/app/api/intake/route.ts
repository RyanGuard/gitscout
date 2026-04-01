import { getAuthUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const userId = await getAuthUserId(request);
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const session = await prisma.intakeSession.create({
    data: { userId, mode: body.mode || "guided" },
  });

  return Response.json({ id: session.id, mode: session.mode, status: session.status }, { status: 201 });
}

export async function GET(request: Request) {
  const userId = await getAuthUserId(request);
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const sessions = await prisma.intakeSession.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: { id: true, mode: true, status: true, roleBasics: true, createdAt: true, mapId: true },
  });

  return Response.json({ sessions });
}
