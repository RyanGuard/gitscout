import { getAuthUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const userId = await getAuthUserId(request);
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  // Fetch all analytics for this user
  const analytics = await prisma.outreachAnalytic.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });

  // Fetch sequences for candidate-level data
  const sequences = await prisma.outreachSequence.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      candidateName: true,
      channel: true,
      status: true,
      responseReceived: true,
      responseSentiment: true,
      createdAt: true,
      updatedAt: true,
    },
  });

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
  });
}
