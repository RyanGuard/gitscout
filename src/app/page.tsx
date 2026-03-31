"use client";

import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  Search, ArrowRight, TrendingUp, Users, Zap, Globe,
  MapPin, Code, GitFork, Star, Activity, Eye, Bookmark,
  ChevronRight, Sparkles, Target, Clock, Radio,
} from "lucide-react";
import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { getLanguageColor } from "@/lib/utils";

// ═══════════════════════════════════════════════════════════
//  MINI SPARKLINE — tiny activity visualization
// ═══════════════════════════════════════════════════════════
function Sparkline({ data, color = "#818cf8" }: { data: number[]; color?: string }) {
  const max = Math.max(...data, 1);
  return (
    <div className="flex items-end gap-[2px] h-5">
      {data.map((v, i) => (
        <div
          key={i}
          className="w-[3px] rounded-full animate-grow-bar"
          style={{
            height: `${Math.max(8, (v / max) * 100)}%`,
            backgroundColor: color,
            opacity: 0.4 + (v / max) * 0.6,
            animationDelay: `${i * 50}ms`,
          }}
        />
      ))}
    </div>
  );
}

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

// Market intelligence cards
const MARKETS = [
  {
    city: "San Francisco",
    flag: "\u{1F1FA}\u{1F1F8}",
    developers: "892K",
    topLangs: ["TypeScript", "Python", "Go"],
    trend: "+4.2%",
    trendUp: true,
    sparkline: [3, 5, 4, 7, 6, 8, 7, 9, 8, 10, 9, 11],
  },
  {
    city: "Berlin",
    flag: "\u{1F1E9}\u{1F1EA}",
    developers: "312K",
    topLangs: ["TypeScript", "Rust", "Go"],
    trend: "+6.1%",
    trendUp: true,
    sparkline: [2, 3, 4, 3, 5, 6, 5, 7, 8, 7, 9, 10],
  },
  {
    city: "New York",
    flag: "\u{1F1FA}\u{1F1F8}",
    developers: "645K",
    topLangs: ["Python", "TypeScript", "Java"],
    trend: "+3.8%",
    trendUp: true,
    sparkline: [4, 5, 5, 6, 5, 7, 6, 8, 7, 8, 9, 9],
  },
  {
    city: "London",
    flag: "\u{1F1EC}\u{1F1E7}",
    developers: "528K",
    topLangs: ["TypeScript", "Python", "Go"],
    trend: "+2.9%",
    trendUp: true,
    sparkline: [3, 3, 4, 5, 4, 5, 6, 5, 7, 6, 7, 8],
  },
];

// Role lanes
const ROLE_LANES = [
  { label: "Frontend", query: "react typescript frontend", langs: ["TypeScript", "JavaScript"], icon: Code, iconColor: "text-blue-400", signal: "High demand", signalColor: "text-amber-400" },
  { label: "Backend", query: "go python backend api", langs: ["Go", "Python"], icon: GitFork, iconColor: "text-emerald-400", signal: "Growing", signalColor: "text-emerald-400" },
  { label: "ML / AI", query: "python machine learning AI", langs: ["Python"], icon: Sparkles, iconColor: "text-violet-400", signal: "Surging", signalColor: "text-red-400" },
  { label: "Infra / DevOps", query: "kubernetes terraform infrastructure", langs: ["Go", "Python"], icon: Globe, iconColor: "text-cyan-400", signal: "Steady", signalColor: "text-neutral-400" },
  { label: "Rust Systems", query: "rust systems performance", langs: ["Rust"], icon: Zap, iconColor: "text-orange-400", signal: "Hot", signalColor: "text-red-400" },
  { label: "Mobile", query: "swift kotlin mobile", langs: ["Swift", "Kotlin"], icon: Target, iconColor: "text-pink-400", signal: "Stable", signalColor: "text-neutral-400" },
];

// Mock data
const MOCK_ALERTS = [
  { company: "CoreWeave", text: "VP Engineering departed \u2014 3 engineers now high flight risk", time: "4h ago", severity: "urgent" },
  { company: "Lambda", text: "Series C announced ($150M) \u2014 hiring surge expected", time: "1d ago", severity: "info" },
  { company: "Anyscale", text: "15% workforce reduction reported", time: "2d ago", severity: "urgent" },
];

interface FavoriteDev {
  id: string;
  developer: {
    username: string;
    name: string | null;
    avatarUrl: string | null;
    score: number;
    primaryLanguage: string | null;
    location: string | null;
    followers?: number;
    totalStars?: number;
  };
  createdAt: string;
}

// ═══════════════════════════════════════════════════════════
//  DASHBOARD — logged in
// ═══════════════════════════════════════════════════════════
function Dashboard() {
  const router = useRouter();
  const { data: session } = useSession();
  const searchRef = useRef<HTMLInputElement>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [favorites, setFavorites] = useState<FavoriteDev[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/favorites")
      .then((r) => r.json())
      .then((data) => setFavorites(data.favorites || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, []);

  function search(q: string) {
    if (q.trim()) router.push(`/search?q=${encodeURIComponent(q.trim())}`);
  }

  const rawName = session?.user?.name || "";
  const firstName = rawName.includes(" ") ? rawName.split(" ")[0] : (rawName || "there");
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="relative min-h-screen">
      {/* Subtle gradient bg */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute top-0 right-0 h-[500px] w-[500px] rounded-full bg-indigo-500/[0.02] blur-[120px]" />
        <div className="absolute bottom-0 left-0 h-[400px] w-[400px] rounded-full bg-violet-500/[0.015] blur-[100px]" />
      </div>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {/* ── HEADER: Greeting + Search ── */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-neutral-900">
              {greeting}, {firstName}
            </h1>
            <div className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-medium text-emerald-600">
              <LiveDot />
              Connected
            </div>
          </div>
          <p className="text-sm text-neutral-500 mb-5">Your talent radar is active. Start sourcing or review your pipeline.</p>

          <form onSubmit={(e) => { e.preventDefault(); search(searchQuery); }} className="relative max-w-2xl">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-neutral-400" />
            <input
              ref={searchRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by role, skill, location, or name..."
              className="w-full rounded-xl border border-neutral-200/50 bg-white py-3 pl-11 pr-20 text-sm shadow-sm outline-none transition-all placeholder:text-neutral-400 focus:border-indigo-400/50 focus:shadow-lg focus:shadow-indigo-500/5"
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
              <kbd className="hidden rounded border border-neutral-200/50 px-1.5 py-0.5 text-[10px] font-mono text-neutral-400 sm:inline-flex">{"\u2318"}K</kbd>
              <button type="submit" className="rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 transition-colors">
                Search
              </button>
            </div>
          </form>
        </div>

        {/* ── ROLE LANES ── */}
        <section className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Talent lanes</h2>
            <Link href="/search" className="text-xs text-indigo-500 hover:text-indigo-400 transition-colors">
              All searches →
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {ROLE_LANES.map((role) => {
              const Icon = role.icon;
              return (
                <button
                  key={role.label}
                  onClick={() => search(role.query)}
                  className="group relative overflow-hidden rounded-xl border border-neutral-200/50 bg-white p-3.5 text-left transition-all duration-200 hover:border-indigo-400/30 hover:shadow-lg hover:shadow-indigo-500/5 hover:-translate-y-0.5"
                >
                  <Icon className={`h-5 w-5 mb-2 ${role.iconColor}`} />
                  <p className="text-sm font-semibold text-neutral-900">{role.label}</p>
                  <div className="mt-1.5 flex items-center gap-1.5">
                    {role.langs.map((l) => (
                      <span key={l} className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: getLanguageColor(l) }} />
                    ))}
                    <span className={`text-[10px] font-medium ${role.signalColor}`}>{role.signal}</span>
                  </div>
                  <ArrowRight className="absolute right-3 top-3.5 h-3.5 w-3.5 text-neutral-300 opacity-0 transition-all group-hover:opacity-100 group-hover:translate-x-0.5" />
                </button>
              );
            })}
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-12">
          {/* ══ LEFT COLUMN (8 cols) ══ */}
          <div className="lg:col-span-8 space-y-6">

            {/* ── MARKET INTELLIGENCE ── */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Globe className="h-3.5 w-3.5 text-indigo-400" />
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Markets</h2>
                </div>
                <span className="text-[10px] text-neutral-400">GitHub developer activity, 30d</span>
              </div>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {MARKETS.map((m) => (
                  <button
                    key={m.city}
                    onClick={() => search(`developers in ${m.city}`)}
                    className="group rounded-xl border border-neutral-200/50 bg-white p-4 text-left transition-all duration-200 glow-hover"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-lg">{m.flag}</span>
                      <div className={`flex items-center gap-0.5 text-[10px] font-semibold ${m.trendUp ? "text-emerald-500" : "text-red-400"}`}>
                        <TrendingUp className="h-3 w-3" />
                        {m.trend}
                      </div>
                    </div>
                    <p className="text-sm font-semibold text-neutral-900">{m.city}</p>
                    <p className="text-xs text-neutral-500 tabular-nums">{m.developers} developers</p>
                    <div className="mt-3 flex items-end justify-between gap-2">
                      <div className="flex gap-1">
                        {m.topLangs.map((l) => (
                          <span key={l} className="rounded-full px-1.5 py-0.5 text-[9px] font-medium" style={{ backgroundColor: `${getLanguageColor(l)}18`, color: getLanguageColor(l) }}>
                            {l}
                          </span>
                        ))}
                      </div>
                      <Sparkline data={m.sparkline} color="#818cf8" />
                    </div>
                  </button>
                ))}
              </div>
            </section>

            {/* ── WATCHLIST / SAVED DEVELOPERS ── */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Eye className="h-3.5 w-3.5 text-amber-400" />
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                    Your watchlist
                  </h2>
                  {favorites.length > 0 && (
                    <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold tabular-nums text-amber-500">
                      {favorites.length}
                    </span>
                  )}
                </div>
                <Link href="/favorites" className="text-xs text-indigo-500 hover:text-indigo-400 transition-colors">
                  View all →
                </Link>
              </div>

              {loading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-16 animate-pulse rounded-xl bg-neutral-100" />
                  ))}
                </div>
              ) : favorites.length === 0 ? (
                <div className="rounded-xl border border-dashed border-neutral-200/50 bg-neutral-50/50 p-8 text-center">
                  <Bookmark className="mx-auto h-8 w-8 text-neutral-300" />
                  <p className="mt-2 text-sm font-medium text-neutral-500">No developers saved yet</p>
                  <p className="text-xs text-neutral-400 mt-1">Search for developers and save them to your watchlist</p>
                  <Link href="/search" className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500 transition-colors">
                    <Search className="h-3.5 w-3.5" />
                    Start searching
                  </Link>
                </div>
              ) : (
                <div className="space-y-2">
                  {favorites.slice(0, 6).map((fav, i) => {
                    const dev = fav.developer;
                    const langColor = dev.primaryLanguage ? getLanguageColor(dev.primaryLanguage) : "#888";
                    const score = dev.score || 0;
                    const scoreColor = score >= 75 ? "text-amber-500" : score >= 50 ? "text-indigo-400" : score >= 30 ? "text-emerald-500" : "text-neutral-400";

                    return (
                      <Link
                        key={fav.id}
                        href={`/profile/${dev.username}`}
                        className="group flex items-center gap-4 rounded-xl border border-neutral-200/50 bg-white p-3.5 transition-all duration-200 hover:border-indigo-400/30 hover:shadow-md"
                        style={{ animationDelay: `${i * 60}ms` }}
                      >
                        {/* Rank + Avatar */}
                        <div className="relative">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={dev.avatarUrl || `https://github.com/${dev.username}.png`}
                            alt=""
                            className="h-10 w-10 rounded-full ring-2 ring-neutral-100"
                          />
                          {score > 0 && (
                            <span className={`absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-white text-[9px] font-bold ring-1 ring-neutral-200 ${scoreColor}`}>
                              {Math.round(score)}
                            </span>
                          )}
                        </div>

                        {/* Info */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="truncate text-sm font-semibold text-neutral-900 group-hover:text-indigo-600 transition-colors">
                              {dev.name || dev.username}
                            </p>
                            {dev.primaryLanguage && (
                              <span className="flex items-center gap-1 text-[10px] text-neutral-400">
                                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: langColor }} />
                                {dev.primaryLanguage}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-[11px] text-neutral-500">
                            <span>@{dev.username}</span>
                            {dev.location && (
                              <span className="flex items-center gap-0.5">
                                <MapPin className="h-2.5 w-2.5" />
                                {dev.location}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Right side signal */}
                        <ChevronRight className="h-4 w-4 text-neutral-300 opacity-0 transition-all group-hover:opacity-100 group-hover:translate-x-0.5" />
                      </Link>
                    );
                  })}
                </div>
              )}
            </section>
          </div>

          {/* ══ RIGHT COLUMN (4 cols) ══ */}
          <aside className="lg:col-span-4 space-y-4">

            {/* ── ACTIVITY DIGEST ── */}
            <div className="rounded-xl border border-neutral-200/50 bg-white p-5">
              <div className="flex items-center gap-2 mb-4">
                <Activity className="h-3.5 w-3.5 text-indigo-400" />
                <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Activity</h3>
              </div>
              <div className="space-y-3">
                {[
                  { icon: Search, text: "Search engine", status: "Live", color: "text-emerald-500" },
                  { icon: Zap, text: "Apollo enrichment", status: "Active", color: "text-emerald-500" },
                  { icon: Target, text: "Ashby ATS", status: "Connected", color: "text-emerald-500" },
                  { icon: Radio, text: "GitHub API", status: "5K req/hr", color: "text-indigo-400" },
                ].map((item) => (
                  <div key={item.text} className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5 text-sm text-neutral-600">
                      <item.icon className="h-3.5 w-3.5 text-neutral-400" />
                      {item.text}
                    </div>
                    <span className={`text-xs font-semibold ${item.color}`}>{item.status}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* ── ALERTS ── */}
            <div className="rounded-xl border border-neutral-200/50 bg-white p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5 text-red-400" />
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Alerts</h3>
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[8px] font-bold text-white">
                    {MOCK_ALERTS.length}
                  </span>
                </div>
                <Link href="/alerts" className="text-xs text-indigo-500 hover:text-indigo-400 transition-colors">
                  View all →
                </Link>
              </div>
              <div className="space-y-2">
                {MOCK_ALERTS.map((alert, i) => {
                  const isUrgent = alert.severity === "urgent";
                  return (
                    <div
                      key={i}
                      className="rounded-lg p-3"
                      style={{
                        background: isUrgent ? "rgba(194,65,60,0.04)" : "#f7f7f5",
                        border: `0.5px solid ${isUrgent ? "rgba(194,65,60,0.12)" : "#ebebea"}`,
                      }}
                    >
                      <div className="flex items-center gap-1.5 mb-1">
                        {isUrgent && <span className="h-1.5 w-1.5 rounded-full bg-red-500" />}
                        <span className="text-xs font-semibold text-neutral-900">{alert.company}</span>
                        <span className="ml-auto text-[10px] text-neutral-400">{alert.time}</span>
                      </div>
                      <p className="text-[11px] text-neutral-500 leading-relaxed">{alert.text}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ── QUICK ACTIONS ── */}
            <div className="rounded-xl border border-neutral-200/50 bg-white p-5">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-3">Quick actions</h3>
              <div className="space-y-1">
                {[
                  { href: "/search", icon: Search, label: "Search developers", kbd: "\u2318K" },
                  { href: "/match", icon: Sparkles, label: "Match job description" },
                  { href: "/lists", icon: Bookmark, label: "Candidate lists" },
                  { href: "/settings", icon: Target, label: "Settings & Ashby" },
                ].map((action) => (
                  <Link
                    key={action.href}
                    href={action.href}
                    className="flex items-center justify-between rounded-lg px-2.5 py-2 text-sm text-neutral-600 transition-colors hover:bg-neutral-50"
                  >
                    <div className="flex items-center gap-2.5">
                      <action.icon className="h-3.5 w-3.5" />
                      {action.label}
                    </div>
                    {action.kbd && (
                      <kbd className="rounded border border-neutral-200/50 px-1.5 py-0.5 text-[9px] font-mono text-neutral-400">{action.kbd}</kbd>
                    )}
                  </Link>
                ))}
              </div>
            </div>

            {/* ── DISCOVERY TIPS ── */}
            <div className="rounded-xl border border-indigo-200/30 bg-indigo-50/30 p-5">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="h-3.5 w-3.5 text-indigo-500" />
                <h3 className="text-xs font-semibold uppercase tracking-wider text-indigo-600">Pro tip</h3>
              </div>
              <p className="text-sm text-neutral-600 leading-relaxed">
                Try searching by what developers <strong className="text-neutral-900">build</strong>, not
                just their title. <em>&quot;kubernetes contributor&quot;</em> finds better
                infra engineers than <em>&quot;devops engineer&quot;</em>.
              </p>
            </div>

            {/* ── PIPELINE STATS ── */}
            <div className="rounded-xl border border-neutral-200/50 bg-white p-5">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-3">Your pipeline</h3>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Saved", value: loading ? "..." : String(favorites.length), icon: Bookmark, color: "text-amber-500" },
                  { label: "Enriched", value: "0", icon: Zap, color: "text-violet-500" },
                  { label: "Contacted", value: "0", icon: Users, color: "text-blue-500" },
                  { label: "Pushed to ATS", value: "0", icon: Target, color: "text-emerald-500" },
                ].map((stat) => (
                  <div key={stat.label} className="flex items-center gap-2.5">
                    <stat.icon className={`h-4 w-4 ${stat.color}`} />
                    <div>
                      <p className="text-lg font-bold tabular-nums text-neutral-900">{stat.value}</p>
                      <p className="text-[10px] text-neutral-500">{stat.label}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </aside>
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
