import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendOutreachEmail, wrapInEmailTemplate } from "@/lib/email/send";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { sequenceId } = body;

  if (!sequenceId) {
    return Response.json({ error: "Sequence ID is required" }, { status: 400 });
  }

  // Load the sequence with messages ordered by step number
  const sequence = await prisma.outreachSequence.findUnique({
    where: { id: sequenceId },
    include: {
      messages: {
        orderBy: { stepNumber: "asc" },
      },
    },
  });

  if (!sequence) {
    return Response.json({ error: "Sequence not found" }, { status: 404 });
  }

  // Verify ownership
  if (sequence.userId !== session.user.id) {
    return Response.json({ error: "Sequence not found" }, { status: 404 });
  }

  // Check that the candidate has an email address
  if (!sequence.candidateEmail) {
    return Response.json(
      { error: "Candidate does not have an email address" },
      { status: 400 },
    );
  }

  // Find the first unsent email message
  const emailMessages = sequence.messages.filter(
    (m) => m.channel === "email" && !m.sentAt,
  );

  if (emailMessages.length === 0) {
    return Response.json(
      { error: "No unsent email messages in this sequence" },
      { status: 400 },
    );
  }

  const firstMessage = emailMessages[0];

  // Build subject line
  const subject =
    firstMessage.subjectLine ||
    `About the ${sequence.roleTitle || "opportunity"}`;

  // Send via Resend
  try {
    const result = await sendOutreachEmail({
      to: sequence.candidateEmail,
      subject,
      html: wrapInEmailTemplate(firstMessage.body),
    });

    // Update the message with send details
    await prisma.outreachStudioMessage.update({
      where: { id: firstMessage.id },
      data: {
        sentAt: new Date(),
        resendMessageId: result.id,
      },
    });

    // Update sequence status to "sending"
    await prisma.outreachSequence.update({
      where: { id: sequenceId },
      data: { status: "sending" },
    });

    return Response.json({
      success: true,
      messageId: firstMessage.id,
      resendId: result.id,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to send email";
    return Response.json({ error: message }, { status: 500 });
  }
}
