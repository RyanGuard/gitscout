"use client";

import { useState, useEffect } from "react";
import { TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface Signal {
  label: string;
  type: "positive" | "neutral" | "negative";
}

interface OpenToMoveData {
  score: number;
  likelihood: "likely" | "possible" | "unlikely";
  signals: Signal[];
}

interface OpenToMoveWidgetProps {
  developerId?: string;
  companyDomain?: string;
}

const LIKELIHOOD_CONFIG = {
  likely: {
    label: "Likely open to move",
    color: "text-emerald-600 dark:text-emerald-400",
    ringColor: "stroke-emerald-500",
    trailColor: "stroke-emerald-100 dark:stroke-emerald-900/40",
    badgeBg: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  },
  possible: {
    label: "Possibly open",
    color: "text-amber-600 dark:text-amber-400",
    ringColor: "stroke-amber-500",
    trailColor: "stroke-amber-100 dark:stroke-amber-900/40",
    badgeBg: "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  },
  unlikely: {
    label: "Unlikely to move",
    color: "text-neutral-500 dark:text-neutral-400",
    ringColor: "stroke-neutral-400 dark:stroke-neutral-500",
    trailColor: "stroke-neutral-100 dark:stroke-neutral-800",
    badgeBg: "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400",
  },
};

function ScoreCircle({ score, likelihood }: { score: number; likelihood: "likely" | "possible" | "unlikely" }) {
  const size = 52;
  const strokeWidth = 4;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const config = LIKELIHOOD_CONFIG[likelihood];

  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          fill="none"
          className={config.trailColor}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          fill="none"
          className={config.ringColor}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.8s ease-out" }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={cn("text-sm font-bold tabular-nums", config.color)}>
          {score}
        </span>
      </div>
    </div>
  );
}

function SkeletonLoader() {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-neutral-200/50 bg-surface p-4 shadow-sm dark:border-neutral-800/80">
      <div className="h-[52px] w-[52px] flex-shrink-0 rounded-full bg-neutral-100 animate-pulse dark:bg-neutral-800" />
      <div className="flex-1 space-y-2">
        <div className="h-4 w-32 rounded bg-neutral-100 animate-pulse dark:bg-neutral-800" />
        <div className="flex gap-1.5">
          <div className="h-5 w-16 rounded-full bg-neutral-100 animate-pulse dark:bg-neutral-800" />
          <div className="h-5 w-20 rounded-full bg-neutral-100 animate-pulse dark:bg-neutral-800" />
          <div className="h-5 w-14 rounded-full bg-neutral-100 animate-pulse dark:bg-neutral-800" />
        </div>
      </div>
    </div>
  );
}

export function OpenToMoveWidget({ developerId, companyDomain }: OpenToMoveWidgetProps) {
  const [data, setData] = useState<OpenToMoveData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!developerId && !companyDomain) {
      setLoading(false);
      return;
    }

    const params = new URLSearchParams();
    if (developerId) params.set("developerId", developerId);
    if (companyDomain) params.set("domain", companyDomain);

    fetch(`/api/candidates/open-to-move?${params.toString()}`)
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then(setData)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [developerId, companyDomain]);

  if (loading) return <SkeletonLoader />;
  if (error || !data || data.score === 0) return null;

  const config = LIKELIHOOD_CONFIG[data.likelihood];
  const topSignals = (data.signals || []).slice(0, 3);

  return (
    <div className="flex items-center gap-4 rounded-xl border border-neutral-200/50 bg-surface p-4 shadow-sm transition-all hover:shadow-md dark:border-neutral-800/80">
      <ScoreCircle score={data.score} likelihood={data.likelihood} />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <TrendingUp className={cn("h-3.5 w-3.5", config.color)} />
          <span className={cn("text-sm font-semibold", config.color)}>
            {config.label}
          </span>
        </div>

        {topSignals.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {topSignals.map((signal) => (
              <span
                key={signal.label}
                className={cn(
                  "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium",
                  signal.type === "positive"
                    ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400"
                    : signal.type === "negative"
                      ? "bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400"
                      : "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400"
                )}
              >
                {signal.label}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
