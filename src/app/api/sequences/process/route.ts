import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { generateSequenceMessage } from "@/lib/sequences/generateMessage";
import { sendOutreachEmail, wrapInEmailTemplate } from "@/lib/email/send";

const BATCH_SIZE = 20;

export async function POST() {
  // Find enrollments due to send
  const dueEnrollments = await prisma.sequenceEnrollment.findMany({
    where: {
      status: "active",
      nextSendAt: { lte: new Date() },
      sequence: { status: "active" },
    },
    include: {
      sequence: {
        include: { steps: { orderBy: { order: "asc" } } },
      },
      messages: { orderBy: { stepOrder: "asc" } },
    },
    take: BATCH_SIZE,
  });

  let processed = 0;
  let errors = 0;

  for (const enrollment of dueEnrollments) {
    try {
      const step = enrollment.sequence.steps[enrollment.currentStep];
      if (!step) {
        // No more steps — mark completed
        await prisma.sequenceEnrollment.update({
          where: { id: enrollment.id },
          data: { status: "completed", completedAt: new Date(), nextSendAt: null },
        });
        await prisma.sequence.update({
          where: { id: enrollment.sequenceId },
          data: { totalCompleted: { increment: 1 } },
        });
        continue;
      }

      const ctx = (enrollment.candidateContext || {}) as Record<string, unknown>;
      const seq = enrollment.sequence;

      // Build previous messages for context
      const previousMessages = enrollment.messages.map((m) => ({
        channel: m.channel,
        body: m.body,
      }));

      // Generate message via Claude
      const generated = await generateSequenceMessage({
        candidateContext: {
          name: enrollment.candidateName,
          title: enrollment.candidateTitle || undefined,
          company: enrollment.candidateCompany || undefined,
          linkedinUrl: enrollment.candidateLinkedinUrl || undefined,
          ...ctx,
        },
        channel: step.channel,
        stepOrder: step.order,
        purpose: step.purpose || undefined,
        tone: seq.tone,
        sellingPoints: seq.sellingPoints,
        customInstructions: seq.customInstructions || undefined,
        roleTitle: seq.roleTitle || undefined,
        companyName: seq.companyName || undefined,
        previousMessages,
      });

      let messageStatus = "draft";
      let resendMessageId: string | undefined;
      let sentAt: Date | undefined;

      // Send email if channel is email
      if (step.channel === "email" && enrollment.candidateEmail) {
        try {
          const result = await sendOutreachEmail({
            to: enrollment.candidateEmail,
            subject: generated.subjectLine || `About the ${seq.roleTitle || "opportunity"}`,
            html: wrapInEmailTemplate(generated.body),
          });
          resendMessageId = result.id;
          messageStatus = "sent";
          sentAt = new Date();
        } catch {
          messageStatus = "draft"; // Failed to send — keep as draft
        }
      }

      // Save the message
      await prisma.sequenceMessage.create({
        data: {
          enrollmentId: enrollment.id,
          stepOrder: step.order,
          channel: step.channel,
          subjectLine: generated.subjectLine,
          body: generated.body,
          status: messageStatus,
          resendMessageId,
          sentAt,
        },
      });

      // Advance to next step
      const nextStepIndex = enrollment.currentStep + 1;
      const nextStep = seq.steps[nextStepIndex];

      if (nextStep) {
        const nextSendAt = new Date(
          Date.now() + nextStep.delayDays * 24 * 60 * 60 * 1000
        );
        await prisma.sequenceEnrollment.update({
          where: { id: enrollment.id },
          data: { currentStep: nextStepIndex, nextSendAt },
        });
      } else {
        // Last step done
        await prisma.sequenceEnrollment.update({
          where: { id: enrollment.id },
          data: {
            currentStep: nextStepIndex,
            status: "completed",
            completedAt: new Date(),
            nextSendAt: null,
          },
        });
        await prisma.sequence.update({
          where: { id: enrollment.sequenceId },
          data: { totalCompleted: { increment: 1 } },
        });
      }

      processed++;
    } catch {
      errors++;
    }
  }

  return NextResponse.json({
    processed,
    errors,
    remaining: dueEnrollments.length === BATCH_SIZE,
  });
}
