"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState, useCallback, useRef, Suspense } from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { SearchResults } from "@/components/search/SearchResults";
import type { SearchResult } from "@/types";

const POPULAR_LANGUAGES = [
  "TypeScript", "JavaScript", "Python", "Rust", "Go", "Java",
  "C++", "Ruby", "PHP", "Swift", "Kotlin", "C#", "Scala", "Elixir",
];

const SORT_OPTIONS = [
  { value: "score", label: "Score" },
  { value: "followers", label: "Followers" },
  { value: "stars", label: "Stars" },
  { value: "joined", label: "Newest" },
];

interface FilterValues {
  languages?: string[];
  location?: string;
  minStars?: number;
  hireable?: boolean;
  sort?: string;
}

function parseFiltersFromParams(searchParams: URLSearchParams): FilterValues {
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

function buildSearchParams(q: string, filters: FilterValues): URLSearchParams {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (filters.languages && filters.languages.length > 0) params.set("languages", filters.languages.join(","));
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
  const [inputValue, setInputValue] = useState(query);
  const [results, setResults] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(true);

  const initialFilters = parseFiltersFromParams(searchParams);
  const [filters, setFilters] = useState<FilterValues>(initialFilters);

  const doSearch = useCallback(
    async (q: string, page = 1, f: FilterValues = {}) => {
      if (!q) return;
      setLoading(true);
      const params = new URLSearchParams({ q, page: String(page) });
      if (f.languages && f.languages.length > 0) params.set("languages", f.languages.join(","));
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

  useEffect(() => {
    const urlFilters = parseFiltersFromParams(searchParams);
    setFilters(urlFilters);
    setInputValue(query);
    if (query) doSearch(query, 1, urlFilters);
  }, [searchParams, query, doSearch]);

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

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!inputValue.trim()) return;
    const params = buildSearchParams(inputValue.trim(), filters);
    router.push(`/search?${params}`);
  }

  function updateFilter(key: string, value: unknown) {
    const newFilters = { ...filters, [key]: value || undefined };
    setFilters(newFilters);
    if (query) {
      const params = buildSearchParams(query, newFilters);
      router.push(`/search?${params}`);
    }
  }

  function toggleLanguage(lang: string) {
    const current = filters.languages || [];
    const updated = current.includes(lang)
      ? current.filter((l) => l !== lang)
      : [...current, lang];
    updateFilter("languages", updated.length > 0 ? updated : undefined);
  }

  function clearFilters() {
    setFilters({});
    if (query) router.push(`/search?q=${encodeURIComponent(query)}`);
  }

  const activeFilterCount =
    (filters.languages?.length || 0) +
    (filters.location ? 1 : 0) +
    (filters.minStars ? 1 : 0) +
    (filters.hireable ? 1 : 0);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6">
      {/* Search bar */}
      <form onSubmit={handleSearch} className="relative mx-auto max-w-3xl mb-6">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-neutral-400" />
        <input
          ref={searchInputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Search developers — try 'rust engineers in San Francisco' or 'karpathy'"
          className="w-full rounded-xl border border-neutral-200 bg-white py-3 pl-12 pr-24 text-base shadow-sm outline-none transition-all placeholder:text-neutral-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white"
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          <kbd className="hidden sm:inline-flex items-center rounded border border-neutral-200 px-1.5 py-0.5 text-[10px] text-neutral-400 dark:border-neutral-700">
            ⌘K
          </kbd>
          <button
            type="submit"
            className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            Search
          </button>
        </div>
      </form>

      <div className="flex gap-6">
        {/* Filter sidebar */}
        <aside className={`shrink-0 transition-all ${showFilters ? "w-60" : "w-0 overflow-hidden"}`}>
          <div className="sticky top-20 space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">Filters</h3>
              {activeFilterCount > 0 && (
                <button onClick={clearFilters} className="flex items-center gap-1 text-xs text-neutral-500 hover:text-neutral-700">
                  <X className="h-3 w-3" /> Clear ({activeFilterCount})
                </button>
              )}
            </div>

            {/* Sort */}
            <div>
              <label className="text-xs font-medium uppercase tracking-wide text-neutral-500">Sort by</label>
              <div className="mt-1.5 grid grid-cols-2 gap-1">
                {SORT_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => updateFilter("sort", opt.value)}
                    className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                      (filters.sort || "score") === opt.value
                        ? "bg-blue-600 text-white"
                        : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-400"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Languages */}
            <div>
              <label className="text-xs font-medium uppercase tracking-wide text-neutral-500">Languages</label>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {POPULAR_LANGUAGES.map((lang) => (
                  <button
                    key={lang}
                    onClick={() => toggleLanguage(lang)}
                    className={`rounded-full px-2 py-0.5 text-[11px] font-medium transition-colors ${
                      filters.languages?.includes(lang)
                        ? "bg-blue-600 text-white"
                        : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-400"
                    }`}
                  >
                    {lang}
                  </button>
                ))}
              </div>
            </div>

            {/* Location */}
            <div>
              <label className="text-xs font-medium uppercase tracking-wide text-neutral-500">Location</label>
              <input
                type="text"
                value={filters.location || ""}
                onChange={(e) => updateFilter("location", e.target.value)}
                placeholder="e.g. San Francisco"
                className="mt-1.5 w-full rounded-lg border border-neutral-200 bg-transparent px-3 py-1.5 text-sm outline-none focus:border-blue-500 dark:border-neutral-700"
              />
            </div>

            {/* Min Stars */}
            <div>
              <label className="text-xs font-medium uppercase tracking-wide text-neutral-500">Min Stars</label>
              <input
                type="number"
                value={filters.minStars || ""}
                onChange={(e) => updateFilter("minStars", e.target.value ? parseInt(e.target.value) : undefined)}
                placeholder="e.g. 100"
                className="mt-1.5 w-full rounded-lg border border-neutral-200 bg-transparent px-3 py-1.5 text-sm outline-none focus:border-blue-500 dark:border-neutral-700"
              />
            </div>

            {/* Toggles */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.hireable || false}
                  onChange={(e) => updateFilter("hireable", e.target.checked || undefined)}
                  className="rounded accent-blue-600"
                />
                Open to work only
              </label>
            </div>
          </div>
        </aside>

        {/* Results */}
        <div className="min-w-0 flex-1">
          {/* Results header */}
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center gap-1.5 rounded-lg border border-neutral-200 px-2.5 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800 lg:hidden"
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                Filters
              </button>
              {results && (
                <span className="text-sm text-neutral-500">
                  {results.total.toLocaleString()} developer{results.total !== 1 ? "s" : ""} found
                </span>
              )}
            </div>
          </div>

          <SearchResults
            results={results}
            loading={loading}
            onPageChange={(page) => doSearch(query, page, filters)}
          />
        </div>
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
