"use client";

import { useState, useEffect } from "react";
import { Send, X, Loader2, Check, ChevronDown } from "lucide-react";
import type { DeveloperProfile } from "@/types";

interface Sequence {
  id: string;
  name: string;
  status: string;
}

interface BulkOutreachBarProps {
  selectedDevelopers: DeveloperProfile[];
  onClear: () => void;
}

/**
 * Floating action bar shown when developers are selected in search results.
 * Lets the user enrich all selected developers via Apollo, then either:
 * - Create a new outreach sequence with them
 * - Add them to an existing sequence
 */
export function BulkOutreachBar({ selectedDevelopers, onClear }: BulkOutreachBarProps) {
  const [sequences, setSequences] = useState<Sequence[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const [status, setStatus] = useState<"idle" | "enriching" | "done" | "error">("idle");
  const [enrichedCount, setEnrichedCount] = useState(0);

  // Fetch existing sequences
  useEffect(() => {
    fetch("/api/outreach/sequences")
      .then((r) => r.ok ? r.json() : [])
      .then((data) => setSequences(Array.isArray(data) ? data : data.sequences || []))
      .catch(() => {});
  }, []);

  async function enrichAndDraft(sequenceId?: string) {
    setStatus("enriching");
    setEnrichedCount(0);

    const enriched: Array<{
      name: string; title?: string; company?: string; location?: string;
      linkedinUrl?: string; email?: string; githubUrl?: string;
    }> = [];

    // Enrich each developer in parallel (max 3 concurrent)
    const queue = [...selectedDevelopers];
    const concurrency = 3;

    async function processOne(dev: DeveloperProfile) {
      // Index
      await fetch("/api/index", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: dev.username }),
      }).catch(() => {});

      // Enrich
      let linkedinUrl = "";
      let title = "";
      let company = dev.company?.replace(/^@/, "") || "";

      try {
        const res = await fetch(`/api/enrich/${dev.id || dev.username}`, { method: "POST" });
        if (res.ok) {
          const data = await res.json();
          linkedinUrl = data.linkedinUrl || data.contactInfo?.linkedinUrl || "";
          title = data.currentTitle || data.contactInfo?.currentTitle || "";
          company = data.normalizedCompany || data.contactInfo?.normalizedCompany || company;
        }
      } catch {
        // enrichment failure is non-fatal
      }

      enriched.push({
        name: dev.name || dev.username,
        title: title || undefined,
        company: company || undefined,
        location: dev.location || undefined,
        linkedinUrl: linkedinUrl || undefined,
        email: dev.email || undefined,
        githubUrl: `https://github.com/${dev.username}`,
      });

      setEnrichedCount((c) => c + 1);
    }

    // Process in batches
    for (let i = 0; i < queue.length; i += concurrency) {
      const batch = queue.slice(i, i + concurrency);
      await Promise.all(batch.map(processOne));
    }

    // Navigate to outreach with enriched candidates
    const params = new URLSearchParams();
    params.set("bulk", JSON.stringify(enriched));
    if (sequenceId) params.set("sequenceId", sequenceId);
    params.set("source", "search_bulk");

    setStatus("done");
    setTimeout(() => {
      window.location.href = `/outreach/new?${params.toString()}`;
    }, 500);
  }

  if (selectedDevelopers.length === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-xl border border-neutral-200/50 bg-white/95 px-5 py-3 shadow-2xl backdrop-blur-sm dark:border-neutral-700/50 dark:bg-neutral-900/95">
      <span className="text-sm font-semibold text-neutral-900 dark:text-white">
        {selectedDevelopers.length} selected
      </span>

      <div className="h-5 w-px bg-neutral-200 dark:bg-neutral-700" />

      {status === "enriching" ? (
        <div className="flex items-center gap-2 text-sm text-neutral-500">
          <Loader2 className="h-4 w-4 animate-spin text-gold" />
          Enriching {enrichedCount}/{selectedDevelopers.length}...
        </div>
      ) : status === "done" ? (
        <div className="flex items-center gap-2 text-sm text-emerald-600">
          <Check className="h-4 w-4" />
          Opening Outreach Studio...
        </div>
      ) : (
        <>
          {/* New sequence */}
          <button
            onClick={() => enrichAndDraft()}
            className="flex items-center gap-1.5 rounded-lg bg-gold px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-gold-hover"
          >
            <Send className="h-3.5 w-3.5" />
            New Sequence
          </button>

          {/* Add to existing */}
          {sequences.length > 0 && (
            <div className="relative">
              <button
                onClick={() => setShowPicker(!showPicker)}
                className="flex items-center gap-1.5 rounded-lg border border-neutral-200/50 px-3 py-1.5 text-xs font-medium text-neutral-600 transition-colors hover:bg-neutral-50 dark:border-neutral-700/50 dark:text-neutral-400 dark:hover:bg-neutral-800"
              >
                Add to Existing
                <ChevronDown className="h-3 w-3" />
              </button>

              {showPicker && (
                <div className="absolute bottom-full left-0 mb-2 w-64 rounded-lg border border-neutral-200/50 bg-white shadow-xl dark:border-neutral-700/50 dark:bg-neutral-900">
                  <div className="p-2 border-b border-neutral-100 dark:border-neutral-800">
                    <p className="text-[10px] font-medium uppercase tracking-wide text-neutral-400 px-2">Your Sequences</p>
                  </div>
                  <div className="max-h-48 overflow-y-auto p-1">
                    {sequences.map((seq) => (
                      <button
                        key={seq.id}
                        onClick={() => { setShowPicker(false); enrichAndDraft(seq.id); }}
                        className="w-full rounded-md px-3 py-2 text-left text-sm text-neutral-700 hover:bg-gold-bg hover:text-gold dark:text-neutral-300 dark:hover:text-gold transition-colors"
                      >
                        {seq.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      <button
        onClick={onClear}
        className="text-neutral-400 hover:text-neutral-600 transition-colors"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
