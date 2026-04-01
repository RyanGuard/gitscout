"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import {
  BarChart3,
  Send,
  MessageSquare,
  Clock,
  Users,
  Loader2,
  Mail,
  Link2,
  Phone,
  Sparkles,
  TrendingUp,
} from "lucide-react";

// ═══════════════════════════════════════════════════════════
//  TYPES
// ═══════════════════════════════════════════════════════════

interface ChannelData {
  channel: string;
  sent: number;
  responded: number;
  rate: number;
}

interface ToneData {
  tone: string;
  sent: number;
  responded: number;
  rate: number;
}

interface SignalData {
  signal: string;
  key: string;
  sent: number;
  responded: number;
  rate: number;
}

interface DailyData {
  date: string;
  sent: number;
  responded: number;
}

interface RecentResponse {
  id: string;
  candidateName: string;
  channel: string;
  sentiment: string;
  responseTimeHours: number | null;
  date: string;
}

interface AnalyticsPayload {
  summary: {
    totalSent: number;
    responseRate: number;
    avgResponseTime: number | null;
    totalCandidates: number;
  };
  channels: ChannelData[];
  bestChannel: string;
  tones: ToneData[];
  signals: SignalData[];
  daily: DailyData[];
  recentResponses: RecentResponse[];
}

// ═══════════════════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════════════════

const CHANNEL_ICONS: Record<string, typeof Mail> = {
  email: Mail,
  linkedin: Link2,
  text: Phone,
};

const TONE_LABELS: Record<string, string> = {
  professional: "Professional",
  casual: "Casual",
  technical_peer: "Technical Peer",
  executive: "Executive",
  warm_intro: "Warm Intro",
};

const SENTIMENT_COLORS: Record<string, string> = {
  positive: "text-emerald-400",
  neutral: "text-text-muted",
  negative: "text-red-400",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

// ═══════════════════════════════════════════════════════════
//  PAGE
// ═══════════════════════════════════════════════════════════

export default function AnalyticsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [data, setData] = useState<AnalyticsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/analytics");
      if (!res.ok) throw new Error("Failed to load analytics");
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/api/auth/signin?callbackUrl=/analytics");
      return;
    }
    if (session?.user?.id) fetchData();
  }, [session?.user?.id, status, router, fetchData]);

  if (status === "loading" || loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-text-muted" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <p className="text-sm text-red-400">{error}</p>
      </div>
    );
  }

  if (!data) return null;

  const { summary, channels, bestChannel, tones, signals, daily, recentResponses } = data;

  // Compute max values for bar scaling
  const maxDailySent = Math.max(...daily.map((d) => d.sent), 1);
  const maxChannelSent = Math.max(...channels.map((c) => c.sent), 1);
  const maxToneRate = Math.max(...tones.map((t) => t.rate), 1);
  const maxSignalRate = Math.max(...signals.map((s) => s.rate), 1);

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <BarChart3 className="h-6 w-6 text-gold" />
        <div>
          <h1 className="text-xl font-bold text-text">Outreach Analytics</h1>
          <p className="text-sm text-text-muted">
            Performance insights across channels, tones, and signals
          </p>
        </div>
      </div>

      {/* ──────── Summary cards ──────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          label="Sequences Sent"
          value={summary.totalSent.toLocaleString()}
          icon={Send}
        />
        <SummaryCard
          label="Response Rate"
          value={`${summary.responseRate}%`}
          icon={TrendingUp}
          highlight
        />
        <SummaryCard
          label="Avg Response Time"
          value={summary.avgResponseTime !== null ? `${summary.avgResponseTime}h` : "--"}
          icon={Clock}
        />
        <SummaryCard
          label="Candidates Contacted"
          value={summary.totalCandidates.toLocaleString()}
          icon={Users}
        />
      </div>

      {/* ──────── Channel + Tone row ──────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Channel Performance */}
        <div className="rounded-xl border border-border bg-surface p-4">
          <h2 className="mb-4 text-sm font-semibold text-text">Channel Performance</h2>
          {channels.length === 0 ? (
            <p className="text-xs text-text-muted">No data yet</p>
          ) : (
            <div className="space-y-4">
              {channels.map((ch) => {
                const Icon = CHANNEL_ICONS[ch.channel] || Mail;
                const isBest = ch.channel === bestChannel;
                return (
                  <div key={ch.channel}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <Icon className={`h-3.5 w-3.5 ${isBest ? "text-gold" : "text-text-muted"}`} />
                        <span className={isBest ? "font-semibold text-gold" : "text-text-muted"}>
                          {ch.channel.charAt(0).toUpperCase() + ch.channel.slice(1)}
                          {isBest && " (best)"}
                        </span>
                      </div>
                      <span className="text-text-muted">
                        {ch.responded}/{ch.sent} &middot; {ch.rate}%
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-white/5">
                      <div
                        className={`h-full rounded-full transition-all ${
                          isBest ? "bg-gold" : "bg-text-muted/40"
                        }`}
                        style={{ width: `${(ch.sent / maxChannelSent) * 100}%` }}
                      />
                    </div>
                    {/* Responded overlay */}
                    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-transparent">
                      <div
                        className="h-full rounded-full bg-emerald-500/60"
                        style={{ width: `${(ch.responded / maxChannelSent) * 100}%` }}
                      />
                    </div>
                  </div>
                );
              })}
              <div className="flex items-center gap-4 pt-1 text-[10px] text-text-dim">
                <span className="flex items-center gap-1">
                  <span className="inline-block h-2 w-2 rounded-full bg-text-muted/40" /> Sent
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block h-2 w-2 rounded-full bg-emerald-500/60" /> Responded
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Tone Performance */}
        <div className="rounded-xl border border-border bg-surface p-4">
          <h2 className="mb-4 text-sm font-semibold text-text">Tone Performance</h2>
          {tones.length === 0 ? (
            <p className="text-xs text-text-muted">No data yet</p>
          ) : (
            <div className="space-y-3">
              {tones.map((t) => {
                const label = TONE_LABELS[t.tone] || t.tone.replace(/_/g, " ");
                const best = t.rate === maxToneRate && t.rate > 0;
                return (
                  <div key={t.tone}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className={best ? "font-semibold text-gold" : "text-text-muted"}>
                        {label}
                        {best && " (best)"}
                      </span>
                      <span className="text-text-muted">{t.rate}%</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-white/5">
                      <div
                        className={`h-full rounded-full transition-all ${
                          best ? "bg-gold" : "bg-text-muted/40"
                        }`}
                        style={{ width: `${maxToneRate > 0 ? (t.rate / maxToneRate) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ──────── Signals ──────── */}
      <div className="rounded-xl border border-border bg-surface p-4">
        <div className="mb-4 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-gold" />
          <h2 className="text-sm font-semibold text-text">Top Personalization Signals</h2>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {signals.map((s) => {
            const best = s.rate === maxSignalRate && s.rate > 0;
            return (
              <div
                key={s.key}
                className={`rounded-lg border p-3 ${
                  best ? "border-gold/30 bg-gold/5" : "border-border bg-white/[0.02]"
                }`}
              >
                <p className={`text-xs font-medium ${best ? "text-gold" : "text-text-muted"}`}>
                  {s.signal}
                  {best && " (best)"}
                </p>
                <p className="mt-1 text-2xl font-bold text-text">{s.rate}%</p>
                <p className="text-[10px] text-text-dim">
                  {s.responded}/{s.sent} responded
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* ──────── Response Timeline ──────── */}
      <div className="rounded-xl border border-border bg-surface p-4">
        <h2 className="mb-4 text-sm font-semibold text-text">Response Timeline (Last 30 Days)</h2>
        <div className="flex items-end gap-[3px]" style={{ height: 140 }}>
          {daily.map((d) => {
            const sentOnly = d.sent - d.responded;
            const sentOnlyHeight = maxDailySent > 0 ? (sentOnly / maxDailySent) * 120 : 0;
            const respHeight = maxDailySent > 0 ? (d.responded / maxDailySent) * 120 : 0;
            return (
              <div
                key={d.date}
                className="group relative flex flex-1 flex-col items-center justify-end"
                style={{ height: 130 }}
              >
                {/* Tooltip */}
                <div className="pointer-events-none absolute -top-6 left-1/2 z-10 hidden -translate-x-1/2 whitespace-nowrap rounded bg-[#1a1a1a] px-2 py-1 text-[9px] text-text-muted shadow-lg group-hover:block">
                  {formatDate(d.date)}: {d.sent} sent, {d.responded} resp
                </div>
                {/* Sent-only bar (stacked on top) */}
                <div
                  className="w-full bg-text-muted/20 transition-all group-hover:bg-text-muted/40"
                  style={{ height: Math.max(sentOnlyHeight, sentOnly > 0 ? 2 : 0) }}
                />
                {/* Responded bar (stacked below) */}
                <div
                  className="w-full rounded-b bg-emerald-500/50 transition-all group-hover:bg-emerald-500/70"
                  style={{ height: Math.max(respHeight, d.responded > 0 ? 2 : 0), borderTopLeftRadius: sentOnly <= 0 ? '0.25rem' : 0, borderTopRightRadius: sentOnly <= 0 ? '0.25rem' : 0 }}
                />
              </div>
            );
          })}
        </div>
        {/* X-axis labels */}
        <div className="mt-1 flex justify-between text-[9px] text-text-dim">
          <span>{daily.length > 0 ? formatDate(daily[0].date) : ""}</span>
          <span>{daily.length > 0 ? formatDate(daily[daily.length - 1].date) : ""}</span>
        </div>
        <div className="mt-2 flex items-center gap-4 text-[10px] text-text-dim">
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-text-muted/30" /> Sent
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-500/50" /> Responded
          </span>
        </div>
      </div>

      {/* ──────── Recent Responses ──────── */}
      <div className="rounded-xl border border-border bg-surface p-4">
        <div className="mb-4 flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-text-muted" />
          <h2 className="text-sm font-semibold text-text">Recent Responses</h2>
        </div>
        {recentResponses.length === 0 ? (
          <p className="text-xs text-text-muted">No responses yet</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-border text-text-dim">
                  <th className="pb-2 pr-4 font-medium">Candidate</th>
                  <th className="pb-2 pr-4 font-medium">Channel</th>
                  <th className="pb-2 pr-4 font-medium">Sentiment</th>
                  <th className="pb-2 pr-4 font-medium">Response Time</th>
                  <th className="pb-2 font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {recentResponses.map((r) => {
                  const Icon = CHANNEL_ICONS[r.channel] || Mail;
                  return (
                    <tr key={r.id} className="border-b border-border/50 last:border-0">
                      <td className="py-2 pr-4 text-text">{r.candidateName}</td>
                      <td className="py-2 pr-4">
                        <span className="flex items-center gap-1.5 text-text-muted">
                          <Icon className="h-3 w-3" />
                          {r.channel.charAt(0).toUpperCase() + r.channel.slice(1)}
                        </span>
                      </td>
                      <td className="py-2 pr-4">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                            SENTIMENT_COLORS[r.sentiment] || "text-text-muted"
                          }`}
                        >
                          {r.sentiment === "positive" && "+"}
                          {r.sentiment === "negative" && "-"}
                          {r.sentiment.charAt(0).toUpperCase() + r.sentiment.slice(1)}
                        </span>
                      </td>
                      <td className="py-2 pr-4 text-text-muted">
                        {r.responseTimeHours != null ? `${r.responseTimeHours}h` : "--"}
                      </td>
                      <td className="py-2 text-text-dim">{formatDate(r.date)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
//  SUMMARY CARD
// ═══════════════════════════════════════════════════════════

function SummaryCard({
  label,
  value,
  icon: Icon,
  highlight,
}: {
  label: string;
  value: string;
  icon: typeof Send;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs text-text-muted">{label}</span>
        <Icon className="h-4 w-4 text-text-dim" />
      </div>
      <p className={`mt-2 text-2xl font-bold ${highlight ? "text-gold" : "text-text"}`}>
        {value}
      </p>
    </div>
  );
}
