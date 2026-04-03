import { getAuthUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getAuthUserId(request);
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: mapId } = await params;

  // Get all outreach messages for this map, grouped by candidate company
  const messages = await prisma.outreachMessage.findMany({
    where: { mapId, userId },
    select: {
      candidateId: true,
      status: true,
      sentAt: true,
      responseReceivedAt: true,
    },
  });

  // Get candidate-to-company mapping
  const candidates = await prisma.mapCandidate.findMany({
    where: { mapId },
    select: {
      id: true,
      companyId: true,
      company: {
        select: { id: true, companyName: true, companyDomain: true },
      },
    },
  });

  const candidateCompany = new Map(
    candidates.map((c) => [c.id, c.company])
  );

  // Aggregate per company
  const companyStats: Record<
    string,
    {
      companyId: string;
      companyName: string;
      sent: number;
      responded: number;
      bounced: number;
      totalResponseHours: number;
      responseCount: number;
    }
  > = {};

  for (const msg of messages) {
    const company = candidateCompany.get(msg.candidateId);
    if (!company) continue;

    if (!companyStats[company.id]) {
      companyStats[company.id] = {
        companyId: company.id,
        companyName: company.companyName,
        sent: 0,
        responded: 0,
        bounced: 0,
        totalResponseHours: 0,
        responseCount: 0,
      };
    }

    const stat = companyStats[company.id];
    if (msg.status === "sent") stat.sent++;
    if (msg.status === "responded") {
      stat.responded++;
      if (msg.sentAt && msg.responseReceivedAt) {
        const hours = Math.round(
          (new Date(msg.responseReceivedAt).getTime() -
            new Date(msg.sentAt).getTime()) /
            (1000 * 60 * 60)
        );
        stat.totalResponseHours += hours;
        stat.responseCount++;
      }
    }
    if (msg.status === "bounced") stat.bounced++;
  }

  const rates = Object.values(companyStats).map((stat) => {
    const totalContacted = stat.sent + stat.responded + stat.bounced;
    return {
      companyId: stat.companyId,
      companyName: stat.companyName,
      candidatesContacted: totalContacted,
      candidatesResponded: stat.responded,
      responseRate:
        totalContacted > 0
          ? Math.round((stat.responded / totalContacted) * 100)
          : 0,
      avgResponseTimeDays:
        stat.responseCount > 0
          ? Math.round(stat.totalResponseHours / stat.responseCount / 24)
          : null,
    };
  });

  return Response.json({ rates });
}
