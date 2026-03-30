"use client";

import type { AnalyticsData } from "./types";

// ─── Props ───

interface IntelligenceSectionProps {
  analytics: AnalyticsData | null;
}

// ─── Component ───

export function IntelligenceSection({ analytics }: IntelligenceSectionProps) {
  if (!analytics?.hasEnoughData) return null;

  return (
    <div className="mb-5">
      <h3 className="text-[10px] font-semibold uppercase tracking-wide text-text-muted mb-3">
        What&apos;s working for you
      </h3>
      <div className="rounded-xl border border-border bg-surface p-3 space-y-2">
        {analytics.bestChannel && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-text-muted">Best channel</span>
            <span className="font-semibold text-text capitalize">{analytics.bestChannel.channel} ({analytics.bestChannel.rate}%)</span>
          </div>
        )}
        {analytics.bestTone && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-text-muted">Best tone</span>
            <span className="font-semibold text-text capitalize">{analytics.bestTone.tone.replace("_", " ")} ({analytics.bestTone.rate}%)</span>
          </div>
        )}
        {analytics.optimalLength && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-text-muted">Optimal length</span>
            <span className="font-semibold text-text">{analytics.optimalLength.min}-{analytics.optimalLength.max} words</span>
          </div>
        )}
        {analytics.topSignal && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-text-muted">Top signal</span>
            <span className="font-semibold text-gold">{analytics.topSignal.signal} (+{analytics.topSignal.rate}%)</span>
          </div>
        )}
      </div>
      <p className="mt-1.5 text-[10px] text-text-dim">
        These stats are from YOUR outreach. Scout learns what works for you specifically.
      </p>
    </div>
  );
}
