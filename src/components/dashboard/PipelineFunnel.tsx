"use client";

import type { FunnelData } from "./types";

// ─── Config ───

const STAGES: { key: keyof FunnelData; label: string }[] = [
  { key: "sourced", label: "Sourced" },
  { key: "outreach_sent", label: "Outreach Sent" },
  { key: "responded", label: "Responded" },
  { key: "interested", label: "Interested" },
  { key: "in_ats", label: "In ATS" },
];

// ─── Component ───

export function PipelineFunnel({ funnel }: { funnel: FunnelData }) {
  const maxCount = Math.max(
    ...STAGES.map((s) => funnel[s.key]),
    1 // avoid division by zero
  );

  const allZero = STAGES.every((s) => funnel[s.key] === 0);

  if (allZero) {
    return (
      <div className="rounded-xl border border-border bg-surface p-6 text-center">
        <p className="text-sm text-text-muted">No outreach data yet</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <h3 className="mb-3 text-xs font-medium text-text-muted uppercase tracking-wide">
        Pipeline Funnel
      </h3>
      <div className="space-y-2">
        {STAGES.map((stage) => {
          const count = funnel[stage.key];
          const widthPct = (count / maxCount) * 100;
          return (
            <div key={stage.key} className="flex items-center gap-3">
              <span className="w-20 shrink-0 text-xs text-text-muted text-right">
                {stage.label}
              </span>
              <span className="w-8 shrink-0 text-xs font-medium text-text text-right">
                {count}
              </span>
              <div className="flex-1 h-5 rounded bg-surface-secondary overflow-hidden">
                <div
                  className="h-full rounded bg-gradient-to-r from-gold to-gold-hover transition-all duration-500"
                  style={{ width: `${widthPct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
