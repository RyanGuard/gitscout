import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const watched = await prisma.watchedCompany.findMany({
    where: { userId: session.user.id },
    include: {
      _count: {
        select: { signals: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const companies = watched.map((w) => ({
    id: w.id,
    companyName: w.companyName,
    companyDomain: w.companyDomain,
    apolloOrgId: w.apolloOrgId,
    headcount: w.headcount,
    fundingStage: w.fundingStage,
    logoUrl: w.logoUrl,
    signalFilters: w.signalFilters,
    titleFilters: w.titleFilters,
    seniorityFilters: w.seniorityFilters,
    isActive: w.isActive,
    lastScannedAt: w.lastScannedAt?.toISOString() ?? null,
    signalCount: w._count.signals,
    createdAt: w.createdAt.toISOString(),
    updatedAt: w.updatedAt.toISOString(),
  }));

  return NextResponse.json({ companies });
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const {
    companyDomain,
    companyName,
    titleFilters,
    seniorityFilters,
    signalFilters,
  } = body;

  if (!companyDomain || typeof companyDomain !== "string") {
    return NextResponse.json(
      { error: "companyDomain is required" },
      { status: 400 }
    );
  }

  const domain = companyDomain.trim().toLowerCase();

  // Derive company name from domain if not provided
  const name =
    companyName?.trim() ||
    domain
      .replace(/\.(com|io|co|org|net|dev|ai|app|xyz)$/, "")
      .split(".")
      .pop()!
      .replace(/-/g, " ")
      .replace(/\b\w/g, (c: string) => c.toUpperCase());

  // Check for duplicate
  const existing = await prisma.watchedCompany.findUnique({
    where: {
      userId_companyDomain: {
        userId: session.user.id,
        companyDomain: domain,
      },
    },
  });

  if (existing) {
    return NextResponse.json(
      { error: "Company already on watchlist" },
      { status: 409 }
    );
  }

  const watched = await prisma.watchedCompany.create({
    data: {
      userId: session.user.id,
      companyDomain: domain,
      companyName: name,
      titleFilters: titleFilters ?? [],
      seniorityFilters: seniorityFilters ?? [],
      signalFilters: signalFilters ?? [],
    },
  });

  return NextResponse.json(
    {
      id: watched.id,
      companyName: watched.companyName,
      companyDomain: watched.companyDomain,
      titleFilters: watched.titleFilters,
      seniorityFilters: watched.seniorityFilters,
      signalFilters: watched.signalFilters,
      isActive: watched.isActive,
      signalCount: 0,
      createdAt: watched.createdAt.toISOString(),
      updatedAt: watched.updatedAt.toISOString(),
    },
    { status: 201 }
  );
}
