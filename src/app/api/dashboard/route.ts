import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { computeOutreachAnalytics } from "@/lib/outreach/analytics";
import { safeErrorMessage } from "@/lib/api-error";

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

  try {
  const [sequences, analytics, linkedinActions, favorites, alerts] = await Promise.all([
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
      WHERE user_id = ${session.user.id || process.env.SUPABASE_AGENT_USER_ID || ""}
      AND scheduled_for >= CURRENT_DATE - INTERVAL '30 days'
      ORDER BY scheduled_for DESC
      LIMIT 100
    ` as Promise<LinkedinAction[]>
    ).catch(() => [] as LinkedinAction[]),

    // 4. Favorites (watchlist)
    prisma.favorite.findMany({
      where: { userId: session.user.id },
      include: {
        developer: {
          select: {
            id: true, username: true, name: true, avatarUrl: true,
            score: true, primaryLanguage: true, location: true, company: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 6,
    }),

    // 5. Alerts (market signals)
    prisma.marketSignal.findMany({
      where: {
        watchedCompany: { userId: session.user.id },
        isDismissed: false,
      },
      include: { watchedCompany: { select: { companyName: true } } },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }).catch(() => []),
  ]);

  const now = new Date();
  const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // Needs attention: aggregate by type to match frontend AttentionItem shape
  const attentionMap: Record<string, { count: number; sequenceIds: string[] }> = {};

  // Track which sequence IDs have already been categorized (most urgent wins)
  const categorized = new Set<string>();

  // Positive responses needing action (highest priority — act on these first)
  for (const s of sequences) {
    if (s.responseReceived === true && s.responseSentiment === "positive") {
      if (!attentionMap['positive_response']) attentionMap['positive_response'] = { count: 0, sequenceIds: [] };
      attentionMap['positive_response'].count++;
      attentionMap['positive_response'].sequenceIds.push(s.id);
      categorized.add(s.id);
    }
  }

  // Sequences stuck in sending 3+ days
  for (const s of sequences) {
    if (categorized.has(s.id)) continue;
    if (s.status === "sending" && s.updatedAt < threeDaysAgo) {
      if (!attentionMap['stuck']) attentionMap['stuck'] = { count: 0, sequenceIds: [] };
      attentionMap['stuck'].count++;
      attentionMap['stuck'].sequenceIds.push(s.id);
      categorized.add(s.id);
    }
  }

  // No response after 7+ days (only if not already in a more urgent category)
  for (const s of sequences) {
    if (categorized.has(s.id)) continue;
    if (s.status === "sending" && s.updatedAt < sevenDaysAgo && !s.responseReceived) {
      if (!attentionMap['overdue']) attentionMap['overdue'] = { count: 0, sequenceIds: [] };
      attentionMap['overdue'].count++;
      attentionMap['overdue'].sequenceIds.push(s.id);
      categorized.add(s.id);
    }
  }

  const needsAttention = Object.entries(attentionMap).map(([type, data]) => ({
    type,
    count: data.count,
    label: '', // Frontend generates labels
    sequenceIds: data.sequenceIds,
  }));

  // Funnel — aligned with pipeline stages
  const developersWithSequences = new Set(
    sequences.map((s) => s.sourceDeveloperId).filter((id): id is string => id !== null),
  );

  const sourcedCount = await prisma.candidateEntry.count({
    where: {
      list: { userId: session.user.id },
      developerId: { notIn: Array.from(developersWithSequences) },
    },
  }).catch(() => 0);

  const funnel = {
    sourced: sourcedCount,
    outreach_sent: sequences.filter((s) => s.status === "sending" && !s.responseReceived).length,
    responded: sequences.filter(
      (s) => s.responseReceived && s.responseSentiment !== "positive" && !s.ashbyPushedAt,
    ).length,
    interested: sequences.filter(
      (s) => s.responseSentiment === "positive" && !s.ashbyPushedAt,
    ).length,
    in_ats: sequences.filter((s) => s.ashbyPushedAt != null).length,
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
      candidateLinkedinUrl: s.candidateLinkedinUrl,
      candidateGithubUrl: s.candidateGithubUrl,
      sourceDeveloperId: s.sourceDeveloperId,
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

    needsAttention,

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

    favorites: favorites.map(f => ({
      id: f.id,
      developer: {
        id: f.developer.id,
        username: f.developer.username,
        name: f.developer.name,
        avatarUrl: f.developer.avatarUrl,
        score: f.developer.score,
        primaryLanguage: f.developer.primaryLanguage,
        location: f.developer.location,
        company: f.developer.company,
      },
    })),

    alerts: (alerts as any[]).map(a => ({
      id: a.id,
      eventType: a.eventType,
      severity: a.severity,
      summary: a.summary,
      companyName: a.watchedCompany?.companyName || a.companyName,
      createdAt: a.createdAt.toISOString(),
      isRead: a.isRead,
    })),

    userName: session.user.name || 'there',
  });
  } catch (error) {
    console.error("[dashboard] Failed:", error);
    return Response.json({ error: safeErrorMessage(error, "Failed to load dashboard") }, { status: 500 });
  }
}
