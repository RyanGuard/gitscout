"use client";

import { useRouter } from "next/navigation";
import { SearchX, Lightbulb, ArrowRight } from "lucide-react";
import { DeveloperCard } from "@/components/profile/DeveloperCard";
import { AnimatedResultsList } from "@/components/ui/AnimatedResultsList";
import { SearchRadar } from "@/components/ui/SearchRadar";
import { SearchLoadingMessages } from "@/components/ui/SearchLoadingMessages";
import type { SearchResult } from "@/types";

// Generate alternative search suggestions based on the failed query
function getAlternatives(query: string): string[] {
  const q = query.toLowerCase().trim();
  const alternatives: string[] = [];

  // Broader version: strip location-like words
  const locationWords = ["in", "at", "from", "near"];
  const parts = q.split(/\s+/);
  const locationIdx = parts.findIndex((p) => locationWords.includes(p));
  if (locationIdx > 0) {
    alternatives.push(parts.slice(0, locationIdx).join(" "));
  }

  // Related technology mapping
  const techMap: Record<string, string> = {
    react: "frontend TypeScript",
    vue: "frontend JavaScript",
    angular: "frontend TypeScript",
    python: "Python ML",
    rust: "systems programming",
    go: "Go backend",
    java: "backend Java",
    kubernetes: "devops infrastructure",
    terraform: "cloud infrastructure",
    swift: "iOS mobile",
    kotlin: "Android mobile",
    node: "backend JavaScript",
    rails: "Ruby web",
    django: "Python web",
    ml: "machine learning Python",
    ai: "machine learning",
    devops: "infrastructure SRE",
    frontend: "React TypeScript",
    backend: "Go Python",
    fullstack: "TypeScript React Node",
  };

  for (const [key, suggestion] of Object.entries(techMap)) {
    if (q.includes(key) && !q.includes(suggestion.split(" ")[0].toLowerCase())) {
      alternatives.push(suggestion);
      break;
    }
  }

  // If we still need more, add a generic broader suggestion
  if (alternatives.length < 2 && parts.length > 1) {
    alternatives.push(parts[0]);
  }

  // Ensure we have at least one fallback
  if (alternatives.length === 0) {
    alternatives.push("frontend React", "Python backend", "Go infrastructure");
  }

  return alternatives.slice(0, 3);
}

interface SearchResultsProps {
  results: SearchResult | null;
  loading: boolean;
  onPageChange: (page: number) => void;
}

export function SearchResults({ results, loading, onPageChange }: SearchResultsProps) {
  const router = useRouter();

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
    const alternatives = getAlternatives(results.query);

    return (
      <div className="py-12 text-center">
        <SearchX className="mx-auto h-12 w-12 text-neutral-300 dark:text-neutral-600" />
        <p className="mt-4 text-lg font-medium text-neutral-600 dark:text-neutral-400">
          No developers found for &ldquo;{results.query}&rdquo;
        </p>
        <p className="mx-auto mt-2 max-w-md text-sm text-neutral-500">
          This usually means the search is too specific. Try broader terms or a different combination.
        </p>

        <div className="mx-auto mt-6 max-w-sm">
          <p className="mb-3 text-xs font-medium uppercase tracking-wide text-neutral-400">Try instead</p>
          <div className="flex flex-col gap-2">
            {alternatives.map((alt) => (
              <button
                key={alt}
                onClick={() => router.push(`/search?q=${encodeURIComponent(alt)}`)}
                className="flex items-center justify-between rounded-lg border border-neutral-200/50 bg-surface px-4 py-2.5 text-sm text-neutral-700 transition-all hover:border-gold/40 hover:bg-gold-bg dark:border-neutral-700/50 dark:text-neutral-300 dark:hover:border-gold/40"
              >
                <span>{alt}</span>
                <ArrowRight className="h-3.5 w-3.5 text-neutral-400" />
              </button>
            ))}
          </div>
        </div>

        <div className="mx-auto mt-6 max-w-sm rounded-lg border border-neutral-200/50 bg-surface-secondary p-4 text-left dark:border-neutral-700/50 dark:bg-neutral-900">
          <div className="flex items-center gap-2 text-sm font-medium text-neutral-700 dark:text-neutral-300">
            <Lightbulb className="h-4 w-4 text-gold" />
            Search tips
          </div>
          <ul className="mt-2 space-y-1.5 text-xs text-neutral-500">
            <li>&bull; Use technology names: &quot;React&quot;, &quot;Kubernetes&quot;, &quot;Python ML&quot;</li>
            <li>&bull; Add a city to narrow by location: &quot;Go engineers in Austin&quot;</li>
            <li>&bull; Remove filters above to widen your results</li>
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
