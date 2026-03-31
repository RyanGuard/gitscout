"use client";

import { Bell, ArrowRight } from "lucide-react";
import Link from "next/link";
import type { AlertItem } from "./types";

// ─── Helpers ───

function timeAgo(dateStr: string): string {
  const seconds = Math.floor(
    (Date.now() - new Date(dateStr).getTime()) / 1000
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

function severityDotColor(severity: string): string {
  switch (severity) {
    case "critical":
    case "high":
      return "bg-danger";
    case "medium":
      return "bg-warning";
    case "low":
    default:
      return "bg-text-dim";
  }
}

function severityBadgeColor(severity: string): string {
  switch (severity) {
    case "critical":
    case "high":
      return "bg-danger/20 text-danger";
    case "medium":
      return "bg-warning/20 text-warning";
    case "low":
    default:
      return "bg-surface-secondary text-text-dim";
  }
}

// ─── Component ───

export function AlertsCard({ alerts }: { alerts: AlertItem[] }) {
  const unreadCount = alerts.filter((a) => !a.isRead).length;

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
            Alerts
          </h3>
          {unreadCount > 0 && (
            <span className="rounded-full bg-danger/20 px-2 py-0.5 text-[10px] font-medium text-danger">
              {unreadCount}
            </span>
          )}
          {unreadCount === 0 && alerts.length > 0 && (
            <span className="rounded-full bg-surface-secondary px-2 py-0.5 text-[10px] font-medium text-text-muted">
              {alerts.length}
            </span>
          )}
        </div>
        <Link
          href="/alerts"
          className="flex items-center gap-1 text-xs text-text-muted hover:text-gold transition-colors"
        >
          View all
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      {/* List */}
      {alerts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-6 text-center">
          <Bell className="h-6 w-6 text-text-dim mb-2" />
          <p className="text-sm text-text-muted">
            Watch companies in Market Research to see signals here
          </p>
        </div>
      ) : (
        <div className="space-y-1">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className={`flex items-start gap-3 rounded-lg px-2 py-2 ${
                !alert.isRead ? "bg-surface-secondary/50" : ""
              }`}
            >
              {/* Severity dot */}
              <span
                className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${severityDotColor(alert.severity)}`}
              />

              {/* Content */}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-text">
                  {alert.companyName}
                </p>
                <p className="text-xs text-text-muted truncate">
                  {alert.summary}
                </p>
              </div>

              {/* Timestamp */}
              <span className="shrink-0 text-xs text-text-dim">
                {timeAgo(alert.createdAt)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
