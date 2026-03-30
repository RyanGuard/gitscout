"use client";

import { useState, useEffect } from "react";
import {
  Eye,
  Heart,
  UserPlus,
  MessageSquare,
  CheckCircle2,
  Circle,
  Loader2,
  XCircle,
} from "lucide-react";

// ─── Types ───

interface LinkedInAction {
  id: string;
  action_type: string;
  status: string;
  target_name: string;
  scheduled_for: string;
  executed_at: string | null;
}

interface SequenceStatusCardProps {
  channel: string;
  tone: string;
  strategy: string;
  roleContext: {
    roleTitle: string;
    company: string;
    payRange: { min: string; max: string; showToCandidate: boolean } | null;
    workModel: "remote" | "hybrid" | "onsite" | null;
    techStack: string[];
    teamSize: string;
    companyStage: string;
    recentNews: string;
  };
  sequenceId: string | null;
  sequenceStatus: string;
  messages: Array<{
    stepNumber: number;
    delayDays: number;
    channel: string;
    body: string;
  }>;
}

// ─── Helpers ───

const ACTION_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  view_profile: Eye,
  like_post: Heart,
  connect: UserPlus,
  message: MessageSquare,
};

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function buildRoleSummary(rc: SequenceStatusCardProps["roleContext"]): string {
  const parts: string[] = [];

  if (rc.roleTitle) {
    const titlePart = rc.company ? `${rc.roleTitle} at ${rc.company}` : rc.roleTitle;
    parts.push(titlePart);
  } else if (rc.company) {
    parts.push(rc.company);
  }

  if (rc.workModel) {
    parts.push(rc.workModel.charAt(0).toUpperCase() + rc.workModel.slice(1));
  }

  if (rc.payRange && (rc.payRange.min || rc.payRange.max)) {
    const min = rc.payRange.min ? `$${rc.payRange.min}` : "";
    const max = rc.payRange.max ? `$${rc.payRange.max}` : "";
    if (min && max) {
      parts.push(`${min}-${max}k`);
    } else {
      parts.push(`${min || max}k`);
    }
  }

  return parts.join(" \u2014 ");
}

// ─── Component ───

export function SequenceStatusCard({
  channel,
  tone,
  strategy,
  roleContext,
  sequenceId,
  sequenceStatus,
  messages,
}: SequenceStatusCardProps) {
  const [linkedInActions, setLinkedInActions] = useState<LinkedInAction[]>([]);

  // Poll for LinkedIn action queue status
  useEffect(() => {
    if (!sequenceId) {
      setLinkedInActions([]);
      return;
    }
    let cancelled = false;

    async function fetchActions() {
      try {
        const res = await fetch(`/api/outreach/linkedin-queue/${sequenceId}`);
        if (res.ok && !cancelled) {
          const data = await res.json();
          setLinkedInActions(data.actions || []);
        }
      } catch {
        // Silently ignore polling errors
      }
    }

    fetchActions();
    const interval = setInterval(fetchActions, 30000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [sequenceId]);

  const roleSummary = buildRoleSummary(roleContext);
  const hasRoleContent = roleSummary.length > 0;

  const completedCount = linkedInActions.filter((a) => a.status === "completed").length;
  const totalCount = linkedInActions.length;
  const allCompleted = totalCount > 0 && completedCount === totalCount;
  const queuedCount = linkedInActions.filter((a) => a.status === "queued").length;

  return (
    <div className="rounded-xl border border-border bg-surface p-4 space-y-3">
      {/* 1. Badges row */}
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center rounded-full bg-gold-bg px-2.5 py-0.5 text-[11px] font-medium text-gold border border-gold-border">
          {channel.charAt(0).toUpperCase() + channel.slice(1)}
        </span>
        <span className="inline-flex items-center rounded-full bg-surface-secondary px-2.5 py-0.5 text-[11px] font-medium text-text-secondary border border-border">
          {tone.replace(/_/g, " ")}
        </span>
      </div>

      {/* 2. Strategy */}
      {strategy && (
        <p className="text-xs text-text-secondary italic leading-relaxed">
          {strategy}
        </p>
      )}

      {/* 3. Role summary */}
      {hasRoleContent && (
        <p className="text-xs text-text-muted">{roleSummary}</p>
      )}

      {/* 4. LinkedIn action progress */}
      {linkedInActions.length > 0 && (
        <div className="flex items-center gap-0">
          {linkedInActions.map((action, idx) => {
            const Icon = ACTION_ICONS[action.action_type] || Circle;
            const isCompleted = action.status === "completed";
            const isExecuting = action.status === "executing";
            const isFailed = action.status === "failed";

            const statusColor = isCompleted
              ? "text-success"
              : isExecuting
                ? "text-gold"
                : isFailed
                  ? "text-danger"
                  : "text-text-muted";

            return (
              <div key={action.id} className="flex items-center">
                {idx > 0 && <div className="w-4 h-px bg-border" />}
                <div className="flex flex-col items-center gap-0.5">
                  <div className={`flex items-center gap-1 ${statusColor}`}>
                    <Icon className="h-3.5 w-3.5" />
                    {isCompleted && <CheckCircle2 className="h-3 w-3" />}
                    {isExecuting && <Loader2 className="h-3 w-3 animate-spin" />}
                    {isFailed && <XCircle className="h-3 w-3" />}
                    {!isCompleted && !isExecuting && !isFailed && (
                      <Circle className="h-3 w-3" />
                    )}
                  </div>
                  {isCompleted && action.executed_at && (
                    <span className="text-[9px] text-text-dim">
                      {formatTime(action.executed_at)}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 5. Status summary line */}
      <p className="text-xs">
        {linkedInActions.length > 0 ? (
          allCompleted ? (
            <span className="text-success">
              All {totalCount} actions completed
            </span>
          ) : completedCount > 0 ? (
            <span className="text-text-secondary">
              {completedCount} of {totalCount} actions completed
            </span>
          ) : (
            <span className="text-gold">
              {queuedCount} actions queued
            </span>
          )
        ) : !sequenceId ? (
          <span className="text-text-muted">
            Generate a sequence to get started
          </span>
        ) : (
          <span className="text-text-muted">
            Click &lsquo;Start LinkedIn Sequence&rsquo; to begin automation
          </span>
        )}
      </p>
    </div>
  );
}
