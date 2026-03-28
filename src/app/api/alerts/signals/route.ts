import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const eventType = searchParams.get("event_type");
  const severity = searchParams.get("severity");
  const unreadOnly = searchParams.get("unread_only") === "true";
  const limit = Math.min(
    Math.max(parseInt(searchParams.get("limit") || "20", 10) || 20, 1),
    100
  );
  const offset = Math.max(
    parseInt(searchParams.get("offset") || "0", 10) || 0,
    0
  );

  const where: Record<string, unknown> = {
    userId: session.user.id,
  };

  if (eventType) {
    where.eventType = eventType;
  }

  if (severity) {
    where.severity = severity;
  }

  if (unreadOnly) {
    where.isRead = false;
    where.isDismissed = false;
  }

  const [signals, total] = await Promise.all([
    prisma.marketSignal.findMany({
      where,
      include: {
        watchedCompany: {
          select: {
            companyName: true,
            companyDomain: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.marketSignal.count({ where }),
  ]);

  const result = signals.map((s) => ({
    id: s.id,
    watchedCompanyId: s.watchedCompanyId,
    companyName: s.watchedCompany.companyName,
    companyDomain: s.watchedCompany.companyDomain,
    eventType: s.eventType,
    severity: s.severity,
    summary: s.summary,
    sourceUrl: s.sourceUrl,
    sourceType: s.sourceType,
    eventDate: s.eventDate,
    isRead: s.isRead,
    isDismissed: s.isDismissed,
    candidateCount: s.candidateCount,
    createdAt: s.createdAt.toISOString(),
  }));

  return NextResponse.json({ signals: result, total });
}
