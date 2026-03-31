"use client";

import { Eye, UserPlus, MessageSquare, Heart, Send } from "lucide-react";
import type { ActivityItem } from "./types";

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
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

// ─── Config ───

const TYPE_ICONS: Record<
  string,
  React.ComponentType<{ className?: string }>
> = {
  view_profile: Eye,
  connect: UserPlus,
  message: MessageSquare,
  like_post: Heart,
  sequence_created: Send,
};

const STATUS_COLORS: Record<string, string> = {
  completed: "bg-success",
  executing: "bg-gold",
  queued: "bg-text-muted",
  failed: "bg-danger",
};

function describeActivity(item: ActivityItem): string {
  switch (item.type) {
    case "view_profile":
      return `Viewed ${item.name}'s profile`;
    case "connect":
      return `Sent connection to ${item.name}`;
    case "message":
      return `Messaged ${item.name}`;
    case "like_post":
      return `Liked ${item.name}'s post`;
    case "sequence_created":
      return `Created sequence for ${item.name}`;
    default:
      return `${item.type} — ${item.name}`;
  }
}

// ─── Component ───

export function RecentActivityFeed({
  activities,
}: {
  activities: ActivityItem[];
}) {
  if (activities.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface p-6 text-center">
        <p className="text-sm text-text-muted">No activity yet</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <h3 className="mb-3 text-xs font-medium text-text-muted uppercase tracking-wide">
        Recent Activity
      </h3>
      <div className="max-h-[350px] overflow-y-auto space-y-0">
        {activities.map((item, idx) => {
          const Icon = TYPE_ICONS[item.type] || Send;
          const dotColor =
            STATUS_COLORS[item.status ?? "completed"] ?? "bg-text-muted";
          return (
            <div
              key={`${item.type}-${item.timestamp}-${idx}`}
              className="flex items-start gap-3 py-2 border-b border-border last:border-b-0"
            >
              {/* Icon + dot */}
              <div className="relative mt-0.5 shrink-0">
                <Icon className="h-4 w-4 text-text-dim" />
                <span
                  className={`absolute -bottom-0.5 -right-0.5 h-1.5 w-1.5 rounded-full ${dotColor}`}
                />
              </div>
              {/* Description */}
              <p className="flex-1 text-xs text-text leading-relaxed">
                {describeActivity(item)}
              </p>
              {/* Timestamp */}
              <span className="shrink-0 text-[11px] text-text-dim">
                {timeAgo(item.timestamp)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
