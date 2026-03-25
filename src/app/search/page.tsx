"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState, useCallback, Suspense } from "react";
import { SearchInput } from "@/components/ui/SearchInput";
import { SearchFilters } from "@/components/search/SearchFilters";
import { SearchResults } from "@/components/search/SearchResults";
import type { SearchResult } from "@/types";

function SearchPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const query = searchParams.get("q") || "";
  const [results, setResults] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState<Record<string, string | string[] | number | boolean | undefined>>({});

  const doSearch = useCallback(
    async (q: string, page = 1, f = filters) => {
      if (!q) return;
      setLoading(true);
      const params = new URLSearchParams({ q, page: String(page) });
      if (f.languages && Array.isArray(f.languages) && f.languages.length > 0) {
        params.set("languages", f.languages.join(","));
      }
      if (f.location) params.set("location", String(f.location));
      if (f.minStars) params.set("minStars", String(f.minStars));
      if (f.hireable) params.set("hireable", "true");
      if (f.sort) params.set("sort", String(f.sort));

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
    [filters]
  );

  useEffect(() => {
    if (query) doSearch(query);
  }, [query, doSearch]);

  function handleSearch(q: string) {
    router.push(`/search?q=${encodeURIComponent(q)}`);
  }

  function handleFilterChange(newFilters: Record<string, string | string[] | number | boolean | undefined>) {
    setFilters(newFilters);
    if (query) doSearch(query, 1, newFilters);
  }

  function handlePageChange(page: number) {
    doSearch(query, page);
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8">
      <div className="mb-6 flex justify-center">
        <SearchInput onSearch={handleSearch} defaultValue={query} />
      </div>

      <SearchFilters onFilterChange={handleFilterChange} />

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
