import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const {
    name,
    description,
    tone,
    sellingPoints,
    customInstructions,
    roleTitle,
    roleDescription,
    companyName,
  } = body;

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const sequence = await prisma.sequence.create({
    data: {
      userId: session.user.id,
      name: name.trim(),
      description: description?.trim() || null,
      tone: tone || "professional",
      sellingPoints: sellingPoints || [],
      customInstructions: customInstructions?.trim() || null,
      roleTitle: roleTitle?.trim() || null,
      roleDescription: roleDescription?.trim() || null,
      companyName: companyName?.trim() || null,
    },
  });

  return NextResponse.json(
    {
      id: sequence.id,
      name: sequence.name,
      description: sequence.description,
      status: sequence.status,
      tone: sequence.tone,
      sellingPoints: sequence.sellingPoints,
      customInstructions: sequence.customInstructions,
      roleTitle: sequence.roleTitle,
      roleDescription: sequence.roleDescription,
      companyName: sequence.companyName,
      totalEnrolled: sequence.totalEnrolled,
      totalCompleted: sequence.totalCompleted,
      totalReplied: sequence.totalReplied,
      createdAt: sequence.createdAt.toISOString(),
      updatedAt: sequence.updatedAt.toISOString(),
    },
    { status: 201 }
  );
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sequences = await prisma.sequence.findMany({
    where: { userId: session.user.id },
    include: {
      _count: {
        select: {
          steps: true,
          enrollments: true,
        },
      },
      enrollments: {
        select: { status: true },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  const result = sequences.map((seq) => {
    const activeEnrollments = seq.enrollments.filter(
      (e) => e.status === "active"
    ).length;
    const completedEnrollments = seq.enrollments.filter(
      (e) => e.status === "completed"
    ).length;
    const repliedEnrollments = seq.enrollments.filter(
      (e) => e.status === "replied"
    ).length;

    return {
      id: seq.id,
      name: seq.name,
      description: seq.description,
      status: seq.status,
      tone: seq.tone,
      roleTitle: seq.roleTitle,
      companyName: seq.companyName,
      stepCount: seq._count.steps,
      totalEnrolled: seq._count.enrollments,
      activeEnrollments,
      completedEnrollments,
      repliedEnrollments,
      totalCompleted: seq.totalCompleted,
      totalReplied: seq.totalReplied,
      createdAt: seq.createdAt.toISOString(),
      updatedAt: seq.updatedAt.toISOString(),
    };
  });

  return NextResponse.json({ sequences: result });
}
