import { getAuthUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const userId = await getAuthUserId(request);
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const templates = await prisma.outreachStudioTemplate.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });

  return Response.json({ templates });
}

export async function POST(request: Request) {
  const userId = await getAuthUserId(request);
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const {
    name,
    description,
    channel,
    tone,
    sequenceLength,
    roleContext,
    sellingPoints,
    templateMessages,
  } = body;

  if (!name?.trim()) {
    return Response.json({ error: "Template name is required" }, { status: 400 });
  }

  const template = await prisma.outreachStudioTemplate.create({
    data: {
      userId,
      name: name.trim(),
      description: description?.trim() || null,
      channel: channel || "email",
      tone: tone || "professional",
      sequenceLength: sequenceLength || 3,
      roleContext: roleContext?.trim() || null,
      sellingPoints: sellingPoints || [],
      templateMessages: templateMessages || null,
    },
  });

  return Response.json(template, { status: 201 });
}
