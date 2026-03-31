"use client";

import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  Search, Users, Zap, Code,
} from "lucide-react";
import { useEffect, useState, useRef } from "react";

import { MetricCards } from "@/components/dashboard/MetricCards";
import { NeedsAttentionCards } from "@/components/dashboard/NeedsAttentionCards";
import { ActiveSequencesTable } from "@/components/dashboard/ActiveSequencesTable";
import { PipelineFunnel } from "@/components/dashboard/PipelineFunnel";
import { AgentStatusCard } from "@/components/dashboard/AgentStatusCard";
import { RecentActivityFeed } from "@/components/dashboard/RecentActivityFeed";
import type { DashboardSequence, AttentionItem, ActivityItem, DashboardMetrics, AgentStatus, FunnelData } from "@/components/dashboard/types";

// ═══════════════════════════════════════════════════════════
//  LIVE INDICATOR — pulsing dot
// ═══════════════════════════════════════════════════════════
function LiveDot({ className = "" }: { className?: string }) {
  return (
    <span className={`relative flex h-2 w-2 ${className}`}>
      <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 animate-pulse-live" />
      <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
    </span>
  );
}

// ═══════════════════════════════════════════════════════════
//  LANDING PAGE — logged out
// ═══════════════════════════════════════════════════════════
function Landing() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [activeHint, setActiveHint] = useState(0);

  const hints = [
    "rust systems engineers in San Francisco",
    "python ML engineers open to work",
    "TypeScript React contributors",
    "Go backend developers in Berlin",
    "Kubernetes maintainers",
  ];

  useEffect(() => {
    const t = setInterval(() => setActiveHint((p) => (p + 1) % hints.length), 4000);
    return () => clearInterval(t);
  }, [hints.length]);

  function handleSearch(q: string) {
    if (q.trim()) router.push(`/search?q=${encodeURIComponent(q.trim())}`);
  }

  const stats = [
    { label: "Developers searchable", value: "48M+", icon: Users },
    { label: "Languages indexed", value: "120+", icon: Code },
    { label: "Enrichment sources", value: "3", icon: Zap },
  ];

  return (
    <div className="relative flex flex-1 flex-col overflow-hidden bg-background">
      {/* Atmospheric gradient background */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-0 left-1/4 h-[600px] w-[600px] rounded-full bg-gold/[0.06] blur-[120px]" />
        <div className="absolute top-20 right-1/4 h-[400px] w-[400px] rounded-full bg-gold/[0.04] blur-[100px]" />
        <div className="absolute -bottom-20 left-1/2 h-[300px] w-[500px] -translate-x-1/2 rounded-full bg-gold/[0.03] blur-[80px]" />
      </div>

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 py-10">
        {/* Hero badge */}
        <div className="mb-4 flex items-center gap-2 rounded-full border border-gold-border bg-gold-bg px-4 py-1.5 text-xs font-medium backdrop-blur-sm">
          <LiveDot />
          <span className="text-foreground">Live GitHub intelligence</span>
          <span className="text-text-dim">&middot;</span>
          <span className="text-gold">48M+ developers</span>
        </div>

        {/* Title */}
        <h1 className="mb-4 text-center text-5xl font-bold tracking-tight sm:text-6xl lg:text-7xl">
          <span className="text-foreground">Scout </span>
          <span className="text-gradient">top talent</span>
          <br />
          <span className="text-foreground">from GitHub</span>
        </h1>

        <p className="mb-8 max-w-lg text-center text-base text-text-muted sm:text-lg">
          Source engineers by what they build, not what they claim.
          Real code. Real contributions. Real signal.
        </p>

        {/* Search */}
        <div className="w-full max-w-2xl">
          <form
            onSubmit={(e) => { e.preventDefault(); handleSearch(query); }}
            className="group relative"
          >
            <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-gold/20 via-gold/10 to-gold/20 opacity-0 blur-lg transition-opacity duration-500 group-focus-within:opacity-100" />
            <div className="relative flex items-center rounded-xl border border-border bg-surface shadow-lg">
              <Search className="ml-5 h-5 w-5 text-text-dim" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={hints[activeHint]}
                className="flex-1 bg-transparent px-4 py-4 text-base text-foreground outline-none placeholder:text-text-dim/60"
              />
              <button
                type="submit"
                className="mr-2 rounded-lg bg-gold px-5 py-2 text-sm font-semibold text-white transition-all hover:bg-gold-hover hover:shadow-lg hover:shadow-gold/25"
              >
                Search
              </button>
            </div>
          </form>

          {/* Quick search chips */}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            {[
              { label: "Rust in SF", q: "rust developers in San Francisco" },
              { label: "ML Engineers", q: "python machine learning engineers" },
              { label: "React + TypeScript", q: "react typescript frontend" },
              { label: "Go in Berlin", q: "go engineers in Berlin" },
              { label: "Open to work", q: "hireable developers" },
            ].map((chip) => (
              <button
                key={chip.label}
                onClick={() => handleSearch(chip.q)}
                className="rounded-full border border-border px-3 py-1.5 text-xs font-medium text-text-secondary transition-all hover:-translate-y-px hover:border-gold-border hover:text-gold"
              >
                {chip.label}
              </button>
            ))}
          </div>
        </div>

        {/* Stats bar */}
        <div className="mt-10 flex items-center gap-8 sm:gap-12 rounded-xl border border-border bg-surface/70 px-8 py-4 backdrop-blur-sm">
          {stats.map((s, i) => (
            <div key={s.label} className="flex items-center gap-2.5">
              <s.icon className="h-4 w-4 text-gold" />
              <div>
                <p className="text-lg font-bold tabular-nums text-foreground">{s.value}</p>
                <p className="text-[11px] text-text-muted">{s.label}</p>
              </div>
              {i < stats.length - 1 && <div className="ml-6 h-8 w-px bg-border sm:ml-8" />}
            </div>
          ))}
        </div>

        {/* Trust line */}
        <p className="mt-8 text-xs text-text-dim">
          Powered by GitHub REST + GraphQL &middot; Apollo enrichment &middot; Ashby ATS integration
        </p>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
//  DASHBOARD — logged in
// ═══════════════════════════════════════════════════════════

interface DashboardData {
  metrics: DashboardMetrics;
  needsAttention: AttentionItem[];
  sequences: DashboardSequence[];
  agentStatus: AgentStatus;
  funnel: FunnelData;
  recentActivity: ActivityItem[];
}

const defaultMetrics: DashboardMetrics = {
  responseRate: 0,
  bestChannel: null,
  bestTone: null,
  avgResponseTime: null,
  totalDataPoints: 0,
};

const defaultAgent: AgentStatus = {
  todayActions: {},
  lastActionAt: null,
  totalToday: 0,
};

const defaultFunnel: FunnelData = {
  drafted: 0,
  sent: 0,
  viewed: 0,
  connected: 0,
  messaged: 0,
  responded: 0,
};

function DashboardSkeleton() {
  return (
    <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
      {/* Header skeleton */}
      <div>
        <div className="h-6 w-36 animate-pulse bg-surface-secondary rounded-lg" />
        <div className="h-4 w-56 animate-pulse bg-surface-secondary rounded-lg mt-2" />
      </div>

      {/* Metric cards skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-28 animate-pulse bg-surface-secondary rounded-lg" />
        ))}
      </div>

      {/* Table skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 h-64 animate-pulse bg-surface-secondary rounded-lg" />
        <div className="space-y-6">
          <div className="h-28 animate-pulse bg-surface-secondary rounded-lg" />
          <div className="h-28 animate-pulse bg-surface-secondary rounded-lg" />
        </div>
      </div>

      {/* Activity skeleton */}
      <div className="h-48 animate-pulse bg-surface-secondary rounded-lg" />
    </div>
  );
}

function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dashboard")
      .then(r => r.json())
      .then(d => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <DashboardSkeleton />;

  return (
    <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-text">Dashboard</h1>
          <p className="text-sm text-text-muted">Your recruiting command center</p>
        </div>
      </div>

      {/* Metric cards */}
      <MetricCards metrics={data?.metrics || defaultMetrics} />

      {/* Needs attention */}
      {data?.needsAttention && data.needsAttention.length > 0 && (
        <NeedsAttentionCards items={data.needsAttention} />
      )}

      {/* Main grid: sequences + sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <ActiveSequencesTable sequences={data?.sequences || []} />
        </div>
        <div className="space-y-6">
          <AgentStatusCard status={data?.agentStatus || defaultAgent} />
          <PipelineFunnel funnel={data?.funnel || defaultFunnel} />
        </div>
      </div>

      {/* Recent activity */}
      <RecentActivityFeed activities={data?.recentActivity || []} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
//  ROUTE HANDLER
// ═══════════════════════════════════════════════════════════
export default function Home() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-neutral-300 border-t-gold" />
      </div>
    );
  }

  if (session) return <Dashboard />;
  return <Landing />;
}
