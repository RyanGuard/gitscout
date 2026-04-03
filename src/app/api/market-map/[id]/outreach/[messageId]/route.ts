import { getAuthUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logStatusChange } from "@/lib/map/statusHistory";
import { logOutreachSignal } from "@/lib/map/outreachSignals";

const VALID_STATUSES = ["draft", "sent", "responded", "bounced"];

export async function PATCH(
  request: Request,
  {
    params,
  }: { params: Promise<{ id: string; messageId: string }> }
) {
  const userId = await getAuthUserId(request);
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: mapId, messageId } = await params;
  const body = await request.json().catch(() => ({}));

  if (!body.status || !VALID_STATUSES.includes(body.status)) {
    return Response.json(
      { error: `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}` },
      { status: 400 }
    );
  }

  // Fetch the message
  const message = await prisma.outreachMessage.findFirst({
    where: { id: messageId, mapId, userId },
  });

  if (!message) {
    return Response.json({ error: "Message not found" }, { status: 404 });
  }

  // Update the message
  const updateData: Record<string, unknown> = { status: body.status };
  if (body.status === "sent" && !message.sentAt) {
    updateData.sentAt = new Date();
  }
  if (body.status === "responded") {
    updateData.responseReceivedAt = new Date();
  }

  const updated = await prisma.outreachMessage.update({
    where: { id: messageId },
    data: updateData,
  });

  // Update candidate outreach status
  await prisma.mapCandidate.update({
    where: { id: message.candidateId },
    data: { outreachStatus: body.status },
  });

  // If marked as responded, auto-advance candidate pipeline status
  if (body.status === "responded") {
    const candidate = await prisma.mapCandidate.findUnique({
      where: { id: message.candidateId },
      select: { status: true },
    });

    if (candidate && candidate.status !== "responded" && candidate.status !== "screening" && candidate.status !== "offer") {
      await prisma.mapCandidate.update({
        where: { id: message.candidateId },
        data: { status: "responded" },
      });
      await logStatusChange(
        message.candidateId,
        mapId,
        candidate.status,
        "responded",
        userId
      );
    }
  }

  // Log outreach signal (Phase 4 data foundation)
  try {
    const candidate = await prisma.mapCandidate.findUnique({
      where: { id: message.candidateId },
      include: {
        company: { select: { companyDomain: true } },
      },
    });

    if (candidate) {
      const responseTimeHours =
        body.status === "responded" && message.sentAt
          ? Math.round(
              (Date.now() - new Date(message.sentAt).getTime()) /
                (1000 * 60 * 60)
            )
          : undefined;

      await logOutreachSignal({
        companyDomain: candidate.company.companyDomain,
        candidateSeniority: candidate.seniority || undefined,
        candidateTitleKeywords: candidate.title
          ? candidate.title.toLowerCase().split(/[\s,]+/).filter((w) => w.length > 2)
          : undefined,
        outreachSentAt: message.sentAt ? new Date(message.sentAt) : undefined,
        responseReceived: body.status === "responded",
        responseTimeHours,
        bounce: body.status === "bounced",
        userId,
      });
    }
  } catch (err) {
    // Signal logging is best-effort — don't fail the request
    console.error("Failed to log outreach signal:", err);
  }

  return Response.json({
    id: updated.id,
    status: updated.status,
    sentAt: updated.sentAt,
    responseReceivedAt: updated.responseReceivedAt,
  });
}

export async function GET(
  request: Request,
  {
    params,
  }: { params: Promise<{ id: string; messageId: string }> }
) {
  const userId = await getAuthUserId(request);
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: mapId, messageId } = await params;

  // If messageId is "by-candidate", list messages for a candidate
  if (messageId === "by-candidate") {
    return Response.json({ error: "Use query param candidateId" }, { status: 400 });
  }

  const message = await prisma.outreachMessage.findFirst({
    where: { id: messageId, mapId, userId },
  });

  if (!message) {
    return Response.json({ error: "Message not found" }, { status: 404 });
  }

  return Response.json({ message });
}
