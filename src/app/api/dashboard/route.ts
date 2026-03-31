import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { computeOutreachAnalytics } from "@/lib/outreach/analytics";

interface LinkedinAction {
  id: string;
  action_type: string;
  status: string;
  target_name: string | null;
  scheduled_for: Date | null;
  executed_at: Date | null;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [sequences, analytics, linkedinActions] = await Promise.all([
    // 1. Recent sequences
    prisma.outreachSequence.findMany({
      where: { userId: session.user.id },
      orderBy: { updatedAt: "desc" },
      take: 50,
      include: { _count: { select: { messages: true } } },
    }),

    // 2. Analytics records for metrics
    prisma.outreachAnalytic.findMany({
      where: { userId: session.user.id },
    }),

    // 3. LinkedIn agent actions (raw SQL since not in Prisma)
    (
      prisma.$queryRaw<LinkedinAction[]>`
      SELECT id, action_type, status, target_name, scheduled_for, executed_at
      FROM linkedin_action_queue
      WHERE user_id = ${process.env.SUPABASE_AGENT_USER_ID || ""}
      AND scheduled_for >= CURRENT_DATE - INTERVAL '30 days'
      ORDER BY scheduled_for DESC
      LIMIT 100
    ` as Promise<LinkedinAction[]>
    ).catch(() => [] as LinkedinAction[]),
  ]);

  const now = new Date();
  const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // Needs attention: sequences stuck in sending 3+ days
  const stuckSequences = sequences
    .filter(
      (s) => s.status === "sending" && s.updatedAt < threeDaysAgo
    )
    .map((s) => ({
      type: "stuck" as const,
      id: s.id,
      candidateName: s.candidateName,
      reason: "Stuck in sending for 3+ days",
      updatedAt: s.updatedAt.toISOString(),
    }));

  // Needs attention: no response after 7+ days
  const awaitingResponse = sequences
    .filter(
      (s) =>
        s.status === "sending" &&
        s.updatedAt < sevenDaysAgo &&
        !s.responseReceived
    )
    .map((s) => ({
      type: "awaiting_response" as const,
      id: s.id,
      candidateName: s.candidateName,
      reason: "No response after 7+ days",
      updatedAt: s.updatedAt.toISOString(),
    }));

  // Needs attention: positive responses needing action
  const positiveResponses = sequences
    .filter(
      (s) => s.responseReceived === true && s.responseSentiment === "positive"
    )
    .map((s) => ({
      type: "positive_response" as const,
      id: s.id,
      candidateName: s.candidateName,
      reason: "Positive response needs follow-up",
      updatedAt: s.updatedAt.toISOString(),
    }));

  // Funnel
  const funnel = {
    drafted: sequences.filter((s) => s.status === "draft").length,
    sent: sequences.filter(
      (s) => s.status === "sending" || s.status === "completed"
    ).length,
    viewed: linkedinActions.filter(
      (a) => a.action_type === "view_profile" && a.status === "completed"
    ).length,
    connected: linkedinActions.filter(
      (a) => a.action_type === "connect" && a.status === "completed"
    ).length,
    messaged: linkedinActions.filter(
      (a) => a.action_type === "message" && a.status === "completed"
    ).length,
    responded: sequences.filter((s) => s.responseReceived).length,
  };

  // Agent status
  const todayStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  );
  const todayActions = linkedinActions.filter(
    (a) => a.executed_at && new Date(a.executed_at) >= todayStart
  );

  const todayActionsByType: Record<string, number> = {};
  for (const a of todayActions) {
    todayActionsByType[a.action_type] =
      (todayActionsByType[a.action_type] || 0) + 1;
  }

  const executedActions = linkedinActions.filter((a) => a.executed_at);
  const lastActionAt =
    executedActions.length > 0
      ? executedActions
          .map((a) => new Date(a.executed_at!).getTime())
          .reduce((max, t) => Math.max(max, t), 0)
      : null;

  // Recent activity: merge sequence events + linkedin actions
  const sequenceEvents = sequences.map((s) => ({
    type: "sequence_created" as const,
    name: s.candidateName,
    timestamp: s.createdAt.toISOString(),
  }));

  const linkedinEvents = linkedinActions.map((a) => ({
    type: a.action_type,
    name: a.target_name || "Unknown",
    timestamp: (a.executed_at || a.scheduled_for)
      ? new Date(a.executed_at || a.scheduled_for!).toISOString()
      : new Date().toISOString(),
    status: a.status,
  }));

  const recentActivity = [...sequenceEvents, ...linkedinEvents]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 20);

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
      linkedinQueuedAt: s.linkedinQueuedAt?.toISOString() || null,
      ashbyPushedAt: s.ashbyPushedAt?.toISOString() || null,
      messageCount: s._count.messages,
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
    })),

    needsAttention: [
      ...stuckSequences,
      ...awaitingResponse,
      ...positiveResponses,
    ],

    funnel,

    metrics: computeOutreachAnalytics(analytics),

    agentStatus: {
      todayActions: todayActionsByType,
      lastActionAt: lastActionAt
        ? new Date(lastActionAt).toISOString()
        : null,
      totalToday: todayActions.length,
    },

    recentActivity,
  });
}
