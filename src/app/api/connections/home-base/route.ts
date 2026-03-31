import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const homeBase = await prisma.connectionHomeBase.findFirst({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });

  if (!homeBase) {
    return Response.json({ homeBase: null });
  }

  return Response.json({
    homeBase: {
      id: homeBase.id,
      companyName: homeBase.companyName,
      companyDomain: homeBase.companyDomain,
      setupStatus: homeBase.setupStatus,
      teamCount: homeBase.teamCount,
      engCount: homeBase.engCount,
      githubMatchedCount: homeBase.githubMatchedCount,
      investors: homeBase.investors,
      fundingStage: homeBase.fundingStage,
      lastEnrichedAt: homeBase.lastEnrichedAt,
      createdAt: homeBase.createdAt,
      updatedAt: homeBase.updatedAt,
    },
  });
}
