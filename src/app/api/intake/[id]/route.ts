import { getAuthUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getAuthUserId(request);
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const session = await prisma.intakeSession.findUnique({ where: { id } });
  if (!session) return Response.json({ error: "Not found" }, { status: 404 });
  if (session.userId !== userId) return Response.json({ error: "Forbidden" }, { status: 403 });

  return Response.json(session);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getAuthUserId(request);
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const session = await prisma.intakeSession.findUnique({ where: { id } });
  if (!session) return Response.json({ error: "Not found" }, { status: 404 });
  if (session.userId !== userId) return Response.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json();
  const allowed = [
    "roleBasics", "candidateProfile", "technicalReqs", "compensation",
    "logistics", "interviewProcess", "sellingPoints", "sourcingStrategy",
    "redFlags", "rawNotes", "status", "mode",
  ];

  const data: Record<string, unknown> = {};
  for (const key of allowed) {
    if (body[key] !== undefined) data[key] = body[key];
  }

  const updated = await prisma.intakeSession.update({ where: { id }, data });
  return Response.json(updated);
}
