"use client";

import { useRouter } from "next/navigation";
import { useSession, signIn } from "next-auth/react";
import {
  Search, Users, Zap, Globe, Code,
  Code2, Server, Cpu, Smartphone, LogIn,
} from "lucide-react";
import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";

import { MetricCards } from "@/components/dashboard/MetricCards";
import { NeedsAttentionCards } from "@/components/dashboard/NeedsAttentionCards";
import { ActiveSequencesTable } from "@/components/dashboard/ActiveSequencesTable";
import { PipelineFunnel } from "@/components/dashboard/PipelineFunnel";
import { AgentStatusCard } from "@/components/dashboard/AgentStatusCard";
import { RecentActivityFeed } from "@/components/dashboard/RecentActivityFeed";
import { WatchlistCard } from "@/components/dashboard/WatchlistCard";
import { AlertsCard } from "@/components/dashboard/AlertsCard";
import type {
  DashboardSequence, AttentionItem, ActivityItem,
  DashboardMetrics, AgentStatus, FunnelData,
  FavoriteItem, AlertItem,
} from "@/components/dashboard/types";

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
    <div className="relative flex flex-1 flex-col overflow-hidden" style={{ background: "#0a0a0f", minHeight: "100vh" }}>
      {/* Top bar with sign-in */}
      <div className="relative z-20 flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-md" style={{ background: "#C8A55A" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="8" r="3.5" stroke="#19191A" strokeWidth="2" />
              <path d="M12 12.5c-4 0-7 2.5-7 5.5h14c0-3-3-5.5-7-5.5z" stroke="#19191A" strokeWidth="2" strokeLinejoin="round" />
              <path d="M18 4l2.5 2.5M18 9l2.5-2.5" stroke="#19191A" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </div>
          <span className="text-sm font-bold" style={{ color: "#E8E6DF", letterSpacing: "-0.03em" }}>Scout</span>
        </div>
        <button
          onClick={() => signIn()}
          className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all hover:brightness-110"
          style={{ border: "1px solid rgba(200,165,90,0.4)", color: "#C8A55A", background: "rgba(200,165,90,0.08)" }}
        >
          <LogIn className="h-4 w-4" />
          Sign in
        </button>
      </div>

      {/* Atmospheric gradient background */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-0 left-1/4 h-[600px] w-[600px] rounded-full blur-[120px]" style={{ background: "rgba(200,165,90,0.04)" }} />
        <div className="absolute top-20 right-1/4 h-[400px] w-[400px] rounded-full blur-[100px]" style={{ background: "rgba(200,165,90,0.03)" }} />
        <div className="absolute -bottom-20 left-1/2 h-[300px] w-[500px] -translate-x-1/2 rounded-full blur-[80px]" style={{ background: "rgba(200,165,90,0.03)" }} />
      </div>

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 py-10">
        {/* Hero badge */}
        <div
          className="mb-4 flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium backdrop-blur-sm"
          style={{ border: "1px solid rgba(200,165,90,0.25)", background: "rgba(200,165,90,0.08)", color: "#C8A55A" }}
        >
          <LiveDot />
          <span>Live GitHub intelligence</span>
          <span style={{ color: "rgba(200,165,90,0.4)" }}>·</span>
          <span style={{ color: "#E8E6DF" }}>48M+ developers</span>
        </div>

        {/* Title */}
        <h1 className="mb-4 text-center text-5xl font-bold tracking-tight sm:text-6xl lg:text-7xl">
          <span style={{ color: "#f5f5f5" }}>Scout </span>
          <span style={{ background: "linear-gradient(135deg, #C8A55A, #E8D5A3)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>top talent</span>
          <br />
          <span style={{ color: "#f5f5f5" }}>from GitHub</span>
        </h1>

        <p className="mb-8 max-w-lg text-center text-base sm:text-lg" style={{ color: "#a3a3a3" }}>
          Source engineers by what they build, not what they claim.
          Real code. Real contributions. Real signal.
        </p>

        {/* Search */}
        <div className="w-full max-w-2xl">
          <form
            onSubmit={(e) => { e.preventDefault(); handleSearch(query); }}
            className="group relative"
          >
            <div className="absolute -inset-1 rounded-2xl opacity-0 blur-lg transition-opacity duration-500 group-focus-within:opacity-100" style={{ background: "linear-gradient(to right, rgba(200,165,90,0.2), rgba(200,165,90,0.1))" }} />
            <div className="relative flex items-center rounded-xl shadow-2xl" style={{ border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.06)" }}>
              <Search className="ml-5 h-5 w-5" style={{ color: "rgba(255,255,255,0.4)" }} />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={hints[activeHint]}
                className="flex-1 bg-transparent px-4 py-4 text-base outline-none"
                style={{ color: "#f5f5f5", caretColor: "#C8A55A" }}
              />
              <button
                type="submit"
                className="mr-2 rounded-lg px-5 py-2 text-sm font-semibold transition-all hover:shadow-lg"
                style={{ background: "#C8A55A", color: "#19191A" }}
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
                className="rounded-full px-3 py-1.5 text-xs font-medium transition-all hover:-translate-y-px"
                style={{ border: "1px solid rgba(255,255,255,0.15)", color: "#ccc" }}
              >
                {chip.label}
              </button>
            ))}
          </div>
        </div>

        {/* Stats bar */}
        <div
          className="mt-10 flex items-center gap-8 sm:gap-12 rounded-xl px-8 py-4 backdrop-blur-sm"
          style={{ border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)" }}
        >
          {stats.map((s, i) => (
            <div key={s.label} className="flex items-center gap-2.5">
              <s.icon className="h-4 w-4" style={{ color: "#C8A55A" }} />
              <div>
                <p className="text-lg font-bold tabular-nums" style={{ color: "#f5f5f5" }}>{s.value}</p>
                <p className="text-[11px]" style={{ color: "#888" }}>{s.label}</p>
              </div>
              {i < stats.length - 1 && <div className="ml-6 h-8 w-px sm:ml-8" style={{ background: "rgba(255,255,255,0.1)" }} />}
            </div>
          ))}
        </div>

        {/* Trust line */}
        <p className="mt-8 text-xs" style={{ color: "#777" }}>
          Powered by GitHub REST + GraphQL · Apollo enrichment · Ashby ATS integration
        </p>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
//  DASHBOARD DATA
// ═══════════════════════════════════════════════════════════

const TALENT_LANES = [
  { label: "Frontend", query: "react typescript frontend", icon: Code2, signal: "High demand" },
  { label: "Backend", query: "go python backend distributed", icon: Server, signal: "Growing" },
  { label: "ML / AI", query: "python machine learning AI", icon: Cpu, signal: "Surging" },
  { label: "Infra", query: "kubernetes terraform infrastructure", icon: Globe, signal: "Steady" },
  { label: "Rust", query: "rust systems programming", icon: Zap, signal: "Hot" },
  { label: "Mobile", query: "swift kotlin mobile", icon: Smartphone, signal: "Stable" },
];

interface DashboardData {
  metrics: DashboardMetrics;
  needsAttention: AttentionItem[];
  sequences: DashboardSequence[];
  agentStatus: AgentStatus;
  funnel: FunnelData;
  recentActivity: ActivityItem[];
  favorites?: FavoriteItem[];
  alerts?: AlertItem[];
  userName?: string;
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
  sourced: 0,
  outreach_sent: 0,
  responded: 0,
  interested: 0,
  in_ats: 0,
};

// ═══════════════════════════════════════════════════════════
//  DASHBOARD SKELETON
// ═══════════════════════════════════════════════════════════

function DashboardSkeleton() {
  return (
    <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
      {/* Header + Search skeleton */}
      <div>
        <div className="h-6 w-48 animate-pulse bg-surface-secondary rounded-lg" />
        <div className="h-4 w-72 animate-pulse bg-surface-secondary rounded-lg mt-2" />
        <div className="h-12 w-full max-w-2xl animate-pulse bg-surface-secondary rounded-xl mt-4" />
      </div>

      {/* Metric cards skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-28 animate-pulse bg-surface-secondary rounded-xl" />
        ))}
      </div>

      {/* Main grid skeleton (sequences + sidebar) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 h-72 animate-pulse bg-surface-secondary rounded-xl" />
        <div className="space-y-4">
          <div className="h-48 animate-pulse bg-surface-secondary rounded-xl" />
          <div className="h-36 animate-pulse bg-surface-secondary rounded-xl" />
          <div className="h-28 animate-pulse bg-surface-secondary rounded-xl" />
        </div>
      </div>

      {/* Talent lanes skeleton */}
      <div>
        <div className="h-4 w-24 animate-pulse bg-surface-secondary rounded-lg mb-3" />
        <div className="grid grid-cols-6 gap-2">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-20 animate-pulse bg-surface-secondary rounded-xl" />
          ))}
        </div>
      </div>

      {/* Bottom grid skeleton (pipeline + activity) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="h-48 animate-pulse bg-surface-secondary rounded-xl" />
        <div className="h-48 animate-pulse bg-surface-secondary rounded-xl" />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
//  DASHBOARD — logged in
// ═══════════════════════════════════════════════════════════
function Dashboard() {
  const { data: session } = useSession();
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const fetchDashboard = useCallback(() => {
    fetch("/api/dashboard").then(r => r.json()).then(setData).catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchDashboard();
    const interval = setInterval(fetchDashboard, 60000);
    return () => clearInterval(interval);
  }, [fetchDashboard]);

  if (loading) return <DashboardSkeleton />;

  const userName = data?.userName || session?.user?.name || 'there';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">

      {/* === ROW 1: Header + Search === */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-xl font-semibold text-text">{greeting}, {userName}</h1>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-2.5 py-0.5 text-[10px] font-medium text-success">
            <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
            Connected
          </span>
        </div>
        <p className="text-sm text-text-muted mb-4">
          {data?.needsAttention?.length ? `${data.needsAttention.reduce((s: number, i: AttentionItem) => s + i.count, 0)} items need your attention` : 'Your talent radar is active. Start sourcing or review your pipeline.'}
        </p>
        <form onSubmit={(e) => { e.preventDefault(); if (searchQuery.trim()) router.push(`/search?q=${encodeURIComponent(searchQuery)}`); }} className="relative max-w-2xl">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by role, skill, location, or name..."
            className="w-full rounded-xl border border-border bg-surface pl-10 pr-24 py-3 text-sm outline-none focus:border-gold"
          />
          <button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg bg-gold px-4 py-1.5 text-xs font-semibold text-white hover:bg-gold-hover">
            Search
          </button>
        </form>
      </div>

      {/* === ROW 2: Metric Cards === */}
      <MetricCards metrics={data?.metrics || defaultMetrics} />

      {/* === ROW 3: Needs Attention === */}
      {data?.needsAttention && data.needsAttention.length > 0 && (
        <NeedsAttentionCards items={data.needsAttention} />
      )}

      {/* === ROW 4: Main Grid (2/3 sequences + 1/3 sidebar) === */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <ActiveSequencesTable sequences={data?.sequences || []} />
        </div>
        <div className="space-y-4">
          <WatchlistCard favorites={data?.favorites || []} />
          <AlertsCard alerts={data?.alerts || []} />
          <AgentStatusCard status={data?.agentStatus || defaultAgent} />
        </div>
      </div>

      {/* === ROW 5: Talent Lanes === */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">Talent Lanes</h2>
          <Link href="/search" className="text-[10px] font-medium text-gold hover:text-gold-hover">All searches →</Link>
        </div>
        <div className="grid grid-cols-6 gap-2">
          {TALENT_LANES.map((lane) => (
            <Link key={lane.label} href={`/search?q=${encodeURIComponent(lane.query)}`}
              className="rounded-xl border border-border bg-surface p-3 hover:border-gold/30 transition-colors">
              <lane.icon className="h-5 w-5 text-text-muted mb-2" />
              <p className="text-xs font-medium text-text">{lane.label}</p>
              <p className="text-[10px] text-text-dim mt-0.5">{lane.signal}</p>
            </Link>
          ))}
        </div>
      </div>

      {/* === ROW 6: Pipeline + Activity === */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <PipelineFunnel funnel={data?.funnel || defaultFunnel} />
        <RecentActivityFeed activities={data?.recentActivity || []} />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
//  ROUTE HANDLER
// ═══════════════════════════════════════════════════════════
export default function Home() {
  const { data: session, status } = useSession();

  if (status === "loading") return null; // AppShell handles the loading spinner

  if (session) return <Dashboard />;
  return <Landing />;
}
