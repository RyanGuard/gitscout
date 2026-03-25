"use client";

import { DeveloperCard } from "@/components/profile/DeveloperCard";
import type { SearchResult } from "@/types";

interface SearchResultsProps {
  results: SearchResult | null;
  loading: boolean;
  onPageChange: (page: number) => void;
}

export function SearchResults({ results, loading, onPageChange }: SearchResultsProps) {
  if (loading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="animate-pulse rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-700 dark:bg-neutral-900"
          >
            <div className="flex items-start gap-4">
              <div className="h-14 w-14 rounded-full bg-neutral-200 dark:bg-neutral-700" />
              <div className="flex-1 space-y-2">
                <div className="h-5 w-40 rounded bg-neutral-200 dark:bg-neutral-700" />
                <div className="h-4 w-24 rounded bg-neutral-200 dark:bg-neutral-700" />
                <div className="h-4 w-full rounded bg-neutral-200 dark:bg-neutral-700" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!results) return null;

  if (results.developers.length === 0) {
    return (
      <div className="py-16 text-center">
        <p className="text-lg font-medium text-neutral-600 dark:text-neutral-400">
          No developers found
        </p>
        <p className="mt-1 text-sm text-neutral-500">
          Try adjusting your search query or filters
        </p>
      </div>
    );
  }

  return (
    <div>
      <p className="mb-4 text-sm text-neutral-500">
        {results.total} developer{results.total !== 1 ? "s" : ""} found
      </p>

      <div className="space-y-3">
        {results.developers.map((dev) => (
          <DeveloperCard key={dev.id} developer={dev} />
        ))}
      </div>

      {results.totalPages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-2">
          <button
            onClick={() => onPageChange(results.page - 1)}
            disabled={results.page <= 1}
            className="rounded-lg border border-neutral-200 px-3 py-1.5 text-sm disabled:opacity-40 dark:border-neutral-700"
          >
            Previous
          </button>
          <span className="text-sm text-neutral-500">
            Page {results.page} of {results.totalPages}
          </span>
          <button
            onClick={() => onPageChange(results.page + 1)}
            disabled={results.page >= results.totalPages}
            className="rounded-lg border border-neutral-200 px-3 py-1.5 text-sm disabled:opacity-40 dark:border-neutral-700"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
