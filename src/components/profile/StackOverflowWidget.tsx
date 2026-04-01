"use client";

import { useState, useEffect } from "react";
import { ExternalLink, Loader2, Award } from "lucide-react";
import { cn } from "@/lib/utils";

interface StackOverflowData {
  userId: number;
  displayName: string;
  reputation: number;
  badgeCounts: {
    gold: number;
    silver: number;
    bronze: number;
  };
  topTags: string[];
  profileUrl: string;
}

interface StackOverflowWidgetProps {
  name: string;
}

function StackOverflowIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <rect x="3" y="3" width="18" height="18" rx="3" fill="#F48024" />
      <path d="M7 18V14" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M17 18V14" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M7 18H17" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M9 13H15" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M9.5 10.5L14.5 11.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M10.5 8L15 10" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function getTier(reputation: number): { label: string; color: string; bg: string } {
  if (reputation >= 100000)
    return { label: "Elite", color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-900/20" };
  if (reputation >= 25000)
    return { label: "Expert", color: "text-violet-600 dark:text-violet-400", bg: "bg-violet-50 dark:bg-violet-900/20" };
  if (reputation >= 5000)
    return { label: "Experienced", color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-900/20" };
  return { label: "Active", color: "text-neutral-600 dark:text-neutral-400", bg: "bg-neutral-100 dark:bg-neutral-800" };
}

function formatReputation(rep: number): string {
  if (rep >= 1_000_000) return `${(rep / 1_000_000).toFixed(1)}M`;
  if (rep >= 1_000) return `${(rep / 1_000).toFixed(1)}K`;
  return rep.toString();
}

function BadgeCount({ count, color }: { count: number; color: string }) {
  if (count === 0) return null;
  return (
    <span className="inline-flex items-center gap-1 text-xs text-neutral-600 dark:text-neutral-400">
      <span
        className={cn("h-2.5 w-2.5 rounded-full", color)}
      />
      {count}
    </span>
  );
}

export function StackOverflowWidget({ name }: StackOverflowWidgetProps) {
  const [data, setData] = useState<StackOverflowData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!name) {
      setLoading(false);
      return;
    }

    fetch(`/api/enrich/stackoverflow?name=${encodeURIComponent(name)}`)
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then(setData)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [name]);

  if (loading) {
    return (
      <div className="rounded-xl border border-neutral-200/50 bg-surface p-5 shadow-sm dark:border-neutral-800/80">
        <div className="flex items-center gap-2 text-sm text-neutral-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Searching Stack Overflow...
        </div>
      </div>
    );
  }

  if (error || !data) return null;

  const tier = getTier(data.reputation);
  const topTags = (data.topTags || []).slice(0, 5);

  return (
    <div className="rounded-xl border border-neutral-200/50 bg-surface p-5 shadow-sm dark:border-neutral-800/80">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <StackOverflowIcon className="h-6 w-6" />
          <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">
            Stack Overflow
          </h3>
        </div>
        <a
          href={data.profileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-gold hover:bg-gold-bg transition-colors"
        >
          View profile
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>

      {/* Reputation + tier */}
      <div className="flex items-baseline gap-3 mb-3">
        <span className="text-2xl font-bold tabular-nums text-neutral-900 dark:text-white">
          {formatReputation(data.reputation)}
        </span>
        <span className="text-xs text-neutral-500">reputation</span>
        <span
          className={cn(
            "ml-auto inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
            tier.color,
            tier.bg
          )}
        >
          <Award className="h-3 w-3" />
          {tier.label}
        </span>
      </div>

      {/* Badge counts */}
      <div className="flex items-center gap-4 mb-4">
        <BadgeCount count={data.badgeCounts.gold} color="bg-amber-400" />
        <BadgeCount count={data.badgeCounts.silver} color="bg-neutral-400" />
        <BadgeCount count={data.badgeCounts.bronze} color="bg-orange-700" />
      </div>

      {/* Top tags */}
      {topTags.length > 0 && (
        <div className="border-t border-neutral-100 pt-3 dark:border-neutral-800">
          <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-neutral-400">
            Top tags
          </p>
          <div className="flex flex-wrap gap-1.5">
            {topTags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center rounded-md bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
