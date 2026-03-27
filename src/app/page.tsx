"use client";

import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Search, ArrowRight, Users, Zap, Code } from "lucide-react";
import { useEffect, useState, useRef } from "react";
import Link from "next/link";

// ═══════════════════════════════════════════════════════════
//  LIVE INDICATOR
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
//  STAT CARD
// ═══════════════════════════════════════════════════════════
function StatCard({ label, value, accent }: { label: string; value: string | number; accent?: string }) {
  return (
    <div
      style={{
        background: "var(--color-background-primary)",
        borderRadius: 10,
        border: "0.5px solid var(--color-border-tertiary)",
        padding: "16px 20px",
        flex: 1,
        minWidth: 140,
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          color: "var(--color-text-tertiary)",
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 26,
          fontWeight: 700,
          color: accent || "var(--color-text-primary)",
          letterSpacing: "-0.03em",
        }}
      >
        {value}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
//  MAP CARD
// ═══════════════════════════════════════════════════════════
function MapCard({ map }: { map: { name: string; companies: number; candidates: number; connections: number; updated: string; status: string } }) {
  const isStale = map.status === "stale";
  return (
    <div
      style={{
        background: "var(--color-background-primary)",
        borderRadius: 10,
        border: "0.5px solid var(--color-border-tertiary)",
        padding: "16px 20px",
        cursor: "pointer",
        transition: "border-color 0.15s",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--color-text-primary)" }}>{map.name}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          {isStale && (
            <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 4, background: "rgba(186,117,23,0.08)", color: "#8B6914", fontWeight: 500 }}>
              Stale
            </span>
          )}
          <span style={{ fontSize: 11, color: "var(--color-text-tertiary)" }}>{map.updated}</span>
        </div>
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <span style={{ fontSize: 11, padding: "3px 8px", borderRadius: 5, background: "var(--color-background-secondary)", color: "var(--color-text-secondary)" }}>
          {map.companies} companies
        </span>
        <span style={{ fontSize: 11, padding: "3px 8px", borderRadius: 5, background: "var(--color-background-secondary)", color: "var(--color-text-secondary)" }}>
          {map.candidates} candidates
        </span>
        {map.connections > 0 && (
          <span style={{ fontSize: 11, padding: "3px 8px", borderRadius: 5, background: "rgba(200,165,90,0.08)", color: "#8B6914" }}>
            {map.connections} warm paths
          </span>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
//  ALERT CARD
// ═══════════════════════════════════════════════════════════
function AlertCard({ alert }: { alert: { company: string; text: string; time: string; severity: string } }) {
  const isUrgent = alert.severity === "urgent";
  return (
    <div
      style={{
        padding: "12px 14px",
        borderRadius: 8,
        background: isUrgent ? "rgba(194,65,60,0.04)" : "var(--color-background-secondary)",
        border: `0.5px solid ${isUrgent ? "rgba(194,65,60,0.12)" : "var(--color-border-tertiary)"}`,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
        {isUrgent && <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#C2413C" }} />}
        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-primary)" }}>{alert.company}</span>
        <span style={{ fontSize: 10, color: "var(--color-text-tertiary)", marginLeft: "auto" }}>{alert.time}</span>
      </div>
      <div style={{ fontSize: 12, color: "var(--color-text-secondary)", lineHeight: 1.5 }}>{alert.text}</div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
//  QUICK ACTION
// ═══════════════════════════════════════════════════════════
function QuickAction({ label, desc, href }: { label: string; desc: string; href: string }) {
  return (
    <Link
      href={href}
      style={{
        flex: 1,
        minWidth: 180,
        padding: "18px 22px",
        borderRadius: 10,
        border: "0.5px solid var(--color-border-tertiary)",
        background: "var(--color-background-primary)",
        cursor: "pointer",
        transition: "border-color 0.15s, transform 0.1s",
        textDecoration: "none",
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text-primary)", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 12, color: "var(--color-text-tertiary)", lineHeight: 1.4 }}>{desc}</div>
    </Link>
  );
}

// ═══════════════════════════════════════════════════════════
//  MOCK DATA
// ═══════════════════════════════════════════════════════════
const MOCK_STATS = { activeMaps: 4, candidatesTracked: 187, warmConnections: 23, responseRate: "34%" };

const MOCK_RECENT = [
  { name: "Sr. Platform Engineer — GPU Cloud", companies: 9, candidates: 23, connections: 6, updated: "2h ago", status: "ready" },
  { name: "Staff Backend — Fintech", companies: 12, candidates: 31, connections: 4, updated: "1d ago", status: "ready" },
  { name: "Engineering Manager — AI Infra", companies: 7, candidates: 18, connections: 2, updated: "3d ago", status: "stale" },
];

const MOCK_ALERTS = [
  { company: "CoreWeave", text: "VP Engineering departed — 3 engineers now high flight risk", time: "4h ago", severity: "urgent" },
  { company: "Lambda", text: "Series C announced ($150M) — hiring surge expected", time: "1d ago", severity: "info" },
  { company: "Anyscale", text: "15% workforce reduction reported", time: "2d ago", severity: "urgent" },
];

// ═══════════════════════════════════════════════════════════
//  DASHBOARD — logged in
// ═══════════════════════════════════════════════════════════
function Dashboard() {
  const { data: session } = useSession();
  const rawName = session?.user?.name || "";
  const firstName = rawName.includes(" ") ? rawName.split(" ")[0] : (rawName || "there");
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div style={{ maxWidth: 1020, padding: "28px 36px" }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: "var(--color-text-primary)", letterSpacing: "-0.03em", marginBottom: 4 }}>
          {greeting}, {firstName}
        </div>
        <div style={{ fontSize: 13, color: "var(--color-text-tertiary)" }}>
          {MOCK_STATS.activeMaps} active searches · {MOCK_STATS.candidatesTracked} candidates in pipeline · {MOCK_ALERTS.length} new alerts
        </div>
      </div>

      {/* Quick actions */}
      <div style={{ display: "flex", gap: 10, marginBottom: 24, flexWrap: "wrap" }}>
        <QuickAction label="New market map" desc="Map the talent landscape for a role" href="/map" />
        <QuickAction label="Search developers" desc="Find engineers by skills and activity" href="/search" />
        <QuickAction label="Map connections" desc="Find warm paths into any company" href="/connections" />
      </div>

      {/* Stats */}
      <div style={{ display: "flex", gap: 10, marginBottom: 28, flexWrap: "wrap" }}>
        <StatCard label="Active maps" value={MOCK_STATS.activeMaps} />
        <StatCard label="Candidates tracked" value={MOCK_STATS.candidatesTracked} />
        <StatCard label="Warm connections" value={MOCK_STATS.warmConnections} accent="#8B6914" />
        <StatCard label="Response rate" value={MOCK_STATS.responseRate} accent="#2D6A4F" />
      </div>

      {/* Two column layout */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 330px", gap: 20, alignItems: "start" }}>
        {/* Recent searches */}
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <span style={{ fontSize: 15, fontWeight: 600, color: "var(--color-text-primary)" }}>Recent searches</span>
            <Link href="/map" style={{ fontSize: 12, color: "#8B6914", fontWeight: 500, textDecoration: "none" }}>
              View all
            </Link>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {MOCK_RECENT.map((m, i) => (
              <MapCard key={i} map={m} />
            ))}
          </div>
        </div>

        {/* Right column */}
        <div>
          {/* Alerts */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 15, fontWeight: 600, color: "var(--color-text-primary)" }}>Alerts</span>
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  width: 17,
                  height: 17,
                  borderRadius: "50%",
                  background: "#C2413C",
                  color: "#fff",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {MOCK_ALERTS.length}
              </span>
            </div>
            <Link href="/alerts" style={{ fontSize: 12, color: "#8B6914", fontWeight: 500, textDecoration: "none" }}>
              View all
            </Link>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
            {MOCK_ALERTS.map((a, i) => (
              <AlertCard key={i} alert={a} />
            ))}
          </div>

          {/* Connection CTA */}
          <div
            style={{
              padding: "18px 20px",
              borderRadius: 10,
              background: "rgba(200,165,90,0.05)",
              border: "0.5px solid rgba(200,165,90,0.15)",
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 600, color: "#6B5418", marginBottom: 4 }}>Connection mapper</div>
            <div style={{ fontSize: 12, color: "#8B6914", lineHeight: 1.5, marginBottom: 12 }}>
              Set up your company to find warm intros on every market map automatically.
            </div>
            <Link
              href="/connections"
              style={{
                display: "inline-block",
                fontSize: 12,
                fontWeight: 600,
                padding: "8px 16px",
                borderRadius: 7,
                background: "#C8A55A",
                color: "#19191A",
                textDecoration: "none",
                letterSpacing: "-0.01em",
              }}
            >
              Set up connections
            </Link>
          </div>
        </div>
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
