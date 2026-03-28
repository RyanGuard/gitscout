"use client";

import Link from "next/link";
import { Mail, MessageSquare, Users, ArrowRight } from "lucide-react";

function LinkedinIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
      <rect width="4" height="12" x="2" y="9" />
      <circle cx="4" cy="4" r="2" />
    </svg>
  );
}

interface SequenceCardData {
  id: string;
  name: string;
  description?: string;
  status: string;
  tone: string;
  roleTitle?: string;
  totalEnrolled: number;
  totalReplied: number;
  stepCount: number;
  channels: string[];
  createdAt: string;
}

const STATUS_BADGE: Record<string, { label: string; classes: string }> = {
  draft: { label: "Draft", classes: "bg-neutral-500/10 text-neutral-500" },
  active: { label: "Active", classes: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
  paused: { label: "Paused", classes: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  completed: { label: "Completed", classes: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
};

const CHANNEL_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  email: Mail,
  linkedin: LinkedinIcon,
  inmail: MessageSquare,
};

export function SequenceCard({ sequence }: { sequence: SequenceCardData }) {
  const badge = STATUS_BADGE[sequence.status] || STATUS_BADGE.draft;
  const replyRate =
    sequence.totalEnrolled > 0
      ? Math.round((sequence.totalReplied / sequence.totalEnrolled) * 100)
      : 0;

  const uniqueChannels = [...new Set(sequence.channels)];

  return (
    <Link
      href={`/outreach/${sequence.id}`}
      className="group block rounded-xl border border-neutral-200/50 bg-surface p-5 shadow-sm transition-all hover:border-gold/30 hover:shadow-md dark:border-neutral-800/80 dark:hover:border-gold/20"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-neutral-900 dark:text-white truncate">
            {sequence.name}
          </h3>
          {sequence.roleTitle && (
            <p className="mt-0.5 text-xs text-neutral-500 truncate">
              {sequence.roleTitle}
            </p>
          )}
        </div>
        <span
          className={`ml-2 shrink-0 rounded-md px-2 py-0.5 text-[10px] font-semibold ${badge.classes}`}
        >
          {badge.label}
        </span>
      </div>

      <div className="flex items-center gap-3 text-xs text-neutral-500 mb-3">
        <span className="flex items-center gap-1">
          {sequence.stepCount} step{sequence.stepCount !== 1 ? "s" : ""}
        </span>
        <div className="flex items-center gap-1">
          {uniqueChannels.map((ch) => {
            const Icon = CHANNEL_ICONS[ch] || Mail;
            return <Icon key={ch} className="h-3 w-3" />;
          })}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 text-xs">
          <span className="flex items-center gap-1 text-neutral-600 dark:text-neutral-400">
            <Users className="h-3 w-3" />
            {sequence.totalEnrolled} enrolled
          </span>
          {sequence.totalReplied > 0 && (
            <span className="text-emerald-600 dark:text-emerald-400 font-medium">
              {replyRate}% replied
            </span>
          )}
        </div>
        <ArrowRight className="h-3.5 w-3.5 text-neutral-300 transition-transform group-hover:translate-x-0.5 group-hover:text-gold" />
      </div>
    </Link>
  );
}
