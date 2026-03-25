"use client";

import { SearchX, Lightbulb } from "lucide-react";
import { DeveloperCard } from "@/components/profile/DeveloperCard";
import { AnimatedResultsList } from "@/components/ui/AnimatedResultsList";
import { SearchRadar } from "@/components/ui/SearchRadar";
import { SearchLoadingMessages } from "@/components/ui/SearchLoadingMessages";
import type { SearchResult } from "@/types";

interface SearchResultsProps {
  results: SearchResult | null;
  loading: boolean;
  onPageChange: (page: number) => void;
}

export function SearchResults({ results, loading, onPageChange }: SearchResultsProps) {
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <SearchRadar isSearching={true} resultsFound={0} />
        <SearchLoadingMessages isSearching={true} />
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
      <AnimatedResultsList searchKey={results.query + results.page}>
        {results.developers.map((dev) => (
          <DeveloperCard key={dev.id} developer={dev} />
        ))}
      </AnimatedResultsList>

      {results.totalPages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-2">
          <button
            onClick={() => onPageChange(results.page - 1)}
            disabled={results.page <= 1}
            className="rounded-lg border border-neutral-200 px-3 py-1.5 text-sm transition-colors hover:bg-neutral-50 disabled:opacity-40 dark:border-neutral-700 dark:hover:bg-neutral-800"
          >
            Previous
          </button>
          <span className="text-sm text-neutral-500">
            Page {results.page} of {results.totalPages}
          </span>
          <button
            onClick={() => onPageChange(results.page + 1)}
            disabled={results.page >= results.totalPages}
            className="rounded-lg border border-neutral-200 px-3 py-1.5 text-sm transition-colors hover:bg-neutral-50 disabled:opacity-40 dark:border-neutral-700 dark:hover:bg-neutral-800"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
