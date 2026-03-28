import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const existing = await prisma.watchedCompany.findUnique({
    where: { id },
  });

  if (!existing) {
    return NextResponse.json(
      { error: "Watched company not found" },
      { status: 404 }
    );
  }

  if (existing.userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const allowedFields = [
    "companyName",
    "titleFilters",
    "seniorityFilters",
    "signalFilters",
    "isActive",
  ];

  const data: Record<string, unknown> = {};
  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      if (field === "companyName") {
        const val = body[field];
        if (typeof val !== "string" || !val.trim()) {
          return NextResponse.json(
            { error: "companyName cannot be empty" },
            { status: 400 }
          );
        }
        data[field] = val.trim();
      } else if (field === "isActive") {
        if (typeof body[field] !== "boolean") {
          return NextResponse.json(
            { error: "isActive must be a boolean" },
            { status: 400 }
          );
        }
        data[field] = body[field];
      } else {
        // Array fields: titleFilters, seniorityFilters, signalFilters
        if (!Array.isArray(body[field])) {
          return NextResponse.json(
            { error: `${field} must be an array` },
            { status: 400 }
          );
        }
        data[field] = body[field];
      }
    }
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json(
      { error: "No valid fields to update" },
      { status: 400 }
    );
  }

  const updated = await prisma.watchedCompany.update({
    where: { id },
    data,
  });

  return NextResponse.json({
    id: updated.id,
    companyName: updated.companyName,
    companyDomain: updated.companyDomain,
    titleFilters: updated.titleFilters,
    seniorityFilters: updated.seniorityFilters,
    signalFilters: updated.signalFilters,
    isActive: updated.isActive,
    lastScannedAt: updated.lastScannedAt?.toISOString() ?? null,
    signalCount: updated.signalCount,
    createdAt: updated.createdAt.toISOString(),
    updatedAt: updated.updatedAt.toISOString(),
  });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const existing = await prisma.watchedCompany.findUnique({
    where: { id },
  });

  if (!existing) {
    return NextResponse.json(
      { error: "Watched company not found" },
      { status: 404 }
    );
  }

  if (existing.userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.watchedCompany.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
