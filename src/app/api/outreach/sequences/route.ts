import { getAuthUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const userId = await getAuthUserId(request);
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sequences = await prisma.outreachSequence.findMany({
    where: { userId },
    include: {
      messages: { orderBy: { stepNumber: "asc" } },
    },
    orderBy: { updatedAt: "desc" },
  });

  return Response.json({
    sequences: sequences.map((s) => ({
      id: s.id,
      candidateName: s.candidateName,
      candidateTitle: s.candidateTitle,
      candidateCompany: s.candidateCompany,
      channel: s.channel,
      tone: s.tone,
      status: s.status,
      responseReceived: s.responseReceived,
      responseSentiment: s.responseSentiment,
      messageCount: s.messages.length,
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
    })),
  });
}

export async function POST(request: Request) {
  const userId = await getAuthUserId(request);
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const {
    candidateName,
    candidateTitle,
    candidateCompany,
    candidateLocation,
    candidateLinkedinUrl,
    candidateEmail,
    candidateGithubUrl,
    candidateContext,
    sourceType,
    sourceDeveloperId,
    sourceMapId,
    roleTitle,
    roleCompany,
    sellingPoints,
    channel,
    tone,
    sequenceLength,
    messages,
  } = body;

  if (!candidateName?.trim()) {
    return Response.json({ error: "Candidate name is required" }, { status: 400 });
  }

  const sequence = await prisma.outreachSequence.create({
    data: {
      userId,
      candidateName: candidateName.trim(),
      candidateTitle: candidateTitle?.trim() || null,
      candidateCompany: candidateCompany?.trim() || null,
      candidateLocation: candidateLocation?.trim() || null,
      candidateLinkedinUrl: candidateLinkedinUrl?.trim() || null,
      candidateEmail: candidateEmail?.trim() || null,
      candidateGithubUrl: candidateGithubUrl?.trim() || null,
      candidateContext: candidateContext || null,
      sourceType: sourceType || "manual",
      sourceDeveloperId: sourceDeveloperId || null,
      sourceMapId: sourceMapId || null,
      roleTitle: roleTitle?.trim() || null,
      roleCompany: roleCompany?.trim() || null,
      sellingPoints: sellingPoints || [],
      channel: channel || "email",
      tone: tone || "professional",
      sequenceLength: sequenceLength || 3,
      messages: messages?.length
        ? {
            create: messages.map((m: { stepNumber: number; delayDays: number; channel: string; subjectLine: string | null; body: string }) => ({
              stepNumber: m.stepNumber,
              delayDays: m.delayDays || 0,
              channel: m.channel,
              subjectLine: m.subjectLine || null,
              body: m.body,
            })),
          }
        : undefined,
    },
    include: { messages: { orderBy: { stepNumber: "asc" } } },
  });

  return Response.json(sequence, { status: 201 });
}
