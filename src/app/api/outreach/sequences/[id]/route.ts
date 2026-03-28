import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const sequence = await prisma.outreachSequence.findFirst({
    where: { id, userId: session.user.id },
    include: { messages: { orderBy: { stepNumber: "asc" } } },
  });

  if (!sequence) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  return Response.json(sequence);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();

  // Verify ownership
  const existing = await prisma.outreachSequence.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!existing) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  // Build update data from allowed fields
  const updateData: Record<string, unknown> = {};
  const allowed = [
    "status", "responseReceived", "responseSentiment",
    "roleTitle", "roleCompany", "sellingPoints",
    "channel", "tone", "sequenceLength",
  ];
  for (const key of allowed) {
    if (body[key] !== undefined) updateData[key] = body[key];
  }

  // Handle message updates
  if (body.messages?.length) {
    for (const msg of body.messages) {
      if (msg.id) {
        await prisma.outreachStudioMessage.update({
          where: { id: msg.id },
          data: {
            body: msg.body,
            subjectLine: msg.subjectLine,
            channel: msg.channel,
            delayDays: msg.delayDays,
            sentAt: msg.sentAt ? new Date(msg.sentAt) : undefined,
            respondedAt: msg.respondedAt ? new Date(msg.respondedAt) : undefined,
            revisionHistory: msg.revisionHistory,
          },
        });
      }
    }
  }

  const updated = await prisma.outreachSequence.update({
    where: { id },
    data: updateData,
    include: { messages: { orderBy: { stepNumber: "asc" } } },
  });

  // If response received, record analytics
  if (body.responseReceived && body.responseSentiment) {
    await prisma.outreachAnalytic.create({
      data: {
        userId: session.user.id,
        channel: existing.channel,
        tone: existing.tone,
        sequenceLength: existing.sequenceLength,
        candidateSeniority: (existing.candidateContext as Record<string, unknown>)?.seniority as string || null,
        roleType: existing.roleTitle || null,
        usedOssReference: !!(existing.candidateContext as Record<string, unknown>)?.topRepos,
        usedCompanyNews: false,
        usedMutualConnection: !!(existing.candidateContext as Record<string, unknown>)?.connections,
        responseReceived: true,
        responseSentiment: body.responseSentiment,
        responseTimeHours: body.responseTimeHours || null,
      },
    });
  }

  return Response.json(updated);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const existing = await prisma.outreachSequence.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!existing) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.outreachSequence.delete({ where: { id } });

  return Response.json({ success: true });
}
