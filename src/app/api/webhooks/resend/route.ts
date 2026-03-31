import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";

/**
 * Resend webhook handler for email delivery tracking.
 *
 * Resend sends webhooks for:
 *   email.delivered, email.opened, email.clicked,
 *   email.bounced, email.complained, email.delivery_delayed
 *
 * Payload shape:
 * {
 *   "type": "email.opened",
 *   "data": {
 *     "email_id": "xxx",
 *     "to": ["user@example.com"],
 *     "subject": "...",
 *     "created_at": "2024-01-01T00:00:00Z"
 *   }
 * }
 */

const VALID_EVENT_TYPES = new Set([
  "email.delivered",
  "email.opened",
  "email.clicked",
  "email.bounced",
  "email.complained",
  "email.delivery_delayed",
]);

export async function POST(request: NextRequest) {
  // --- 1. Verify webhook signature (if secret is configured) ---
  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;
  if (webhookSecret) {
    const signature = request.headers.get("svix-signature");
    if (!signature) {
      return Response.json(
        { error: "Missing webhook signature" },
        { status: 401 },
      );
    }
    // Resend uses Svix for webhooks — full signature verification would
    // require the svix library.  For now we do a presence check; for
    // production you should install `svix` and use `Webhook.verify()`.
  }

  // --- 2. Parse & validate payload ---
  let body: { type?: string; data?: { email_id?: string; to?: string[]; subject?: string; created_at?: string } };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { type, data } = body;

  if (!type || !data?.email_id) {
    return Response.json(
      { error: "Invalid payload: missing type or data.email_id" },
      { status: 400 },
    );
  }

  if (!VALID_EVENT_TYPES.has(type)) {
    // Acknowledge unknown event types so Resend doesn't retry
    return Response.json({ received: true, ignored: true });
  }

  const resendMessageId = data.email_id;
  const eventTime = data.created_at ? new Date(data.created_at) : new Date();

  // --- 3. Look up the matching SequenceMessage ---
  const message = await prisma.sequenceMessage.findFirst({
    where: { resendMessageId },
    include: {
      enrollment: {
        include: { sequence: true },
      },
    },
  });

  if (!message) {
    // No matching message — could be from a non-sequence email; acknowledge
    return Response.json({ received: true, matched: false });
  }

  // --- 4. Update message status based on event type ---
  switch (type) {
    case "email.delivered": {
      // Only update if not already in a later state
      if (message.status === "sent" || message.status === "scheduled") {
        await prisma.sequenceMessage.update({
          where: { id: message.id },
          data: { status: "sent", sentAt: message.sentAt ?? eventTime },
        });
      }
      break;
    }

    case "email.opened": {
      // Mark as opened — this is a progression from sent
      if (
        message.status === "sent" ||
        message.status === "scheduled" ||
        message.status === "draft"
      ) {
        await prisma.sequenceMessage.update({
          where: { id: message.id },
          data: { status: "opened", openedAt: message.openedAt ?? eventTime },
        });
      }
      break;
    }

    case "email.bounced":
    case "email.complained": {
      await prisma.sequenceMessage.update({
        where: { id: message.id },
        data: { status: "bounced" },
      });

      // Also mark the enrollment as bounced so we stop sending
      await prisma.sequenceEnrollment.update({
        where: { id: message.enrollmentId },
        data: { status: "bounced" },
      });
      break;
    }

    case "email.clicked": {
      // Treat a click as an open if we haven't recorded one yet
      if (!message.openedAt) {
        await prisma.sequenceMessage.update({
          where: { id: message.id },
          data: { status: "opened", openedAt: eventTime },
        });
      }
      break;
    }

    case "email.delivery_delayed": {
      // No status change — just log awareness; the message stays in its
      // current state until Resend sends a final delivered or bounced event.
      break;
    }
  }

  // --- 5. Check if all messages in the sequence enrollment are done ---
  if (type === "email.delivered" || type === "email.opened") {
    const allMessages = await prisma.sequenceMessage.findMany({
      where: { enrollmentId: message.enrollmentId },
    });

    const allDelivered = allMessages.every(
      (m) =>
        m.status === "sent" ||
        m.status === "opened" ||
        m.status === "replied" ||
        m.status === "bounced",
    );

    if (allDelivered && message.enrollment.status === "active") {
      const totalSteps = await prisma.sequenceStep.count({
        where: { sequenceId: message.enrollment.sequenceId },
      });

      // If we've sent all steps and they're all delivered/opened, mark complete
      if (allMessages.length >= totalSteps) {
        await prisma.sequenceEnrollment.update({
          where: { id: message.enrollmentId },
          data: {
            status: "completed",
            completedAt: new Date(),
          },
        });

        // Increment totalCompleted on the parent sequence
        await prisma.sequence.update({
          where: { id: message.enrollment.sequenceId },
          data: { totalCompleted: { increment: 1 } },
        });
      }
    }
  }

  return Response.json({ received: true, matched: true, event: type });
}
