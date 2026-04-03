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
  Minus,
  ArrowUp,
  ArrowDown,
  Filter,
  Sun,
  Download,
} from "lucide-react";
import { githubSignInUrl } from "@/lib/auth-signin";

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

interface HourlyData {
  hour: number;
  sent: number;
  responded: number;
  rate: number;
}

interface Trends {
  sentDelta: number;
  responseRateDelta: number;
  respondedDelta: number;
  candidatesDelta: number;
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
  hourlyBreakdown: HourlyData[];
  trends: Trends;
  availableRoleTitles: string[];
  availableChannels: string[];
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
  const [channelFilter, setChannelFilter] = useState<string>("");
  const [roleTitleFilter, setRoleTitleFilter] = useState<string>("");

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (channelFilter) params.set("channel", channelFilter);
      if (roleTitleFilter) params.set("roleTitle", roleTitleFilter);
      const qs = params.toString();
      const res = await fetch(`/api/analytics${qs ? `?${qs}` : ""}`);
      if (!res.ok) throw new Error("Failed to load analytics");
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, [channelFilter, roleTitleFilter]);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push(githubSignInUrl("/analytics"));
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

  const {
    summary,
    channels,
    bestChannel,
    tones,
    signals,
    daily,
    recentResponses,
    hourlyBreakdown,
    trends,
    availableRoleTitles,
    availableChannels,
  } = data;

  // Compute max values for bar scaling
  const maxDailySent = Math.max(...daily.map((d) => d.sent), 1);
  const maxChannelSent = Math.max(...channels.map((c) => c.sent), 1);
  const maxToneRate = Math.max(...tones.map((t) => t.rate), 1);
  const maxSignalRate = Math.max(...signals.map((s) => s.rate), 1);

  // Hourly chart: filter to 6am-10pm, find best hours
  const displayHours = hourlyBreakdown.filter((h) => h.hour >= 6 && h.hour <= 22);
  const maxHourlyRate = Math.max(...displayHours.map((h) => h.rate), 1);
  const bestHourRate = Math.max(...displayHours.filter((h) => h.sent >= 1).map((h) => h.rate), 0);

  function exportCSV() {
    const rows = [["date", "channel", "tone", "sent", "responded", "response_rate"]];
    for (const d of daily) {
      for (const ch of channels) {
        for (const t of tones) {
          rows.push([
            d.date,
            ch.channel,
            t.tone,
            String(ch.sent),
            String(ch.responded),
            String(ch.rate),
          ]);
        }
      }
    }
    // If no daily/channel/tone combos, export summary rows per channel+tone
    if (rows.length <= 1) {
      for (const ch of channels) {
        for (const t of tones) {
          rows.push([
            "",
            ch.channel,
            t.tone,
            String(ch.sent),
            String(ch.responded),
            String(ch.rate),
          ]);
        }
      }
    }
    const csv = rows.map((r) => r.map((v) => `"${v.replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "analytics-export.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <BarChart3 className="h-6 w-6 text-gold" />
        <div className="flex-1">
          <h1 className="text-xl font-bold text-text">Outreach Analytics</h1>
          <p className="text-sm text-text-muted">
            Performance insights across channels, tones, and signals
          </p>
        </div>
        <button
          onClick={exportCSV}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-text-muted transition-colors hover:bg-surface"
        >
          <Download className="h-3.5 w-3.5" />
          Export CSV
        </button>
      </div>

      {/* ──────── Filter Bar ──────── */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface p-3">
        <Filter className="h-4 w-4 text-text-muted" />
        <span className="text-xs font-medium text-text-muted">Filter:</span>

        {/* Channel filter pills */}
        <button
          onClick={() => setChannelFilter("")}
          className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
            !channelFilter
              ? "bg-gold/20 text-gold"
              : "bg-white/5 text-text-muted hover:bg-white/10"
          }`}
        >
          All Channels
        </button>
        {(availableChannels.length > 0 ? availableChannels : ["email", "linkedin"]).map((ch) => {
          const Icon = CHANNEL_ICONS[ch] || Mail;
          return (
            <button
              key={ch}
              onClick={() => setChannelFilter(channelFilter === ch ? "" : ch)}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                channelFilter === ch
                  ? "bg-gold/20 text-gold"
                  : "bg-white/5 text-text-muted hover:bg-white/10"
              }`}
            >
              <Icon className="h-3 w-3" />
              {ch.charAt(0).toUpperCase() + ch.slice(1)}
            </button>
          );
        })}

        {/* Role title dropdown */}
        {availableRoleTitles.length > 0 && (
          <>
            <div className="h-4 w-px bg-border" />
            <select
              value={roleTitleFilter}
              onChange={(e) => setRoleTitleFilter(e.target.value)}
              className="rounded-lg border border-border bg-white/5 px-2.5 py-1 text-xs text-text-muted outline-none focus:border-gold/50"
            >
              <option value="">All Roles</option>
              {availableRoleTitles.map((title) => (
                <option key={title} value={title}>
                  {title}
                </option>
              ))}
            </select>
          </>
        )}

        {(channelFilter || roleTitleFilter) && (
          <button
            onClick={() => {
              setChannelFilter("");
              setRoleTitleFilter("");
            }}
            className="ml-auto text-xs text-text-dim hover:text-text-muted"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* ──────── Summary cards ──────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          label="Sequences Sent"
          value={summary.totalSent.toLocaleString()}
          icon={Send}
          delta={trends.sentDelta}
        />
        <SummaryCard
          label="Response Rate"
          value={`${summary.responseRate}%`}
          icon={TrendingUp}
          highlight
          delta={trends.responseRateDelta}
          deltaLabel="pp"
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
          delta={trends.candidatesDelta}
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

      {/* ──────── Best Time to Send ──────── */}
      <div className="rounded-xl border border-border bg-surface p-4">
        <div className="mb-4 flex items-center gap-2">
          <Sun className="h-4 w-4 text-gold" />
          <h2 className="text-sm font-semibold text-text">Best Time to Send</h2>
        </div>
        {displayHours.length === 0 ? (
          <p className="text-xs text-text-muted">No hourly data yet</p>
        ) : (
          <div className="space-y-1.5">
            {Array.from({ length: 17 }, (_, i) => i + 6).map((hour) => {
              const entry = displayHours.find((h) => h.hour === hour);
              const rate = entry?.rate ?? 0;
              const sent = entry?.sent ?? 0;
              const responded = entry?.responded ?? 0;
              const isBest = rate > 0 && rate === bestHourRate;
              const label =
                hour === 0
                  ? "12am"
                  : hour < 12
                    ? `${hour}am`
                    : hour === 12
                      ? "12pm"
                      : `${hour - 12}pm`;
              return (
                <div key={hour} className="group flex items-center gap-2">
                  <span
                    className={`w-10 text-right text-[10px] font-medium ${
                      isBest ? "text-gold" : "text-text-dim"
                    }`}
                  >
                    {label}
                  </span>
                  <div className="relative h-5 flex-1 overflow-hidden rounded bg-white/5">
                    <div
                      className={`h-full rounded transition-all ${
                        isBest ? "bg-gold" : "bg-text-muted/30"
                      }`}
                      style={{
                        width: `${maxHourlyRate > 0 ? (rate / maxHourlyRate) * 100 : 0}%`,
                        minWidth: rate > 0 ? "4px" : "0px",
                      }}
                    />
                    {/* Tooltip on hover */}
                    <div className="pointer-events-none absolute inset-0 flex items-center px-2 opacity-0 transition-opacity group-hover:opacity-100">
                      <span className="text-[9px] text-text-muted">
                        {sent} sent, {responded} responded
                      </span>
                    </div>
                  </div>
                  <span
                    className={`w-10 text-right text-[10px] font-semibold ${
                      isBest ? "text-gold" : "text-text-muted"
                    }`}
                  >
                    {rate}%
                  </span>
                  {isBest && (
                    <span className="text-[9px] font-bold text-gold">BEST</span>
                  )}
                </div>
              );
            })}
            <p className="mt-2 text-[10px] text-text-dim">
              Response rate by hour of day (6am - 10pm). Gold bars highlight the best performing hours.
            </p>
          </div>
        )}
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
  delta,
  deltaLabel,
}: {
  label: string;
  value: string;
  icon: typeof Send;
  highlight?: boolean;
  delta?: number;
  deltaLabel?: string;
}) {
  const suffix = deltaLabel || "";
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs text-text-muted">{label}</span>
        <Icon className="h-4 w-4 text-text-dim" />
      </div>
      <div className="mt-2 flex items-end gap-2">
        <p className={`text-2xl font-bold ${highlight ? "text-gold" : "text-text"}`}>
          {value}
        </p>
        {delta !== undefined && (
          <span
            className={`mb-0.5 flex items-center gap-0.5 text-xs font-semibold ${
              delta > 0
                ? "text-emerald-400"
                : delta < 0
                  ? "text-red-400"
                  : "text-text-dim"
            }`}
          >
            {delta > 0 ? (
              <ArrowUp className="h-3 w-3" />
            ) : delta < 0 ? (
              <ArrowDown className="h-3 w-3" />
            ) : (
              <Minus className="h-3 w-3" />
            )}
            {delta > 0 ? `+${delta}${suffix}` : delta < 0 ? `${delta}${suffix}` : `0${suffix}`}
          </span>
        )}
      </div>
      {delta !== undefined && (
        <p className="mt-0.5 text-[10px] text-text-dim">vs last week</p>
      )}
    </div>
  );
}
