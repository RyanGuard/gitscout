"use client";

import { Eye, Heart, UserPlus, MessageSquare } from "lucide-react";
import type { AgentStatus } from "./types";

// ─── Helpers ───

function timeAgo(date: string): string {
  const seconds = Math.floor(
    (Date.now() - new Date(date).getTime()) / 1000
  );
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function isWithin30Min(dateStr: string): boolean {
  return Date.now() - new Date(dateStr).getTime() < 30 * 60 * 1000;
}

// ─── Config ───

const ACTION_STATS: {
  key: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { key: "view_profile", label: "Views", icon: Eye },
  { key: "like_post", label: "Likes", icon: Heart },
  { key: "connect", label: "Connections", icon: UserPlus },
  { key: "message", label: "Messages", icon: MessageSquare },
];

// ─── Component ───

export function AgentStatusCard({ status }: { status: AgentStatus }) {
  const hasActions = status.totalToday > 0;
  const isRecent = status.lastActionAt
    ? isWithin30Min(status.lastActionAt)
    : false;

  // Status dot color
  const dotColor = hasActions && isRecent
    ? "bg-success"
    : hasActions
      ? "bg-warning"
      : "bg-text-dim";

  // No actions at all — show install prompt
  if (!hasActions && !status.lastActionAt) {
    return (
      <div className="rounded-xl border border-border bg-surface p-4">
        <div className="flex items-center gap-2 mb-3">
          <span className={`h-2 w-2 rounded-full ${dotColor}`} />
          <h3 className="text-sm font-medium text-text">LinkedIn Agent</h3>
        </div>
        <p className="text-xs text-text-muted">
          Install GitScout Agent to automate LinkedIn outreach
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      {/* Header */}
      <div className="flex items-center gap-2 mb-1">
        <span className={`h-2 w-2 rounded-full ${dotColor}`} />
        <h3 className="text-sm font-medium text-text">LinkedIn Agent</h3>
      </div>
      <p className="mb-3 text-xs text-text-muted">
        {isRecent ? "Running on your desktop" : "No recent activity"}
      </p>

      {/* 2x2 action stats */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        {ACTION_STATS.map((stat) => {
          const Icon = stat.icon;
          const count = status.todayActions[stat.key] ?? 0;
          return (
            <div
              key={stat.key}
              className="flex items-center gap-2 rounded-lg bg-surface-secondary px-3 py-2"
            >
              <Icon className="h-3.5 w-3.5 text-text-dim" />
              <div>
                <p className="text-sm font-medium text-text">{count}</p>
                <p className="text-[10px] text-text-muted">{stat.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Last action */}
      {status.lastActionAt && (
        <p className="text-[11px] text-text-dim">
          Last action: {timeAgo(status.lastActionAt)}
        </p>
      )}
    </div>
  );
}
