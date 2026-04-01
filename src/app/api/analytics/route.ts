import { getAuthUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const userId = await getAuthUserId(request);
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // --- Parse filter query params ---
  const url = new URL(request.url);
  const channelFilter = url.searchParams.get("channel"); // e.g. "email", "linkedin"
  const roleTitleFilter = url.searchParams.get("roleTitle"); // e.g. "Senior Engineer"

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  // Build optional where clause for analytics
  const analyticsWhere: Record<string, unknown> = { userId };
  if (channelFilter) analyticsWhere.channel = channelFilter;

  // Fetch all analytics for this user (with optional filters)
  let analytics = await prisma.outreachAnalytic.findMany({
    where: analyticsWhere,
    orderBy: { createdAt: "desc" },
  });

  // Build optional where clause for sequences
  const sequencesWhere: Record<string, unknown> = { userId };
  if (channelFilter) sequencesWhere.channel = channelFilter;
  if (roleTitleFilter) sequencesWhere.roleTitle = roleTitleFilter;

  // Fetch sequences for candidate-level data
  const sequences = await prisma.outreachSequence.findMany({
    where: sequencesWhere,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      candidateName: true,
      channel: true,
      status: true,
      responseReceived: true,
      responseSentiment: true,
      roleTitle: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  // If roleTitleFilter is set, narrow analytics to sequences that match that roleTitle
  // We need to cross-reference since OutreachAnalytic doesn't have roleTitle directly
  if (roleTitleFilter) {
    // Since analytics don't link to sequences by FK, filter by matching createdAt window
    // Fetch sequences with that roleTitle and filter analytics by their creation times
    const matchingSeqDates = sequences.map((s) => s.createdAt.toISOString().slice(0, 19));
    analytics = analytics.filter((a) =>
      matchingSeqDates.some(
        (d) => Math.abs(new Date(d).getTime() - a.createdAt.getTime()) < 60000
      )
    );
  }

  // --- Collect distinct roleTitles for the filter dropdown ---
  const allSequences = await prisma.outreachSequence.findMany({
    where: { userId },
    select: { roleTitle: true },
    distinct: ["roleTitle"],
  });
  const availableRoleTitles = allSequences
    .map((s) => s.roleTitle)
    .filter((t): t is string => !!t)
    .sort();

  // --- Summary stats ---
  const totalSent = analytics.length;
  const totalResponded = analytics.filter((a) => a.responseReceived).length;
  const responseRate = totalSent > 0 ? Math.round((totalResponded / totalSent) * 100) : 0;

  const responseTimes = analytics
    .filter((a) => a.responseTimeHours != null)
    .map((a) => a.responseTimeHours!);
  const avgResponseTime =
    responseTimes.length > 0
      ? Math.round((responseTimes.reduce((s, v) => s + v, 0) / responseTimes.length) * 10) / 10
      : null;

  const totalCandidates = sequences.length;

  // --- Channel breakdown ---
  const channelMap: Record<string, { sent: number; responded: number }> = {};
  for (const a of analytics) {
    if (!channelMap[a.channel]) channelMap[a.channel] = { sent: 0, responded: 0 };
    channelMap[a.channel].sent++;
    if (a.responseReceived) channelMap[a.channel].responded++;
  }

  const channels = Object.entries(channelMap).map(([channel, stats]) => ({
    channel,
    sent: stats.sent,
    responded: stats.responded,
    rate: stats.sent > 0 ? Math.round((stats.responded / stats.sent) * 100) : 0,
  }));

  // Find best channel
  let bestChannel = "";
  let bestChannelRate = -1;
  for (const ch of channels) {
    if (ch.sent >= 3 && ch.rate > bestChannelRate) {
      bestChannel = ch.channel;
      bestChannelRate = ch.rate;
    }
  }

  // --- Tone breakdown ---
  const toneMap: Record<string, { sent: number; responded: number }> = {};
  for (const a of analytics) {
    if (!toneMap[a.tone]) toneMap[a.tone] = { sent: 0, responded: 0 };
    toneMap[a.tone].sent++;
    if (a.responseReceived) toneMap[a.tone].responded++;
  }

  const tones = Object.entries(toneMap).map(([tone, stats]) => ({
    tone,
    sent: stats.sent,
    responded: stats.responded,
    rate: stats.sent > 0 ? Math.round((stats.responded / stats.sent) * 100) : 0,
  }));

  // --- Signal breakdown ---
  const signalStats = {
    oss_reference: { sent: 0, responded: 0, rate: 0 },
    company_news: { sent: 0, responded: 0, rate: 0 },
    mutual_connection: { sent: 0, responded: 0, rate: 0 },
  };

  for (const a of analytics) {
    if (a.usedOssReference) {
      signalStats.oss_reference.sent++;
      if (a.responseReceived) signalStats.oss_reference.responded++;
    }
    if (a.usedCompanyNews) {
      signalStats.company_news.sent++;
      if (a.responseReceived) signalStats.company_news.responded++;
    }
    if (a.usedMutualConnection) {
      signalStats.mutual_connection.sent++;
      if (a.responseReceived) signalStats.mutual_connection.responded++;
    }
  }

  for (const key of Object.keys(signalStats) as Array<keyof typeof signalStats>) {
    const s = signalStats[key];
    s.rate = s.sent > 0 ? Math.round((s.responded / s.sent) * 100) : 0;
  }

  const signals = [
    { signal: "OSS references", key: "oss_reference" as const, ...signalStats.oss_reference },
    { signal: "Company news", key: "company_news" as const, ...signalStats.company_news },
    { signal: "Mutual connections", key: "mutual_connection" as const, ...signalStats.mutual_connection },
  ];

  // --- Daily breakdown (last 30 days) ---
  const dailyMap: Record<string, { sent: number; responded: number }> = {};

  // Initialize all 30 days
  for (let i = 0; i < 30; i++) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const key = d.toISOString().slice(0, 10);
    dailyMap[key] = { sent: 0, responded: 0 };
  }

  for (const a of analytics) {
    if (a.createdAt >= thirtyDaysAgo) {
      const key = a.createdAt.toISOString().slice(0, 10);
      if (dailyMap[key]) {
        dailyMap[key].sent++;
        if (a.responseReceived) dailyMap[key].responded++;
      }
    }
  }

  const daily = Object.entries(dailyMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, stats]) => ({ date, ...stats }));

  // --- Recent responses (query sequences directly instead of matching analytics) ---
  const recentResponseSequences = await prisma.outreachSequence.findMany({
    where: { userId, responseReceived: true },
    orderBy: { updatedAt: 'desc' },
    take: 20,
    select: {
      id: true,
      candidateName: true,
      channel: true,
      responseSentiment: true,
      updatedAt: true,
    },
  });

  const recentResponses = recentResponseSequences.map((s) => ({
    id: s.id,
    candidateName: s.candidateName,
    channel: s.channel,
    sentiment: s.responseSentiment || "neutral",
    responseTimeHours: null as number | null,
    date: s.updatedAt.toISOString(),
  }));

  // --- Hourly breakdown (Time-of-Day analysis) ---
  const hourlyData: Record<number, { sent: number; responded: number }> = {};
  for (const a of analytics) {
    const hour = new Date(a.createdAt).getHours();
    if (!hourlyData[hour]) hourlyData[hour] = { sent: 0, responded: 0 };
    hourlyData[hour].sent++;
    if (a.responseReceived) hourlyData[hour].responded++;
  }

  const hourlyBreakdown = Object.entries(hourlyData)
    .map(([hour, stats]) => ({
      hour: Number(hour),
      sent: stats.sent,
      responded: stats.responded,
      rate: stats.sent > 0 ? Math.round((stats.responded / stats.sent) * 100) : 0,
    }))
    .sort((a, b) => a.hour - b.hour);

  // --- Week-over-Week Trends ---
  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  const thisWeek = analytics.filter((a) => new Date(a.createdAt) >= oneWeekAgo);
  const lastWeek = analytics.filter(
    (a) => new Date(a.createdAt) >= twoWeeksAgo && new Date(a.createdAt) < oneWeekAgo
  );

  const thisWeekResponded = thisWeek.filter((a) => a.responseReceived).length;
  const lastWeekResponded = lastWeek.filter((a) => a.responseReceived).length;
  const thisWeekRate = thisWeek.length > 0 ? (thisWeekResponded / thisWeek.length) * 100 : 0;
  const lastWeekRate = lastWeek.length > 0 ? (lastWeekResponded / lastWeek.length) * 100 : 0;

  const trends = {
    sentDelta: thisWeek.length - lastWeek.length,
    responseRateDelta: Math.round((thisWeekRate - lastWeekRate) * 10) / 10,
    respondedDelta: thisWeekResponded - lastWeekResponded,
    candidatesDelta: 0, // computed from sequences below
  };

  // Candidate trend from sequences
  const thisWeekSeqs = sequences.filter((s) => new Date(s.createdAt) >= oneWeekAgo);
  const lastWeekSeqs = sequences.filter(
    (s) => new Date(s.createdAt) >= twoWeeksAgo && new Date(s.createdAt) < oneWeekAgo
  );
  trends.candidatesDelta = thisWeekSeqs.length - lastWeekSeqs.length;

  return Response.json({
    summary: {
      totalSent,
      responseRate,
      avgResponseTime,
      totalCandidates,
    },
    channels,
    bestChannel,
    tones,
    signals,
    daily,
    recentResponses,
    hourlyBreakdown,
    trends,
    availableRoleTitles,
    availableChannels: [...new Set(analytics.map((a) => a.channel))].sort(),
  });
}
