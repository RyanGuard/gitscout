"use client";

import { Loader2, Sparkles, TrendingUp } from "lucide-react";
import type { SuggestionsData } from "./types";

// ─── Props ───

interface SuggestionsSectionProps {
  suggestions: SuggestionsData | null;
  loadingSuggestions: boolean;
  onGetSuggestions: () => void;
  onApplySuggestions: () => void;
  showForCandidate: boolean;
}

// ─── Component ───

export function SuggestionsSection({
  suggestions,
  loadingSuggestions,
  onGetSuggestions,
  onApplySuggestions,
  showForCandidate,
}: SuggestionsSectionProps) {
  if (!showForCandidate) return null;

  return (
    <div className="mb-5">
      <h3 className="text-[10px] font-semibold uppercase tracking-wide text-text-muted mb-3">Suggested approach</h3>
      {suggestions ? (
        <div className="rounded-xl border border-border bg-surface p-3">
          <ul className="space-y-1.5">
            {suggestions.suggestions?.map((s, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-text-secondary">
                <TrendingUp className="h-3 w-3 text-gold shrink-0 mt-0.5" />
                {s}
              </li>
            ))}
          </ul>
          <button
            onClick={onApplySuggestions}
            className="mt-3 w-full rounded-lg bg-gold-bg border border-gold-border px-3 py-1.5 text-xs font-medium text-gold hover:bg-gold-bg-strong transition-colors"
          >
            Apply suggestions
          </button>
        </div>
      ) : (
        <button
          onClick={onGetSuggestions}
          disabled={loadingSuggestions}
          className="w-full rounded-lg border border-dashed border-border px-3 py-2.5 text-xs font-medium text-text-muted hover:border-gold hover:text-gold transition-colors flex items-center justify-center gap-1.5"
        >
          {loadingSuggestions ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Sparkles className="h-3 w-3" />
          )}
          Get AI suggestions
        </button>
      )}
    </div>
  );
}
