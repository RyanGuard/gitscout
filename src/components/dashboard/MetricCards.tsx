"use client";

import { TrendingUp, Mail, MessageSquare, Clock } from "lucide-react";
import type { DashboardMetrics } from "./types";

// ─── Component ───

export function MetricCards({ metrics }: { metrics: DashboardMetrics }) {
  if (metrics.totalDataPoints < 10) {
    return (
      <div className="rounded-xl border border-border bg-surface p-6 text-center">
        <p className="text-sm text-text-muted">
          Send 10+ sequences to see insights
        </p>
        <p className="mt-1 text-xs text-text-dim">
          {metrics.totalDataPoints} of 10 data points collected
        </p>
      </div>
    );
  }

  const cards = [
    {
      label: "Response Rate",
      value: `${metrics.responseRate.toFixed(1)}%`,
      icon: TrendingUp,
    },
    {
      label: "Best Channel",
      value: metrics.bestChannel
        ? `${metrics.bestChannel.channel.charAt(0).toUpperCase() + metrics.bestChannel.channel.slice(1)}`
        : "—",
      sub: metrics.bestChannel ? `${metrics.bestChannel.rate.toFixed(1)}%` : null,
      icon: Mail,
    },
    {
      label: "Best Tone",
      value: metrics.bestTone
        ? metrics.bestTone.tone.replace(/_/g, " ")
        : "—",
      sub: metrics.bestTone ? `${metrics.bestTone.rate.toFixed(1)}%` : null,
      icon: MessageSquare,
    },
    {
      label: "Avg Response Time",
      value: metrics.avgResponseTime !== null
        ? `${metrics.avgResponseTime.toFixed(1)}h`
        : "—",
      icon: Clock,
    },
  ];

  return (
    <div className="grid grid-cols-4 gap-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.label}
            className="rounded-xl border border-border bg-surface p-4"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs text-text-muted">{card.label}</span>
              <Icon className="h-4 w-4 text-text-dim" />
            </div>
            <p className="mt-2 text-2xl font-bold text-gold">{card.value}</p>
            {card.sub && (
              <p className="mt-0.5 text-xs text-text-muted">{card.sub}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
