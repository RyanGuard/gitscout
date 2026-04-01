import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { sequenceId, viewFirst, likePost, scheduledFor } = body;

  if (!sequenceId) {
    return Response.json({ error: "Sequence ID is required" }, { status: 400 });
  }

  // Load the sequence with messages
  const sequence = await prisma.outreachSequence.findUnique({
    where: { id: sequenceId },
    include: { messages: true },
  });

  if (!sequence) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  // Verify ownership
  if (sequence.userId !== session.user.id) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  // Check candidateLinkedinUrl exists
  if (!sequence.candidateLinkedinUrl) {
    return Response.json({ error: "Candidate LinkedIn URL is required" }, { status: 400 });
  }

  const supabaseUserId = process.env.SUPABASE_AGENT_USER_ID;
  if (!supabaseUserId) {
    return Response.json({ error: "LinkedIn agent not configured" }, { status: 500 });
  }

  const now = scheduledFor ? new Date(scheduledFor) : new Date();
  const linkedinUrl = sequence.candidateLinkedinUrl;
  const candidateName = sequence.candidateName;

  // Build action list
  const actions: Array<{
    type: string;
    note?: string | null;
    body?: string | null;
    scheduledFor: Date;
    priority: number;
  }> = [];

  // Step 1: View profile if requested
  if (viewFirst) {
    actions.push({
      type: "view_profile",
      scheduledFor: new Date(now.getTime()),
      priority: 1,
    });
  }

  // Step 2: Like post if requested (scheduled_for: now + 3 min)
  if (likePost) {
    actions.push({
      type: "like_post",
      scheduledFor: new Date(now.getTime() + 3 * 60 * 1000),
      priority: 2,
    });
  }

  // Sort messages by step number
  const sortedMessages = [...sequence.messages].sort((a, b) => a.stepNumber - b.stepNumber);

  // Filter to LinkedIn messages only
  const linkedinMessages = sortedMessages.filter(
    (m) => m.channel === "linkedin" || sequence.channel === "linkedin"
  );

  for (let i = 0; i < linkedinMessages.length; i++) {
    const msg = linkedinMessages[i];
    if (i === 0) {
      // First LinkedIn message -> connect with connection_note (scheduled_for: now + 6 min)
      actions.push({
        type: "connect",
        note: msg.body.slice(0, 200),
        scheduledFor: new Date(now.getTime() + 6 * 60 * 1000),
        priority: 3,
      });
    } else {
      // Subsequent LinkedIn messages -> message with body (scheduled_for: based on delayDays)
      actions.push({
        type: "message",
        body: msg.body,
        scheduledFor: new Date(now.getTime() + (msg.delayDays || 1) * 24 * 60 * 60 * 1000),
        priority: 5,
      });
    }
  }

  try {
    // Insert via $executeRaw into linkedin_action_queue
    for (const action of actions) {
      await prisma.$executeRaw`
        INSERT INTO linkedin_action_queue (id, user_id, sequence_id, action_type, target_linkedin_url, target_name, connection_note, message_body, scheduled_for, priority, status, created_at)
        VALUES (
          gen_random_uuid(),
          ${supabaseUserId}::uuid,
          ${sequenceId},
          ${action.type},
          ${linkedinUrl},
          ${candidateName},
          ${action.note || null},
          ${action.body || null},
          ${action.scheduledFor},
          ${action.priority},
          'queued',
          now()
        )
      `;
    }

    // Update sequence with linkedinQueuedAt
    await prisma.outreachSequence.update({
      where: { id: sequenceId },
      data: { linkedinQueuedAt: new Date() },
    });

    return Response.json({
      queued: actions.length,
      actions: actions.map((a) => ({
        type: a.type,
        scheduledFor: a.scheduledFor.toISOString(),
        priority: a.priority,
      })),
    });
  } catch (err) {
    console.error("LinkedIn queue error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: `Queue failed: ${message}` }, { status: 500 });
  }
}
