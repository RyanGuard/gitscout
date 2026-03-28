import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
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
    include: { steps: { select: { order: true } } },
  });

  if (!sequence) {
    return NextResponse.json({ error: "Sequence not found" }, { status: 404 });
  }

  if (sequence.userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { channel, delayDays, subjectLine, bodyTemplate, purpose } = body;

  if (!channel || !["email", "linkedin", "inmail"].includes(channel)) {
    return NextResponse.json(
      { error: "Channel is required and must be email, linkedin, or inmail" },
      { status: 400 }
    );
  }

  if (delayDays === undefined || typeof delayDays !== "number" || delayDays < 0) {
    return NextResponse.json(
      { error: "delayDays is required and must be a non-negative number" },
      { status: 400 }
    );
  }

  // Auto-assign order as max(existing orders) + 1
  const maxOrder =
    sequence.steps.length > 0
      ? Math.max(...sequence.steps.map((s) => s.order))
      : -1;
  const nextOrder = maxOrder + 1;

  const step = await prisma.sequenceStep.create({
    data: {
      sequenceId: id,
      order: nextOrder,
      channel,
      delayDays,
      subjectLine: subjectLine?.trim() || null,
      bodyTemplate: bodyTemplate?.trim() || null,
      purpose: purpose?.trim() || null,
    },
  });

  return NextResponse.json(
    {
      id: step.id,
      sequenceId: step.sequenceId,
      order: step.order,
      channel: step.channel,
      delayDays: step.delayDays,
      subjectLine: step.subjectLine,
      bodyTemplate: step.bodyTemplate,
      purpose: step.purpose,
      createdAt: step.createdAt.toISOString(),
    },
    { status: 201 }
  );
}

export async function PUT(
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
    include: { steps: true },
  });

  if (!sequence) {
    return NextResponse.json({ error: "Sequence not found" }, { status: 404 });
  }

  if (sequence.userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { steps } = body;

  if (!Array.isArray(steps)) {
    return NextResponse.json(
      { error: "steps must be an array" },
      { status: 400 }
    );
  }

  // Validate each step in the array
  for (const step of steps) {
    if (!step.channel || !["email", "linkedin", "inmail"].includes(step.channel)) {
      return NextResponse.json(
        { error: "Each step must have a valid channel (email, linkedin, or inmail)" },
        { status: 400 }
      );
    }
    if (step.order === undefined || typeof step.order !== "number" || step.order < 0) {
      return NextResponse.json(
        { error: "Each step must have a non-negative order" },
        { status: 400 }
      );
    }
    if (step.delayDays === undefined || typeof step.delayDays !== "number" || step.delayDays < 0) {
      return NextResponse.json(
        { error: "Each step must have a non-negative delayDays" },
        { status: 400 }
      );
    }
  }

  // Determine which existing steps to delete (not in the incoming array)
  const incomingIds = steps
    .filter((s: { id?: string }) => s.id)
    .map((s: { id: string }) => s.id);
  const existingIds = sequence.steps.map((s) => s.id);
  const toDelete = existingIds.filter((eid) => !incomingIds.includes(eid));

  // Execute in a transaction: delete removed steps, then upsert the rest
  await prisma.$transaction(async (tx) => {
    // Delete steps that are no longer in the array
    if (toDelete.length > 0) {
      await tx.sequenceStep.deleteMany({
        where: {
          id: { in: toDelete },
          sequenceId: id,
        },
      });
    }

    // Upsert each step
    for (const step of steps) {
      if (step.id && existingIds.includes(step.id)) {
        // Update existing step
        await tx.sequenceStep.update({
          where: { id: step.id },
          data: {
            order: step.order,
            channel: step.channel,
            delayDays: step.delayDays,
            subjectLine: step.subjectLine?.trim() || null,
            bodyTemplate: step.bodyTemplate?.trim() || null,
            purpose: step.purpose?.trim() || null,
          },
        });
      } else {
        // Create new step
        await tx.sequenceStep.create({
          data: {
            sequenceId: id,
            order: step.order,
            channel: step.channel,
            delayDays: step.delayDays,
            subjectLine: step.subjectLine?.trim() || null,
            bodyTemplate: step.bodyTemplate?.trim() || null,
            purpose: step.purpose?.trim() || null,
          },
        });
      }
    }
  });

  // Fetch the updated steps
  const updatedSteps = await prisma.sequenceStep.findMany({
    where: { sequenceId: id },
    orderBy: { order: "asc" },
  });

  return NextResponse.json({
    steps: updatedSteps.map((step) => ({
      id: step.id,
      sequenceId: step.sequenceId,
      order: step.order,
      channel: step.channel,
      delayDays: step.delayDays,
      subjectLine: step.subjectLine,
      bodyTemplate: step.bodyTemplate,
      purpose: step.purpose,
      createdAt: step.createdAt.toISOString(),
    })),
  });
}
