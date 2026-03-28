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

  const sequence = await prisma.sequence.findUnique({
    where: { id },
    include: {
      steps: {
        orderBy: { order: "asc" },
      },
      enrollments: {
        select: { status: true },
      },
    },
  });

  if (!sequence) {
    return NextResponse.json({ error: "Sequence not found" }, { status: 404 });
  }

  if (sequence.userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const activeEnrollments = sequence.enrollments.filter(
    (e) => e.status === "active"
  ).length;
  const completedEnrollments = sequence.enrollments.filter(
    (e) => e.status === "completed"
  ).length;
  const repliedEnrollments = sequence.enrollments.filter(
    (e) => e.status === "replied"
  ).length;
  const bouncedEnrollments = sequence.enrollments.filter(
    (e) => e.status === "bounced"
  ).length;

  return NextResponse.json({
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
    totalEnrolled: sequence.enrollments.length,
    totalCompleted: sequence.totalCompleted,
    totalReplied: sequence.totalReplied,
    steps: sequence.steps.map((step) => ({
      id: step.id,
      order: step.order,
      channel: step.channel,
      delayDays: step.delayDays,
      subjectLine: step.subjectLine,
      bodyTemplate: step.bodyTemplate,
      purpose: step.purpose,
      createdAt: step.createdAt.toISOString(),
    })),
    enrollmentStats: {
      total: sequence.enrollments.length,
      active: activeEnrollments,
      completed: completedEnrollments,
      replied: repliedEnrollments,
      bounced: bouncedEnrollments,
    },
    createdAt: sequence.createdAt.toISOString(),
    updatedAt: sequence.updatedAt.toISOString(),
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

  const sequence = await prisma.sequence.findUnique({
    where: { id },
  });

  if (!sequence) {
    return NextResponse.json({ error: "Sequence not found" }, { status: 404 });
  }

  if (sequence.userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const allowedFields = [
    "name",
    "description",
    "tone",
    "sellingPoints",
    "customInstructions",
    "roleTitle",
    "roleDescription",
    "companyName",
    "status",
  ];

  const data: Record<string, unknown> = {};
  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      if (field === "sellingPoints") {
        data[field] = body[field];
      } else if (typeof body[field] === "string") {
        data[field] = body[field].trim() || null;
      } else {
        data[field] = body[field];
      }
    }
  }

  // Validate name is not empty if provided
  if (data.name !== undefined && (!data.name || typeof data.name !== "string")) {
    return NextResponse.json(
      { error: "Name cannot be empty" },
      { status: 400 }
    );
  }

  // Validate status if provided
  if (
    data.status !== undefined &&
    !["draft", "active", "paused", "completed"].includes(data.status as string)
  ) {
    return NextResponse.json(
      { error: "Invalid status. Must be draft, active, paused, or completed" },
      { status: 400 }
    );
  }

  const updated = await prisma.sequence.update({
    where: { id },
    data,
  });

  return NextResponse.json({
    id: updated.id,
    name: updated.name,
    description: updated.description,
    status: updated.status,
    tone: updated.tone,
    sellingPoints: updated.sellingPoints,
    customInstructions: updated.customInstructions,
    roleTitle: updated.roleTitle,
    roleDescription: updated.roleDescription,
    companyName: updated.companyName,
    totalEnrolled: updated.totalEnrolled,
    totalCompleted: updated.totalCompleted,
    totalReplied: updated.totalReplied,
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

  const sequence = await prisma.sequence.findUnique({
    where: { id },
  });

  if (!sequence) {
    return NextResponse.json({ error: "Sequence not found" }, { status: 404 });
  }

  if (sequence.userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.sequence.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
