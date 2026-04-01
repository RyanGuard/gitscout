"use client";

import { useState } from "react";
import { Loader2, CheckCircle2, Play } from "lucide-react";

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

  async function handleQueue() {
    setQueuing(true);
    setError(null);

    try {
      const res = await fetch("/api/outreach/linkedin-queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sequenceId, viewFirst, likePost }),
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
      <button
        onClick={handleQueue}
        disabled={queuing}
        className="w-full rounded-lg bg-gold px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-gold-hover disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {queuing ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Queuing...
          </>
        ) : (
          <>
            <Play className="h-4 w-4" />
            Start LinkedIn Sequence
          </>
        )}
      </button>
      {error && (
        <div className="mt-2 rounded-lg border border-danger/30 bg-danger-bg px-3 py-2 text-xs text-danger flex items-center justify-between">
          <span>{error}</span>
          <button
            onClick={handleQueue}
            className="ml-2 shrink-0 text-[10px] font-semibold text-danger underline hover:no-underline"
          >
            Retry
          </button>
        </div>
      )}
    </div>
  );
}
