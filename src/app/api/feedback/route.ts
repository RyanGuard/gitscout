import { getAuthUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const userId = await getAuthUserId(request);
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const { feature, rating, comment, context } = body;

  if (!feature || rating === undefined || rating === null) {
    return Response.json({ error: "feature and rating required" }, { status: 400 });
  }

  if (![-1, 0, 1].includes(rating)) {
    return Response.json({ error: "rating must be -1, 0, or 1" }, { status: 400 });
  }

  const feedback = await prisma.userFeedback.create({
    data: {
      userId,
      feature,
      rating,
      comment: comment?.trim() || null,
      context: context || null,
    },
  });

  return Response.json({ id: feedback.id }, { status: 201 });
}

export async function GET(request: Request) {
  const userId = await getAuthUserId(request);
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const feedback = await prisma.userFeedback.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return Response.json({ feedback });
}
