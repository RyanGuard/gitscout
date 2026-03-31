"use client";

import { useRouter } from "next/navigation";
import {
  TrendingUp,
  Globe,
  Code,
  GitFork,
  Zap,
  Sparkles,
  Target,
  ArrowRight,
  Search,
  Bookmark,
} from "lucide-react";
import Link from "next/link";
import { getLanguageColor } from "@/lib/utils";

// ---------------------------------------------------------------
//  Sparkline -- tiny activity visualization
// ---------------------------------------------------------------
function Sparkline({ data, color }: { data: number[]; color?: string }) {
  const max = Math.max(...data, 1);
  return (
    <div className="flex items-end gap-[2px] h-5">
      {data.map((v, i) => (
        <div
          key={i}
          className="w-[3px] rounded-full animate-grow-bar"
          style={{
            height: `${Math.max(8, (v / max) * 100)}%`,
            backgroundColor: color || "var(--gold)",
            opacity: 0.4 + (v / max) * 0.6,
            animationDelay: `${i * 50}ms`,
          }}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------
//  Market intelligence cards
// ---------------------------------------------------------------
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

// ---------------------------------------------------------------
//  Role lanes
// ---------------------------------------------------------------
const ROLE_LANES = [
  { label: "Frontend", query: "react typescript frontend", langs: ["TypeScript", "JavaScript"], icon: Code, iconColor: "text-blue-500", signal: "High demand", signalColor: "text-amber-500" },
  { label: "Backend", query: "go python backend api", langs: ["Go", "Python"], icon: GitFork, iconColor: "text-emerald-500", signal: "Growing", signalColor: "text-emerald-500" },
  { label: "ML / AI", query: "python machine learning AI", langs: ["Python"], icon: Sparkles, iconColor: "text-violet-500", signal: "Surging", signalColor: "text-red-500" },
  { label: "Infra / DevOps", query: "kubernetes terraform infrastructure", langs: ["Go", "Python"], icon: Globe, iconColor: "text-cyan-500", signal: "Steady", signalColor: "text-neutral-400" },
  { label: "Rust Systems", query: "rust systems performance", langs: ["Rust"], icon: Zap, iconColor: "text-orange-500", signal: "Hot", signalColor: "text-red-500" },
  { label: "Mobile", query: "swift kotlin mobile", langs: ["Swift", "Kotlin"], icon: Target, iconColor: "text-pink-500", signal: "Stable", signalColor: "text-neutral-400" },
];

// ---------------------------------------------------------------
//  Quick actions
// ---------------------------------------------------------------
const QUICK_ACTIONS = [
  { href: "/search", icon: Search, label: "Search developers", kbd: "\u2318K" },
  { href: "/match", icon: Sparkles, label: "Match job description" },
  { href: "/lists", icon: Bookmark, label: "Candidate lists" },
  { href: "/settings", icon: Target, label: "Settings & Ashby" },
];

// ===============================================================
//  SearchDiscovery -- landing view for /search when no query
// ===============================================================
export function SearchDiscovery() {
  const router = useRouter();

  function search(q: string) {
    if (q.trim()) router.push(`/search?q=${encodeURIComponent(q.trim())}`);
  }

  return (
    <div className="py-4">
      {/* ---- TALENT LANES ---- */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
            Discover talent
          </h2>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {ROLE_LANES.map((role) => {
            const Icon = role.icon;
            return (
              <button
                key={role.label}
                onClick={() => search(role.query)}
                className="group relative overflow-hidden rounded-xl border border-neutral-200/50 bg-surface p-3.5 text-left transition-all duration-200 hover:border-gold/30 hover:shadow-lg hover:shadow-gold/5 hover:-translate-y-0.5 dark:border-neutral-800/80 dark:bg-neutral-900/40 dark:hover:border-gold/30 dark:hover:bg-neutral-900/60"
              >
                <Icon className={`h-5 w-5 mb-2 ${role.iconColor}`} />
                <p className="text-sm font-semibold text-neutral-900 dark:text-white">{role.label}</p>
                <div className="mt-1.5 flex items-center gap-1.5">
                  {role.langs.map((l) => (
                    <span key={l} className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: getLanguageColor(l) }} />
                  ))}
                  <span className={`text-[10px] font-medium ${role.signalColor}`}>{role.signal}</span>
                </div>
                <ArrowRight className="absolute right-3 top-3.5 h-3.5 w-3.5 text-neutral-300 opacity-0 transition-all group-hover:opacity-100 group-hover:translate-x-0.5 dark:text-neutral-600" />
              </button>
            );
          })}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left column */}
        <div className="lg:col-span-8 space-y-6">
          {/* ---- MARKET INTELLIGENCE ---- */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Globe className="h-3.5 w-3.5 text-gold" />
                <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Markets</h2>
              </div>
              <span className="text-[10px] text-neutral-400">GitHub developer activity, 30d</span>
            </div>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {MARKETS.map((m) => (
                <button
                  key={m.city}
                  onClick={() => search(`developers in ${m.city}`)}
                  className="group rounded-xl border border-neutral-200/50 bg-surface p-4 text-left transition-all duration-200 glow-hover dark:border-neutral-700/50 dark:bg-neutral-900/60"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-lg">{m.flag}</span>
                    <div className={`flex items-center gap-0.5 text-[10px] font-semibold ${m.trendUp ? "text-emerald-500" : "text-red-400"}`}>
                      <TrendingUp className="h-3 w-3" />
                      {m.trend}
                    </div>
                  </div>
                  <p className="text-sm font-semibold text-neutral-900 dark:text-white">{m.city}</p>
                  <p className="text-xs text-neutral-500 tabular-nums">{m.developers} developers</p>
                  <div className="mt-3 flex items-end justify-between gap-2">
                    <div className="flex gap-1">
                      {m.topLangs.map((l) => (
                        <span key={l} className="rounded-full px-1.5 py-0.5 text-[9px] font-medium" style={{ backgroundColor: `${getLanguageColor(l)}18`, color: getLanguageColor(l) }}>
                          {l}
                        </span>
                      ))}
                    </div>
                    <Sparkline data={m.sparkline} />
                  </div>
                </button>
              ))}
            </div>
          </section>
        </div>

        {/* Right column */}
        <aside className="lg:col-span-4 space-y-4">
          {/* ---- QUICK ACTIONS ---- */}
          <div className="rounded-xl border border-neutral-200/50 bg-surface p-5 dark:border-neutral-700/50 dark:bg-neutral-900/60">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-3">Quick actions</h3>
            <div className="space-y-1">
              {QUICK_ACTIONS.map((action) => (
                <Link
                  key={action.href}
                  href={action.href}
                  className="flex items-center justify-between rounded-lg px-2.5 py-2 text-sm text-neutral-600 transition-colors hover:bg-neutral-50 dark:text-neutral-400 dark:hover:bg-neutral-800/50"
                >
                  <div className="flex items-center gap-2.5">
                    <action.icon className="h-3.5 w-3.5" />
                    {action.label}
                  </div>
                  {action.kbd && (
                    <kbd className="rounded border border-neutral-200/50 px-1.5 py-0.5 text-[9px] font-mono text-neutral-400 dark:border-neutral-700/50">{action.kbd}</kbd>
                  )}
                </Link>
              ))}
            </div>
          </div>

          {/* ---- DISCOVERY TIP ---- */}
          <div className="rounded-xl border border-gold-border bg-gold-bg p-5">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="h-3.5 w-3.5 text-gold" />
              <h3 className="text-xs font-semibold uppercase tracking-wider text-gold-muted dark:text-gold">Pro tip</h3>
            </div>
            <p className="text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed">
              Try searching by what developers <strong className="text-neutral-900 dark:text-white">build</strong>, not
              just their title. <em>&quot;kubernetes contributor&quot;</em> finds better
              infra engineers than <em>&quot;devops engineer&quot;</em>.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
