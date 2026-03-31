import { getAuthUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { computeOutreachAnalytics } from "@/lib/outreach/analytics";

export async function GET(request: Request) {
  const userId = await getAuthUserId(request);
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const analytics = await prisma.outreachAnalytic.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });

  const metrics = computeOutreachAnalytics(analytics);

  return Response.json(metrics);
}
