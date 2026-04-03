"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { Send, Check, Loader2 } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { showSuccess, showError } from "@/lib/toast";

interface SequenceItem {
  id: string;
  name: string;
  status: string;
  totalEnrolled: number;
}

interface AddToSequenceButtonProps {
  developerId: string;
  sourceType?: "developer" | "map_candidate" | "candidate_entry";
  className?: string;
}

export function AddToSequenceButton({ developerId, sourceType = "developer", className }: AddToSequenceButtonProps) {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const [sequences, setSequences] = useState<SequenceItem[]>([]);
  const [addedTo, setAddedTo] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [enrolling, setEnrolling] = useState<string | null>(null);

  const fetchSequences = useCallback(async () => {
    if (!session?.user?.id) return;
    setLoading(true);
    try {
      const res = await fetch("/api/sequences");
      const data = await res.json();
      setSequences(
        (data.sequences || []).filter(
          (s: SequenceItem) => s.status === "draft" || s.status === "active"
        )
      );
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [session?.user?.id]);

  useEffect(() => {
    if (open) fetchSequences();
  }, [open, fetchSequences]);

  if (!session) return null;

  async function enrollInSequence(sequenceId: string) {
    setEnrolling(sequenceId);
    try {
      const res = await fetch(`/api/sequences/${sequenceId}/enroll`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          candidates: [{ type: sourceType, id: developerId }],
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.enrolled > 0) {
          setAddedTo((prev) => new Set(prev).add(sequenceId));
          showSuccess("Enrolled in sequence");
        }
      }
    } catch {
      showError("Failed to enroll");
    } finally {
      setEnrolling(null);
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 px-3 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800",
          className
        )}
      >
        <Send className="h-4 w-4" />
        Add to Sequence
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-20 mt-2 w-64 rounded-lg border border-neutral-200 bg-white shadow-lg dark:border-neutral-700 dark:bg-neutral-900">
            <div className="p-2">
              <p className="px-2 py-1 text-xs font-medium text-neutral-500">Your Sequences</p>
              {loading && (
                <div className="flex justify-center py-3">
                  <Loader2 className="h-4 w-4 animate-spin text-neutral-400" />
                </div>
              )}
              {!loading && sequences.length === 0 && (
                <p className="px-2 py-2 text-xs text-neutral-400">
                  No sequences yet.{" "}
                  <Link href="/outreach/new" className="text-gold hover:underline">
                    Create one
                  </Link>
                </p>
              )}
              {!loading &&
                sequences.map((seq) => {
                  const added = addedTo.has(seq.id);
                  const isEnrolling = enrolling === seq.id;
                  return (
                    <button
                      key={seq.id}
                      type="button"
                      onClick={() => !added && !isEnrolling && enrollInSequence(seq.id)}
                      disabled={added || isEnrolling}
                      className={cn(
                        "flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm transition-colors",
                        added
                          ? "text-green-600 dark:text-green-400"
                          : "text-neutral-700 hover:bg-neutral-50 dark:text-neutral-300 dark:hover:bg-neutral-800"
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <span className="truncate block">{seq.name}</span>
                        <span className="text-[10px] text-neutral-400">
                          {seq.status} · {seq.totalEnrolled} enrolled
                        </span>
                      </div>
                      {isEnrolling ? (
                        <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-gold" />
                      ) : added ? (
                        <Check className="h-3.5 w-3.5 shrink-0" />
                      ) : null}
                    </button>
                  );
                })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
