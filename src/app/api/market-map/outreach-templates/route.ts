import { getAuthUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const userId = await getAuthUserId(request);
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const templates = await prisma.outreachTemplate.findMany({
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

  const body = await request.json().catch(() => ({}));

  if (!body.name) {
    return Response.json({ error: "name required" }, { status: 400 });
  }

  const template = await prisma.outreachTemplate.create({
    data: {
      userId,
      name: body.name,
      tone: body.tone || "professional",
      sellingPoints: body.selling_points || [],
      customInstructions: body.custom_instructions || null,
      bodyTemplate: body.body_template || null,
    },
  });

  return Response.json({ template });
}
