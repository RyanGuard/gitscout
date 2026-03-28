import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const signal = await prisma.marketSignal.findUnique({
    where: { id },
    include: {
      watchedCompany: {
        select: {
          companyName: true,
          companyDomain: true,
        },
      },
      surfacedCandidates: {
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!signal) {
    return NextResponse.json({ error: "Signal not found" }, { status: 404 });
  }

  if (signal.userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({
    id: signal.id,
    watchedCompanyId: signal.watchedCompanyId,
    companyName: signal.watchedCompany.companyName,
    companyDomain: signal.watchedCompany.companyDomain,
    eventType: signal.eventType,
    severity: signal.severity,
    summary: signal.summary,
    sourceUrl: signal.sourceUrl,
    sourceType: signal.sourceType,
    eventDate: signal.eventDate,
    rawArticles: signal.rawArticles,
    isRead: signal.isRead,
    isDismissed: signal.isDismissed,
    candidateCount: signal.candidateCount,
    createdAt: signal.createdAt.toISOString(),
    surfacedCandidates: signal.surfacedCandidates.map((c) => ({
      id: c.id,
      apolloPersonId: c.apolloPersonId,
      name: c.name,
      firstName: c.firstName,
      lastName: c.lastName,
      title: c.title,
      seniority: c.seniority,
      city: c.city,
      state: c.state,
      country: c.country,
      linkedinUrl: c.linkedinUrl,
      headline: c.headline,
      departments: c.departments,
      tenureMonths: c.tenureMonths,
      email: c.email,
      phone: c.phone,
      emailEnrichedAt: c.emailEnrichedAt?.toISOString() ?? null,
      status: c.status,
      createdAt: c.createdAt.toISOString(),
    })),
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const signal = await prisma.marketSignal.findUnique({
    where: { id },
  });

  if (!signal) {
    return NextResponse.json({ error: "Signal not found" }, { status: 404 });
  }

  if (signal.userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const data: Record<string, unknown> = {};

  if (body.isRead !== undefined) {
    if (typeof body.isRead !== "boolean") {
      return NextResponse.json(
        { error: "isRead must be a boolean" },
        { status: 400 }
      );
    }
    data.isRead = body.isRead;
  }

  if (body.isDismissed !== undefined) {
    if (typeof body.isDismissed !== "boolean") {
      return NextResponse.json(
        { error: "isDismissed must be a boolean" },
        { status: 400 }
      );
    }
    data.isDismissed = body.isDismissed;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json(
      { error: "No valid fields to update" },
      { status: 400 }
    );
  }

  const updated = await prisma.marketSignal.update({
    where: { id },
    data,
  });

  return NextResponse.json({
    id: updated.id,
    isRead: updated.isRead,
    isDismissed: updated.isDismissed,
    updatedAt: new Date().toISOString(),
  });
}
