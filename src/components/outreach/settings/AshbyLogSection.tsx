"use client";

import { useEffect, useState } from "react";
import { Building2, Loader2, CheckCircle2 } from "lucide-react";

// ─── Props ───

interface AshbyLogSectionProps {
  sequenceId: string;
  candidateName: string;
}

// ─── Component ───

export function AshbyLogSection({ sequenceId, candidateName }: AshbyLogSectionProps) {
  const [connected, setConnected] = useState<boolean | null>(null);
  const [logging, setLogging] = useState(false);
  const [logged, setLogged] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check Ashby connection on mount
  useEffect(() => {
    let cancelled = false;
    async function check() {
      try {
        const res = await fetch("/api/ashby/connect");
        if (res.ok) {
          const data = await res.json();
          if (!cancelled) setConnected(!!data.connected);
        } else {
          if (!cancelled) setConnected(false);
        }
      } catch {
        if (!cancelled) setConnected(false);
      }
    }
    check();
    return () => { cancelled = true; };
  }, []);

  async function handleLog() {
    setLogging(true);
    setError(null);

    try {
      const res = await fetch("/api/outreach/ashby-log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sequenceId }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: `Server error (${res.status})` }));
        setError(data.error || "Failed to log to Ashby");
        return;
      }

      setLogged(true);
    } catch {
      setError("Network error — check your connection and try again");
    } finally {
      setLogging(false);
    }
  }

  // Still loading connection status
  if (connected === null) return null;

  // Not connected — show link to settings
  if (!connected) {
    return (
      <div className="mb-5">
        <div className="rounded-lg border border-border bg-surface px-3 py-2.5">
          <p className="text-xs text-text-muted">
            <a href="/settings" className="font-medium text-gold hover:text-gold-hover underline">
              Connect Ashby
            </a>{" "}
            to log outreach sequences to your ATS.
          </p>
        </div>
      </div>
    );
  }

  // Already logged
  if (logged) {
    return (
      <div className="mb-5 rounded-lg border border-success/30 bg-success-bg px-3 py-2.5 flex items-center gap-2">
        <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
        <span className="text-xs font-medium text-success">
          Logged to Ashby for {candidateName}
        </span>
      </div>
    );
  }

  return (
    <div className="mb-5">
      <button
        onClick={handleLog}
        disabled={logging}
        className="w-full rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-text-secondary transition-colors hover:bg-surface disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {logging ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Logging...
          </>
        ) : (
          <>
            <Building2 className="h-4 w-4" />
            Log to Ashby
          </>
        )}
      </button>
      {error && (
        <div className="mt-2 rounded-lg border border-danger/30 bg-danger-bg px-3 py-2 text-xs text-danger">
          {error}
        </div>
      )}
    </div>
  );
}
