import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const analytics = await prisma.outreachAnalytic.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });

  if (analytics.length < 10) {
    return Response.json({ hasEnoughData: false, totalDataPoints: analytics.length });
  }

  // Compute best channel
  const channelStats: Record<string, { total: number; responded: number }> = {};
  const toneStats: Record<string, { total: number; responded: number }> = {};
  const signalStats: Record<string, { total: number; responded: number }> = {
    oss_reference: { total: 0, responded: 0 },
    company_news: { total: 0, responded: 0 },
    mutual_connection: { total: 0, responded: 0 },
  };
  const wordCounts: number[] = [];
  const respondedWordCounts: number[] = [];

  for (const a of analytics) {
    // Channel
    if (!channelStats[a.channel]) channelStats[a.channel] = { total: 0, responded: 0 };
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
    if (a.messageWordCount) {
      wordCounts.push(a.messageWordCount);
      if (a.responseReceived) respondedWordCounts.push(a.messageWordCount);
    }
  }

  // Find best
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

  const bestChannel = bestBy(channelStats);
  const bestTone = bestBy(toneStats);
  const bestSignal = bestBy(signalStats);

  // Optimal length
  const optimalMin = respondedWordCounts.length > 0
    ? Math.min(...respondedWordCounts)
    : 40;
  const optimalMax = respondedWordCounts.length > 0
    ? Math.max(...respondedWordCounts)
    : 80;

  const signalLabels: Record<string, string> = {
    oss_reference: "OSS contributions",
    company_news: "company news",
    mutual_connection: "mutual connections",
  };

  return Response.json({
    hasEnoughData: true,
    totalDataPoints: analytics.length,
    bestChannel: bestChannel ? { channel: bestChannel.key, rate: bestChannel.rate } : null,
    bestTone: bestTone ? { tone: bestTone.key, rate: bestTone.rate } : null,
    optimalLength: { min: optimalMin, max: optimalMax },
    topSignal: bestSignal
      ? { signal: signalLabels[bestSignal.key] || bestSignal.key, rate: bestSignal.rate }
      : null,
    channelBreakdown: Object.entries(channelStats).map(([channel, stats]) => ({
      channel,
      total: stats.total,
      responded: stats.responded,
      rate: stats.total > 0 ? Math.round((stats.responded / stats.total) * 100) : 0,
    })),
  });
}
