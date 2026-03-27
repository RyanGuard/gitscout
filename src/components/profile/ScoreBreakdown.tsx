"use client";

import { useState, useEffect } from "react";
import { Loader2, TrendingUp, GitPullRequest, Activity, Code2, Users, ShieldCheck, AlertTriangle } from "lucide-react";
import { ScoreRing } from "@/components/ui/ScoreRing";
import { FeatureHint } from "@/components/ui/FeatureHint";
import { cn } from "@/lib/utils";

interface PillarData {
  score: number;
  max: number;
  label: string;
  description: string;
}

interface ScoreData {
  score: number;
  tier: string;
  confidence: string;
  confidenceValue: number;
  externalMergedPRs: number;
  totalCommits: number;
  recentActivity: number;
  pillars: {
    impact: PillarData;
    contribution: PillarData;
    consistency: PillarData;
    technical: PillarData;
    reputation: PillarData;
  };
}

const TIER_CONFIG: Record<string, { color: string; bg: string; glow: string }> = {
  Elite: { color: "text-yellow-400", bg: "bg-yellow-500", glow: "shadow-yellow-500/20" },
  Strong: { color: "text-blue-400", bg: "bg-blue-500", glow: "shadow-blue-500/20" },
  Solid: { color: "text-emerald-400", bg: "bg-emerald-500", glow: "shadow-emerald-500/20" },
  Emerging: { color: "text-neutral-400", bg: "bg-neutral-500", glow: "" },
  "Limited Data": { color: "text-neutral-500", bg: "bg-neutral-600", glow: "" },
};

const PILLAR_ICONS = {
  impact: TrendingUp,
  contribution: GitPullRequest,
  consistency: Activity,
  technical: Code2,
  reputation: Users,
};

const PILLAR_COLORS = {
  impact: "bg-orange-500",
  contribution: "bg-violet-500",
  consistency: "bg-sky-500",
  technical: "bg-emerald-500",
  reputation: "bg-pink-500",
};

function PillarBar({ pillarKey, data, delay }: { pillarKey: string; data: PillarData; delay: number }) {
  const [animated, setAnimated] = useState(false);
  const Icon = PILLAR_ICONS[pillarKey as keyof typeof PILLAR_ICONS];
  const barColor = PILLAR_COLORS[pillarKey as keyof typeof PILLAR_COLORS] || "bg-blue-500";
  const pct = (data.score / data.max) * 100;

  useEffect(() => {
    const timer = setTimeout(() => setAnimated(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  return (
    <div className="group">
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          {Icon && <Icon className="h-3.5 w-3.5 text-neutral-400" />}
          <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
            {data.label}
          </span>
        </div>
        <span className="text-sm font-bold tabular-nums text-neutral-900 dark:text-white">
          {data.score.toFixed(1)}<span className="text-neutral-400 font-normal">/{data.max}</span>
        </span>
      </div>
      <div className="h-2 rounded-full bg-neutral-100 dark:bg-neutral-800 overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all duration-1000 ease-out", barColor)}
          style={{ width: animated ? `${pct}%` : "0%" }}
        />
      </div>
      <p className="mt-1 text-xs text-neutral-400 opacity-0 group-hover:opacity-100 transition-opacity">
        {data.description}
      </p>
    </div>
  );
}

export function ScoreBreakdown({ username }: { username: string }) {
  const [data, setData] = useState<ScoreData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch(`/api/score/${username}`)
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then(setData)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [username]);

  if (loading) {
    return (
      <div className="rounded-xl border border-neutral-200 bg-white p-6 dark:border-neutral-700 dark:bg-neutral-900">
        <div className="flex items-center gap-2 text-sm text-neutral-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Computing developer score...
        </div>
      </div>
    );
  }

  if (error || !data) return null;

  const tierConfig = TIER_CONFIG[data.tier] || TIER_CONFIG["Limited Data"];

  return (
    <div className={cn(
      "rounded-xl border border-neutral-200 bg-white p-6 dark:border-neutral-700 dark:bg-neutral-900",
      tierConfig.glow && `shadow-lg ${tierConfig.glow}`
    )}>
      {/* Score header with animated ring */}
      <div className="flex items-center gap-6 mb-6">
        <ScoreRing score={data.score} size={110} />
        <div className="flex-1">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-neutral-900 dark:text-white">
            Scout Score
            <FeatureHint id="profile-score" message="This shows 5 quality pillars based on actual code contributions — not a self-reported resume. Hover each bar for details." position="right" />
          </h2>
          <p className="text-xs text-neutral-500 mt-0.5">
            5-pillar analysis • {data.externalMergedPRs} external merged PRs
          </p>
        </div>
      </div>

      {/* Confidence indicator */}
      <div className={cn(
        "mb-5 flex items-center gap-2 rounded-lg px-3 py-2 text-xs",
        data.confidence === "high"
          ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
          : data.confidence === "medium"
            ? "bg-yellow-50 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300"
            : "bg-neutral-50 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400"
      )}>
        {data.confidence === "high" ? (
          <ShieldCheck className="h-3.5 w-3.5" />
        ) : (
          <AlertTriangle className="h-3.5 w-3.5" />
        )}
        <span className="font-medium capitalize">{data.confidence} confidence</span>
        <span className="text-current/60">
          {data.confidence === "high"
            ? "— Active profile with rich public data"
            : data.confidence === "medium"
              ? "— Moderate public activity"
              : "— Limited public data (may still be an excellent engineer)"}
        </span>
      </div>

      {/* Pillar breakdown */}
      <div className="space-y-4">
        {Object.entries(data.pillars).map(([key, pillar], i) => (
          <PillarBar key={key} pillarKey={key} data={pillar} delay={i * 150} />
        ))}
      </div>

      {/* Key stats */}
      <div className="mt-5 grid grid-cols-3 gap-3 border-t border-neutral-100 pt-4 dark:border-neutral-800">
        <div className="text-center">
          <div className="text-lg font-bold text-neutral-900 dark:text-white">{data.externalMergedPRs}</div>
          <div className="text-xs text-neutral-500">External PRs</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold text-neutral-900 dark:text-white">{data.totalCommits.toLocaleString()}</div>
          <div className="text-xs text-neutral-500">Commits (12mo)</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold text-neutral-900 dark:text-white">{data.recentActivity.toLocaleString()}</div>
          <div className="text-xs text-neutral-500">Contributions</div>
        </div>
      </div>
    </div>
  );
}
