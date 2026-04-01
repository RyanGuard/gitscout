"use client";

import { useState } from "react";
import { Loader2, CheckCircle2, Play, Clock } from "lucide-react";

// ─── Props ───

interface LinkedInQueueButtonProps {
  sequenceId: string;
  candidateName: string;
  viewFirst?: boolean;
  likePost?: boolean;
}

// ─── Component ───

export function LinkedInQueueButton({ sequenceId, candidateName, viewFirst = true, likePost = false }: LinkedInQueueButtonProps) {
  const [queuing, setQueuing] = useState(false);
  const [queued, setQueued] = useState(false);
  const [queuedCount, setQueuedCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [showSchedule, setShowSchedule] = useState(false);
  const [scheduledFor, setScheduledFor] = useState("");

  async function handleQueue(scheduleTime?: string) {
    setQueuing(true);
    setError(null);

    try {
      const payload: Record<string, unknown> = { sequenceId, viewFirst, likePost };
      if (scheduleTime) {
        payload.scheduledFor = scheduleTime;
      }

      const res = await fetch("/api/outreach/linkedin-queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: `Server error (${res.status})` }));
        setError(data.error || "Failed to queue LinkedIn actions");
        return;
      }

      const data = await res.json();
      setQueuedCount(data.queued || 0);
      setQueued(true);
    } catch {
      setError("Network error — check your connection and try again");
    } finally {
      setQueuing(false);
      setShowSchedule(false);
    }
  }

  if (queued) {
    return (
      <div className="mb-5 rounded-lg border border-success/30 bg-success-bg px-3 py-2.5 flex items-center gap-2">
        <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
        <span className="text-xs font-medium text-success">
          {queuedCount} LinkedIn action{queuedCount !== 1 ? "s" : ""} queued
        </span>
      </div>
    );
  }

  return (
    <div className="mb-5">
      <div className="flex gap-2">
        <button
          onClick={() => handleQueue()}
          disabled={queuing}
          className="flex-1 rounded-lg bg-gold px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-gold-hover disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {queuing && !showSchedule ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Queuing...
            </>
          ) : (
            <>
              <Play className="h-4 w-4" />
              Start Now
            </>
          )}
        </button>
        <button
          onClick={() => setShowSchedule(!showSchedule)}
          disabled={queuing}
          className="rounded-lg border border-border px-3 py-2.5 text-sm font-medium text-text-secondary transition-colors hover:bg-surface disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
        >
          <Clock className="h-4 w-4" />
          Schedule
        </button>
      </div>

      {showSchedule && (
        <div className="mt-2 rounded-lg border border-border bg-surface p-3 space-y-2">
          <label className="block text-[10px] font-semibold uppercase tracking-wide text-text-muted">
            Schedule for
          </label>
          <input
            type="datetime-local"
            value={scheduledFor}
            onChange={(e) => setScheduledFor(e.target.value)}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-xs outline-none focus:border-gold"
          />
          <button
            onClick={() => {
              if (scheduledFor) {
                handleQueue(new Date(scheduledFor).toISOString());
              }
            }}
            disabled={queuing || !scheduledFor}
            className="w-full rounded-lg bg-gold px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-gold-hover disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
          >
            {queuing ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" />
                Scheduling...
              </>
            ) : (
              <>
                <Clock className="h-3 w-3" />
                Queue for scheduled time
              </>
            )}
          </button>
        </div>
      )}

      {error && (
        <div className="mt-2 rounded-lg border border-danger/30 bg-danger-bg px-3 py-2 text-xs text-danger flex items-center justify-between">
          <span>{error}</span>
          <button
            onClick={() => handleQueue()}
            className="ml-2 shrink-0 text-[10px] font-semibold text-danger underline hover:no-underline"
          >
            Retry
          </button>
        </div>
      )}
    </div>
  );
}
