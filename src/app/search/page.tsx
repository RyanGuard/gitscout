"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState, useCallback, useRef, Suspense } from "react";
import { SearchInput } from "@/components/ui/SearchInput";
import { SearchFilters } from "@/components/search/SearchFilters";
import { SearchResults } from "@/components/search/SearchResults";
import type { SearchResult } from "@/types";

interface FilterValues {
  languages?: string[];
  location?: string;
  minStars?: number;
  hireable?: boolean;
  sort?: string;
}

function parseFiltersFromParams(
  searchParams: URLSearchParams
): FilterValues {
  const filters: FilterValues = {};
  const languages = searchParams.get("languages");
  if (languages) filters.languages = languages.split(",");
  const location = searchParams.get("location");
  if (location) filters.location = location;
  const minStars = searchParams.get("minStars");
  if (minStars) filters.minStars = parseInt(minStars);
  const hireable = searchParams.get("hireable");
  if (hireable === "true") filters.hireable = true;
  const sort = searchParams.get("sort");
  if (sort) filters.sort = sort;
  return filters;
}

function buildSearchParams(
  q: string,
  filters: FilterValues
): URLSearchParams {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (filters.languages && filters.languages.length > 0) {
    params.set("languages", filters.languages.join(","));
  }
  if (filters.location) params.set("location", filters.location);
  if (filters.minStars) params.set("minStars", String(filters.minStars));
  if (filters.hireable) params.set("hireable", "true");
  if (filters.sort && filters.sort !== "score") params.set("sort", filters.sort);
  return params;
}

function SearchPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const query = searchParams.get("q") || "";
  const [results, setResults] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);

  const initialFilters = parseFiltersFromParams(searchParams);
  const [filters, setFilters] = useState<FilterValues>(initialFilters);

  const doSearch = useCallback(
    async (q: string, page = 1, f: FilterValues = {}) => {
      if (!q) return;
      setLoading(true);
      const params = new URLSearchParams({ q, page: String(page) });
      if (f.languages && f.languages.length > 0) {
        params.set("languages", f.languages.join(","));
      }
      if (f.location) params.set("location", f.location);
      if (f.minStars) params.set("minStars", String(f.minStars));
      if (f.hireable) params.set("hireable", "true");
      if (f.sort) params.set("sort", f.sort);

      try {
        const res = await fetch(`/api/search?${params}`);
        const data = await res.json();
        setResults(data);
      } catch {
        setResults(null);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // Sync filters from URL params on back/forward navigation
  useEffect(() => {
    const urlFilters = parseFiltersFromParams(searchParams);
    setFilters(urlFilters);
    if (query) doSearch(query, 1, urlFilters);
  }, [searchParams, query, doSearch]);

  // Cmd/Ctrl+K keyboard shortcut to focus search
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  function handleSearch(q: string) {
    const params = buildSearchParams(q, filters);
    router.push(`/search?${params}`);
  }

  function handleFilterChange(newFilters: FilterValues) {
    setFilters(newFilters);
    if (query) {
      const params = buildSearchParams(query, newFilters);
      router.push(`/search?${params}`);
    }
  }

  function handlePageChange(page: number) {
    doSearch(query, page, filters);
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8">
      <div className="mb-6 flex justify-center">
        <SearchInput
          onSearch={handleSearch}
          defaultValue={query}
          ref={searchInputRef}
        />
      </div>

      <SearchFilters
        onFilterChange={handleFilterChange}
        defaultValues={filters}
      />

      <div className="mt-6">
        <SearchResults
          results={results}
          loading={loading}
          onPageChange={handlePageChange}
        />
      </div>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense>
      <SearchPageInner />
    </Suspense>
  );
}
