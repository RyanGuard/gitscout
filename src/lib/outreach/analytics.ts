import type { OutreachAnalytic } from "@/generated/prisma/client";

export interface OutreachMetrics {
  hasEnoughData: boolean;
  totalDataPoints: number;
  bestChannel: { channel: string; rate: number } | null;
  bestTone: { tone: string; rate: number } | null;
  optimalLength: { min: number; max: number };
  topSignal: { signal: string; rate: number } | null;
  responseRate: number;
  channelBreakdown: {
    channel: string;
    total: number;
    responded: number;
    rate: number;
  }[];
}

const SIGNAL_LABELS: Record<string, string> = {
  oss_reference: "OSS contributions",
  company_news: "company news",
  mutual_connection: "mutual connections",
};

function bestBy(stats: Record<string, { total: number; responded: number }>) {
  let best = { key: "", rate: 0 };
  for (const [key, val] of Object.entries(stats)) {
    if (val.total >= 3) {
      const rate = Math.round((val.responded / val.total) * 100);
      if (rate > best.rate) best = { key, rate };
    }
  }
  return best.key ? best : null;
}

export function computeOutreachAnalytics(
  analytics: OutreachAnalytic[]
): OutreachMetrics {
  const totalDataPoints = analytics.length;

  if (totalDataPoints < 10) {
    return {
      hasEnoughData: false,
      totalDataPoints,
      bestChannel: null,
      bestTone: null,
      optimalLength: { min: 40, max: 80 },
      topSignal: null,
      responseRate: 0,
      channelBreakdown: [],
    };
  }

  const channelStats: Record<string, { total: number; responded: number }> = {};
  const toneStats: Record<string, { total: number; responded: number }> = {};
  const signalStats: Record<string, { total: number; responded: number }> = {
    oss_reference: { total: 0, responded: 0 },
    company_news: { total: 0, responded: 0 },
    mutual_connection: { total: 0, responded: 0 },
  };
  const respondedWordCounts: number[] = [];
  let totalResponded = 0;

  for (const a of analytics) {
    // Channel
    if (!channelStats[a.channel])
      channelStats[a.channel] = { total: 0, responded: 0 };
    channelStats[a.channel].total++;
    if (a.responseReceived) channelStats[a.channel].responded++;

    // Tone
    if (!toneStats[a.tone]) toneStats[a.tone] = { total: 0, responded: 0 };
    toneStats[a.tone].total++;
    if (a.responseReceived) toneStats[a.tone].responded++;

    // Signals
    if (a.usedOssReference) {
      signalStats.oss_reference.total++;
      if (a.responseReceived) signalStats.oss_reference.responded++;
    }
    if (a.usedCompanyNews) {
      signalStats.company_news.total++;
      if (a.responseReceived) signalStats.company_news.responded++;
    }
    if (a.usedMutualConnection) {
      signalStats.mutual_connection.total++;
      if (a.responseReceived) signalStats.mutual_connection.responded++;
    }

    // Word counts
    if (a.messageWordCount && a.responseReceived) {
      respondedWordCounts.push(a.messageWordCount);
    }

    if (a.responseReceived) totalResponded++;
  }

  const bestChannel = bestBy(channelStats);
  const bestTone = bestBy(toneStats);
  const bestSignal = bestBy(signalStats);

  const optimalMin =
    respondedWordCounts.length > 0 ? Math.min(...respondedWordCounts) : 40;
  const optimalMax =
    respondedWordCounts.length > 0 ? Math.max(...respondedWordCounts) : 80;

  return {
    hasEnoughData: true,
    totalDataPoints,
    bestChannel: bestChannel
      ? { channel: bestChannel.key, rate: bestChannel.rate }
      : null,
    bestTone: bestTone ? { tone: bestTone.key, rate: bestTone.rate } : null,
    optimalLength: { min: optimalMin, max: optimalMax },
    topSignal: bestSignal
      ? {
          signal: SIGNAL_LABELS[bestSignal.key] || bestSignal.key,
          rate: bestSignal.rate,
        }
      : null,
    responseRate:
      totalDataPoints > 0
        ? Math.round((totalResponded / totalDataPoints) * 100)
        : 0,
    channelBreakdown: Object.entries(channelStats).map(([channel, stats]) => ({
      channel,
      total: stats.total,
      responded: stats.responded,
      rate:
        stats.total > 0
          ? Math.round((stats.responded / stats.total) * 100)
          : 0,
    })),
  };
}
