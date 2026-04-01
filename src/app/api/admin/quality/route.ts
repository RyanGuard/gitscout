import { getAuthUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const userId = await getAuthUserId(request);
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 86400000);
  const dayAgo = new Date(now.getTime() - 86400000);

  const aiCalls = await prisma.aiCall.groupBy({
    by: ["feature"],
    where: { createdAt: { gte: weekAgo } },
    _count: { id: true },
    _avg: { latencyMs: true, inputTokens: true, outputTokens: true },
    _sum: { inputTokens: true, outputTokens: true },
  });

  const aiErrors = await prisma.aiCall.count({
    where: { createdAt: { gte: weekAgo }, success: false },
  });

  const feedback = await prisma.userFeedback.groupBy({
    by: ["feature"],
    where: { createdAt: { gte: weekAgo } },
    _count: { id: true },
    _avg: { rating: true },
  });

  const negativeFeedback = await prisma.userFeedback.findMany({
    where: { createdAt: { gte: weekAgo }, rating: -1 },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: { feature: true, comment: true, context: true, createdAt: true },
  });

  const todayCalls = await prisma.aiCall.count({
    where: { createdAt: { gte: dayAgo } },
  });

  const todayTokens = await prisma.aiCall.aggregate({
    where: { createdAt: { gte: dayAgo } },
    _sum: { inputTokens: true, outputTokens: true },
  });

  return Response.json({
    period: "7d",
    ai: {
      byFeature: aiCalls.map((a) => ({
        feature: a.feature,
        calls: a._count.id,
        avgLatencyMs: Math.round(a._avg.latencyMs || 0),
        totalInputTokens: a._sum.inputTokens,
        totalOutputTokens: a._sum.outputTokens,
      })),
      errorCount: aiErrors,
      today: {
        calls: todayCalls,
        inputTokens: todayTokens._sum.inputTokens || 0,
        outputTokens: todayTokens._sum.outputTokens || 0,
      },
    },
    feedback: {
      byFeature: feedback.map((f) => ({
        feature: f.feature,
        count: f._count.id,
        avgRating: Math.round((f._avg.rating || 0) * 100) / 100,
      })),
      recentNegative: negativeFeedback,
    },
  });
}
