import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
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
      steps: { orderBy: { order: "asc" } },
      _count: { select: { enrollments: true } },
    },
  });

  if (!sequence) {
    return NextResponse.json({ error: "Sequence not found" }, { status: 404 });
  }

  if (sequence.userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Validate: must have at least 1 step
  if (sequence.steps.length === 0) {
    return NextResponse.json(
      { error: "Cannot activate a sequence with no steps" },
      { status: 400 }
    );
  }

  // Validate: must have at least 1 enrollment
  if (sequence._count.enrollments === 0) {
    return NextResponse.json(
      { error: "Cannot activate a sequence with no enrollments" },
      { status: 400 }
    );
  }

  // Get the first step to calculate nextSendAt for enrollments
  const firstStep = sequence.steps[0];

  // For each active enrollment with no nextSendAt, calculate it based on
  // the first step's delayDays from now
  const enrollmentsToUpdate = await prisma.sequenceEnrollment.findMany({
    where: {
      sequenceId: id,
      status: "active",
      nextSendAt: null,
    },
  });

  if (enrollmentsToUpdate.length > 0) {
    const now = new Date();
    const nextSendAt = new Date(
      now.getTime() + firstStep.delayDays * 24 * 60 * 60 * 1000
    );

    await prisma.sequenceEnrollment.updateMany({
      where: {
        id: { in: enrollmentsToUpdate.map((e) => e.id) },
      },
      data: {
        nextSendAt,
      },
    });
  }

  // Set sequence status to active
  const updated = await prisma.sequence.update({
    where: { id },
    data: { status: "active" },
  });

  return NextResponse.json({
    id: updated.id,
    status: updated.status,
    enrollmentsScheduled: enrollmentsToUpdate.length,
  });
}
