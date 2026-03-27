"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

const STAGES = [
  { key: "mapped", label: "Mapped", color: "bg-neutral-500" },
  { key: "shortlisted", label: "Shortlisted", color: "bg-blue-500" },
  { key: "contacted", label: "Contacted", color: "bg-amber-500" },
  { key: "responded", label: "Responded", color: "bg-teal-500" },
  { key: "screening", label: "Screening", color: "bg-purple-500" },
  { key: "offer", label: "Offer", color: "bg-emerald-500" },
];

interface PipelineFunnelProps {
  statusCounts: Record<string, number>;
  onFilterStage?: (stage: string | null) => void;
  activeFilter?: string | null;
}

export function PipelineFunnel({
  statusCounts,
  onFilterStage,
  activeFilter,
}: PipelineFunnelProps) {
  const [collapsed, setCollapsed] = useState(true);

  const total = Object.values(statusCounts).reduce((s, v) => s + v, 0);
  const rejected = statusCounts["rejected"] || 0;

  return (
    <div className="rounded-xl border border-neutral-800/50 bg-neutral-900/30 overflow-hidden mb-4">
      {/* Toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-neutral-300 hover:bg-neutral-800/30 transition-colors"
      >
        {collapsed ? (
          <ChevronRight className="h-4 w-4 text-neutral-500" />
        ) : (
          <ChevronDown className="h-4 w-4 text-neutral-500" />
        )}
        Pipeline
        <span className="text-xs text-neutral-500 ml-1">
          {total} total{rejected > 0 ? ` · ${rejected} rejected` : ""}
        </span>
        {activeFilter && (
          <span className="ml-auto text-xs text-indigo-400">
            Filtered: {activeFilter}
          </span>
        )}
      </button>

      {!collapsed && (
        <div className="px-4 pb-4">
          {/* Funnel bar */}
          <div className="flex rounded-lg overflow-hidden h-8 mb-3">
            {STAGES.map((stage) => {
              const count = statusCounts[stage.key] || 0;
              if (count === 0) return null;
              const pct = total > 0 ? (count / total) * 100 : 0;
              const isActive = activeFilter === stage.key;

              return (
                <button
                  key={stage.key}
                  onClick={() =>
                    onFilterStage?.(isActive ? null : stage.key)
                  }
                  className={`${stage.color} relative flex items-center justify-center transition-all ${
                    isActive ? "brightness-125 ring-2 ring-white/30" : "hover:brightness-110"
                  }`}
                  style={{ width: `${Math.max(pct, 4)}%` }}
                  title={`${stage.label}: ${count}`}
                >
                  {pct > 8 && (
                    <span className="text-[10px] font-bold text-white/90">
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Labels */}
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {STAGES.map((stage, i) => {
              const count = statusCounts[stage.key] || 0;
              const prevCount =
                i > 0 ? statusCounts[STAGES[i - 1].key] || 0 : 0;
              const conversionRate =
                i > 0 && prevCount > 0
                  ? Math.round((count / prevCount) * 100)
                  : null;

              return (
                <div key={stage.key} className="flex items-center gap-1.5">
                  <div
                    className={`h-2 w-2 rounded-full ${stage.color}`}
                  />
                  <span className="text-xs text-neutral-400">
                    {stage.label}
                  </span>
                  <span className="text-xs font-semibold text-white">
                    {count}
                  </span>
                  {conversionRate !== null && count > 0 && (
                    <span className="text-[10px] text-neutral-500">
                      ({conversionRate}%)
                    </span>
                  )}
                </div>
              );
            })}
            {rejected > 0 && (
              <div className="flex items-center gap-1.5">
                <div className="h-2 w-2 rounded-full bg-red-500" />
                <span className="text-xs text-neutral-400">Rejected</span>
                <span className="text-xs font-semibold text-white">
                  {rejected}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
