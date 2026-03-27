"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { Loader2, Check, AlertCircle, Clock, Send } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { timeAgo } from "@/lib/utils";

interface PushRecord {
  id: string;
  developerId: string;
  status: string;
  errorMessage: string | null;
  pushedAt: string | null;
  createdAt: string;
  developer: {
    username: string;
    name: string | null;
    avatarUrl: string | null;
  };
}

export function AshbyPushHistory() {
  const { data: session } = useSession();
  const [pushes, setPushes] = useState<PushRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const loadPushes = useCallback(async () => {
    if (!session?.user?.id) return;
    try {
      const res = await fetch("/api/ashby/pushes");
      const data = await res.json();
      setPushes(data.pushes || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [session?.user?.id]);

  useEffect(() => {
    loadPushes();
  }, [loadPushes]);

  if (!session) return null;

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-8 text-sm text-neutral-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading push history...
      </div>
    );
  }

  if (pushes.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-neutral-500">
        <Send className="mx-auto mb-2 h-8 w-8 text-neutral-300 dark:text-neutral-600" />
        No pushes yet. Push a developer from their profile page.
      </div>
    );
  }

  return (
    <div className="divide-y divide-neutral-200 dark:divide-neutral-700">
      {pushes.map((push) => (
        <div
          key={push.id}
          className="flex items-center gap-3 py-3"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={
              push.developer.avatarUrl ||
              `https://github.com/${push.developer.username}.png`
            }
            alt={push.developer.username}
            className="h-8 w-8 rounded-full"
          />
          <div className="min-w-0 flex-1">
            <Link
              href={`/profile/${push.developer.username}`}
              className="text-sm font-medium text-neutral-900 hover:text-gold dark:text-white dark:hover:text-gold"
            >
              {push.developer.name || push.developer.username}
            </Link>
            <p className="text-xs text-neutral-500">
              @{push.developer.username}
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <StatusBadge status={push.status} error={push.errorMessage} />
            <span className="text-xs text-neutral-400">
              {timeAgo(push.pushedAt || push.createdAt)}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

function StatusBadge({
  status,
  error,
}: {
  status: string;
  error: string | null;
}) {
  switch (status) {
    case "pushed":
    case "applied":
      return (
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
            "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
          )}
        >
          <Check className="h-3 w-3" />
          {status === "applied" ? "Applied" : "Pushed"}
        </span>
      );
    case "error":
      return (
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
            "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
          )}
          title={error || "Unknown error"}
        >
          <AlertCircle className="h-3 w-3" />
          Error
        </span>
      );
    default:
      return (
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
            "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
          )}
        >
          <Clock className="h-3 w-3" />
          Pending
        </span>
      );
  }
}
