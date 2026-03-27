"use client";

import { useSession } from "next-auth/react";
import { Send, Check, Loader2, AlertCircle, X, Briefcase } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import type { AshbyJob } from "@/types";

interface PushToAshbyButtonProps {
  developerId: string;
  className?: string;
}

export function PushToAshbyButton({
  developerId,
  className,
}: PushToAshbyButtonProps) {
  const { data: session } = useSession();
  const [connected, setConnected] = useState(false);
  const [pushed, setPushed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showJobPicker, setShowJobPicker] = useState(false);
  const [jobs, setJobs] = useState<AshbyJob[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(false);

  const checkConnection = useCallback(async () => {
    if (!session?.user?.id) return;
    try {
      const res = await fetch("/api/ashby/connect");
      const data = await res.json();
      setConnected(data.connected);
    } catch {
      // ignore
    }
  }, [session?.user?.id]);

  const checkPushStatus = useCallback(async () => {
    if (!session?.user?.id) return;
    try {
      const res = await fetch("/api/ashby/pushes");
      const data = await res.json();
      const alreadyPushed = (data.pushes || []).some(
        (p: { developerId: string; status: string }) =>
          p.developerId === developerId &&
          (p.status === "pushed" || p.status === "applied")
      );
      setPushed(alreadyPushed);
    } catch {
      // ignore
    }
  }, [session?.user?.id, developerId]);

  useEffect(() => {
    checkConnection();
    checkPushStatus();
  }, [checkConnection, checkPushStatus]);

  if (!session || !connected) return null;

  async function loadJobs() {
    setLoadingJobs(true);
    try {
      const res = await fetch("/api/ashby/jobs");
      const data = await res.json();
      setJobs(data.jobs || []);
    } catch {
      setJobs([]);
    } finally {
      setLoadingJobs(false);
    }
  }

  async function handlePush(jobId?: string) {
    setLoading(true);
    setError(null);
    setShowJobPicker(false);
    try {
      const res = await fetch("/api/ashby/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ developerId, jobId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Push failed");
        return;
      }
      setPushed(true);
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  function openJobPicker() {
    setShowJobPicker(true);
    loadJobs();
  }

  if (pushed) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm font-medium text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-400",
          className
        )}
      >
        <Check className="h-4 w-4" />
        Pushed to Ashby
      </span>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={openJobPicker}
        disabled={loading}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-lg border border-gold-border bg-gold-bg px-3 py-2 text-sm font-medium text-gold-muted transition-colors hover:bg-gold-bg dark:border-gold-border dark:bg-gold-bg dark:text-gold dark:hover:bg-gold-bg",
          className
        )}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Send className="h-4 w-4" />
        )}
        Push to Ashby
      </button>

      {error && (
        <div className="absolute left-0 top-full z-10 mt-1 flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-600 dark:border-red-800 dark:bg-red-950 dark:text-red-400">
          <AlertCircle className="h-3 w-3 shrink-0" />
          {error}
        </div>
      )}

      {showJobPicker && (
        <div className="absolute left-0 top-full z-20 mt-2 w-80 rounded-lg border border-neutral-200 bg-white shadow-lg dark:border-neutral-700 dark:bg-neutral-900">
          <div className="flex items-center justify-between border-b border-neutral-200 px-3 py-2 dark:border-neutral-700">
            <span className="text-sm font-medium text-neutral-900 dark:text-white">
              Select a job (optional)
            </span>
            <button
              onClick={() => setShowJobPicker(false)}
              className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="max-h-60 overflow-y-auto p-1">
            <button
              onClick={() => handlePush()}
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
            >
              <Send className="h-4 w-4 shrink-0 text-neutral-400" />
              Push without a job
            </button>
            {loadingJobs ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-4 w-4 animate-spin text-neutral-400" />
              </div>
            ) : (
              jobs.map((job) => (
                <button
                  key={job.id}
                  onClick={() => handlePush(job.id)}
                  className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
                >
                  <Briefcase className="h-4 w-4 shrink-0 text-gold" />
                  <span className="truncate">{job.title}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
