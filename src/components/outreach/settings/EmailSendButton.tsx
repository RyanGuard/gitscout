"use client";

import { useState } from "react";
import { Loader2, CheckCircle2, Mail, AlertCircle } from "lucide-react";

// ─── Props ───

interface EmailSendButtonProps {
  sequenceId: string;
  candidateName: string;
  candidateEmail: string | undefined;
}

// ─── Component ───

export function EmailSendButton({ sequenceId, candidateName, candidateEmail }: EmailSendButtonProps) {
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!candidateEmail) {
    return null;
  }

  async function handleSend() {
    setSending(true);
    setError(null);

    try {
      const res = await fetch("/api/outreach/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sequenceId }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: `Server error (${res.status})` }));
        setError(data.error || "Failed to send email");
        return;
      }

      setSent(true);
    } catch {
      setError("Network error — check your connection and try again");
    } finally {
      setSending(false);
    }
  }

  if (sent) {
    return (
      <div className="mb-5 rounded-lg border border-success/30 bg-success-bg px-3 py-2.5 flex items-center gap-2">
        <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
        <span className="text-xs font-medium text-success">
          Email sent to {candidateName}
        </span>
      </div>
    );
  }

  return (
    <div className="mb-5">
      <button
        onClick={handleSend}
        disabled={sending}
        className="w-full rounded-lg bg-gold px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-gold-hover disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {sending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Sending...
          </>
        ) : (
          <>
            <Mail className="h-4 w-4" />
            Send Email Sequence
          </>
        )}
      </button>
      <p className="mt-1.5 text-[10px] text-text-dim">
        Sends the first email step to {candidateEmail}
      </p>

      {error && (
        <div className="mt-2 rounded-lg border border-danger/30 bg-danger-bg px-3 py-2 text-xs text-danger flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <AlertCircle className="h-3 w-3 shrink-0" />
            {error}
          </span>
          <button
            onClick={handleSend}
            className="ml-2 shrink-0 text-[10px] font-semibold text-danger underline hover:no-underline"
          >
            Retry
          </button>
        </div>
      )}
    </div>
  );
}
