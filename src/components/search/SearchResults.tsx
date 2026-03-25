"use client";

import { SearchX, Lightbulb } from "lucide-react";
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
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="animate-pulse rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-700 dark:bg-neutral-900"
            style={{ animationDelay: `${i * 75}ms` }}
          >
            <div className="flex items-start gap-4">
              <div className="h-14 w-14 shrink-0 rounded-full bg-neutral-200 dark:bg-neutral-700" />
              <div className="min-w-0 flex-1 space-y-2.5">
                <div className="h-5 w-40 rounded bg-neutral-200 dark:bg-neutral-700" />
                <div className="h-3.5 w-24 rounded bg-neutral-200 dark:bg-neutral-700" />
                <div className="h-3.5 w-full max-w-xs rounded bg-neutral-200 dark:bg-neutral-700" />
                <div className="flex gap-3 pt-1">
                  <div className="h-3.5 w-20 rounded bg-neutral-200 dark:bg-neutral-700" />
                  <div className="h-3.5 w-16 rounded bg-neutral-200 dark:bg-neutral-700" />
                  <div className="h-3.5 w-16 rounded bg-neutral-200 dark:bg-neutral-700" />
                </div>
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
        <SearchX className="mx-auto h-12 w-12 text-neutral-300 dark:text-neutral-600" />
        <p className="mt-4 text-lg font-medium text-neutral-600 dark:text-neutral-400">
          No developers found
        </p>
        <p className="mt-1 text-sm text-neutral-500">
          Try adjusting your search query or filters.
        </p>
        <div className="mx-auto mt-6 max-w-sm rounded-lg border border-neutral-200 bg-neutral-50 p-4 text-left dark:border-neutral-700 dark:bg-neutral-900">
          <div className="flex items-center gap-2 text-sm font-medium text-neutral-700 dark:text-neutral-300">
            <Lightbulb className="h-4 w-4 text-yellow-500" />
            Search tips
          </div>
          <ul className="mt-2 space-y-1 text-xs text-neutral-500">
            <li>Try broader terms like &quot;python&quot; or &quot;frontend&quot;</li>
            <li>Search by location: &quot;San Francisco&quot;</li>
            <li>Remove filters to widen results</li>
          </ul>
        </div>
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
            className="rounded-lg border border-neutral-200 px-3 py-1.5 text-sm transition-colors hover:bg-neutral-50 disabled:opacity-40 disabled:hover:bg-transparent dark:border-neutral-700 dark:hover:bg-neutral-800"
          >
            Previous
          </button>
          <span className="text-sm text-neutral-500">
            Page {results.page} of {results.totalPages}
          </span>
          <button
            onClick={() => onPageChange(results.page + 1)}
            disabled={results.page >= results.totalPages}
            className="rounded-lg border border-neutral-200 px-3 py-1.5 text-sm transition-colors hover:bg-neutral-50 disabled:opacity-40 disabled:hover:bg-transparent dark:border-neutral-700 dark:hover:bg-neutral-800"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
