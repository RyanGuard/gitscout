"use client";

import { AlertTriangle, Clock, CheckCircle2 } from "lucide-react";
import type { AttentionItem } from "./types";

// ─── Config ───

const CONFIG: Record<
  AttentionItem["type"],
  {
    icon: React.ComponentType<{ className?: string }>;
    borderClass: string;
    iconColor: string;
  }
> = {
  overdue: {
    icon: AlertTriangle,
    borderClass: "border-l-danger",
    iconColor: "text-danger",
  },
  stuck: {
    icon: Clock,
    borderClass: "border-l-warning",
    iconColor: "text-warning",
  },
  positive_response: {
    icon: CheckCircle2,
    borderClass: "border-l-success",
    iconColor: "text-success",
  },
};

const LABELS: Record<AttentionItem["type"], (count: number) => string> = {
  overdue: (n) => `${n} candidate${n === 1 ? "" : "s"} awaiting follow-up`,
  stuck: (n) => `${n} sequence${n === 1 ? "" : "s"} need${n === 1 ? "s" : ""} attention`,
  positive_response: (n) =>
    `${n} positive response${n === 1 ? "" : "s"} — take action`,
};

// ─── Component ───

export function NeedsAttentionCards({
  items,
}: {
  items: AttentionItem[];
}) {
  if (items.length === 0) return null;

  return (
    <div className="flex gap-4">
      {items.map((item) => {
        const cfg = CONFIG[item.type];
        const Icon = cfg.icon;
        return (
          <div
            key={item.type}
            className={`flex-1 rounded-lg border border-border border-l-4 ${cfg.borderClass} bg-surface px-4 py-3 flex items-center gap-3`}
          >
            <Icon className={`h-5 w-5 shrink-0 ${cfg.iconColor}`} />
            <div>
              <p className="text-sm font-medium text-text">
                {LABELS[item.type](item.count)}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
