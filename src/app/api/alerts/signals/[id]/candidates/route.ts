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
    select: { userId: true },
  });

  if (!signal) {
    return NextResponse.json({ error: "Signal not found" }, { status: 404 });
  }

  if (signal.userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const candidates = await prisma.surfacedCandidate.findMany({
    where: { signalId: id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    candidates: candidates.map((c) => ({
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
