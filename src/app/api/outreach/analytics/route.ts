import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { computeOutreachAnalytics } from "@/lib/outreach/analytics";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const analytics = await prisma.outreachAnalytic.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });

  const metrics = computeOutreachAnalytics(analytics);

  return Response.json(metrics);
}
