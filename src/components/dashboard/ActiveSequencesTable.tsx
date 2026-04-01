"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Mail, Smartphone, ExternalLink } from "lucide-react";
import type { DashboardSequence } from "./types";

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

const LinkedinIcon = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
    aria-hidden="true"
  >
    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
  </svg>
);

const CHANNEL_ICONS: Record<
  string,
  React.ComponentType<{ className?: string }>
> = {
  email: Mail,
  linkedin: LinkedinIcon,
  text: Smartphone,
};

type FilterKey = "all" | "active" | "completed" | "needs_response";
type SortKey = "candidateName" | "status" | "messageCount" | "updatedAt";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "completed", label: "Completed" },
  { key: "needs_response", label: "Needs Response" },
];

function statusBadge(status: string) {
  const s = status.toLowerCase();
  if (s === "completed")
    return "bg-success-bg text-success border border-success/20";
  if (s === "sending" || s === "active")
    return "bg-gold-bg text-gold border border-gold-border";
  return "bg-surface-secondary text-text-muted border border-border";
}

// ─── Component ───

export function ActiveSequencesTable({
  sequences,
}: {
  sequences: DashboardSequence[];
}) {
  const [filter, setFilter] = useState<FilterKey>("all");
  const [sortKey, setSortKey] = useState<SortKey>("updatedAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const filtered = useMemo(() => {
    let list = sequences;
    if (filter === "active")
      list = list.filter(
        (s) => s.status !== "completed" && s.status !== "draft"
      );
    if (filter === "completed")
      list = list.filter((s) => s.status === "completed");
    if (filter === "needs_response")
      list = list.filter(
        (s) => !s.responseReceived && s.status === 'sending'
      );

    return [...list].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "candidateName")
        cmp = a.candidateName.localeCompare(b.candidateName);
      else if (sortKey === "status") cmp = a.status.localeCompare(b.status);
      else if (sortKey === "messageCount")
        cmp = a.messageCount - b.messageCount;
      else if (sortKey === "updatedAt")
        cmp =
          new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [sequences, filter, sortKey, sortDir]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const sortIndicator = (key: SortKey) =>
    sortKey === key ? (sortDir === "asc" ? " \u2191" : " \u2193") : "";

  return (
    <div className="rounded-xl border border-border bg-surface">
      {/* Filter pills */}
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              filter === f.key
                ? "bg-gold-bg text-gold border border-gold-border"
                : "text-text-muted hover:text-text hover:bg-surface-secondary border border-transparent"
            }`}
          >
            {f.label}
          </button>
        ))}
        <span className="ml-auto text-xs text-text-dim">
          {filtered.length} sequence{filtered.length === 1 ? "" : "s"}
        </span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-text-muted">
              <th
                className="px-4 py-2 font-medium cursor-pointer select-none"
                onClick={() => handleSort("candidateName")}
              >
                Candidate{sortIndicator("candidateName")}
              </th>
              <th className="px-4 py-2 font-medium">Channel</th>
              <th
                className="px-4 py-2 font-medium cursor-pointer select-none"
                onClick={() => handleSort("status")}
              >
                Status{sortIndicator("status")}
              </th>
              <th
                className="px-4 py-2 font-medium cursor-pointer select-none"
                onClick={() => handleSort("messageCount")}
              >
                Messages{sortIndicator("messageCount")}
              </th>
              <th
                className="px-4 py-2 font-medium cursor-pointer select-none"
                onClick={() => handleSort("updatedAt")}
              >
                Last Updated{sortIndicator("updatedAt")}
              </th>
              <th className="px-4 py-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-8 text-center text-sm text-text-muted"
                >
                  No sequences match this filter
                </td>
              </tr>
            ) : (
              filtered.map((seq) => {
                const ChannelIcon =
                  CHANNEL_ICONS[seq.channel.toLowerCase()] || Mail;
                return (
                  <tr
                    key={seq.id}
                    className="border-b border-border hover:bg-surface-secondary"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/outreach/${seq.id}`}
                        className="block group"
                      >
                        <p className="font-medium text-text group-hover:text-gold transition-colors">
                          {seq.candidateName}
                        </p>
                        {(seq.candidateTitle || seq.candidateCompany) && (
                          <p className="text-xs text-text-muted">
                            {[seq.candidateTitle, seq.candidateCompany]
                              .filter(Boolean)
                              .join(" at ")}
                          </p>
                        )}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <ChannelIcon className="h-4 w-4 text-text-muted" />
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${statusBadge(seq.status)}`}
                      >
                        {seq.status.charAt(0).toUpperCase() +
                          seq.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-text-secondary">
                      {seq.messageCount}
                    </td>
                    <td className="px-4 py-3 text-xs text-text-muted">
                      {timeAgo(seq.updatedAt)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/outreach/${seq.id}`}
                          className="inline-flex items-center gap-1 text-xs text-gold hover:text-gold-hover transition-colors"
                        >
                          Open
                          <ExternalLink className="h-3 w-3" />
                        </Link>
                        {seq.candidateLinkedinUrl && (
                          <a
                            href={seq.candidateLinkedinUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-neutral-400 hover:text-blue-500 transition-colors"
                            title="LinkedIn profile"
                          >
                            <LinkedinIcon className="h-3.5 w-3.5" />
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
