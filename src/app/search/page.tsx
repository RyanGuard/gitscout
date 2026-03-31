"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState, useCallback, useRef, Suspense } from "react";
import { Search, SlidersHorizontal, X, EyeOff, ExternalLink, ArrowRight, Loader2 as Spinner } from "lucide-react";
import Link from "next/link";
import { SearchResults } from "@/components/search/SearchResults";
import { RecommendedProfiles } from "@/components/search/RecommendedProfiles";
import { SearchDiscovery } from "@/components/search/SearchDiscovery";
import { FeatureHint } from "@/components/ui/FeatureHint";
import { getViewedProfiles, getViewedCount, clearViewedProfiles } from "@/lib/viewedProfiles";
import type { SearchResult } from "@/types";

interface LinkedinLookupResult {
  person: {
    name: string;
    email: string | null;
    phone: string | null;
    title: string | null;
    headline: string | null;
    company: string | null;
    city: string | null;
    state: string | null;
    country: string | null;
    photoUrl: string | null;
    seniority: string | null;
    linkedinUrl: string;
    githubUsername: string | null;
    employmentHistory: Array<{ organization_name: string; title: string | null; current: boolean }>;
  };
  developer: {
    id: string;
    username: string;
    score: number | null;
    avatarUrl: string | null;
    profileUrl: string;
  } | null;
}

function isLinkedInUrl(q: string): boolean {
  return /linkedin\.com\/in\//i.test(q.trim());
}

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
  const [searchError, setSearchError] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(
    typeof window !== "undefined" ? window.innerWidth >= 1024 : true
  );

  const initialFilters = parseFiltersFromParams(searchParams);
  const [filters, setFilters] = useState<FilterValues>(initialFilters);
  const [hideViewed, setHideViewed] = useState(false);
  const [viewedCount, setViewedCount] = useState(0);
  const [linkedinResult, setLinkedinResult] = useState<LinkedinLookupResult | null>(null);
  const [linkedinLoading, setLinkedinLoading] = useState(false);
  const [aiInterpretation, setAiInterpretation] = useState<{
    keywords?: string[];
    languages?: string[];
    location?: string;
    seniority?: string;
    suggestedQuery?: string;
  } | null>(null);

  useEffect(() => {
    setViewedCount(getViewedCount());
  }, [results]);

  const doSearch = useCallback(
    async (q: string, page = 1, f: FilterValues = {}) => {
      if (!q) return;
      setLoading(true);
      setSearchError(null);
      const params = new URLSearchParams({ q, page: String(page) });
      if (f.languages && f.languages.length > 0) params.set("languages", f.languages.join(","));
      if (f.location) params.set("location", f.location);
      if (f.minStars) params.set("minStars", String(f.minStars));
      if (f.hireable) params.set("hireable", "true");
      if (f.sort) params.set("sort", f.sort);

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);

      try {
        const res = await fetch(`/api/search?${params}`, { signal: controller.signal });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          const msg = res.status === 429
            ? "GitHub API rate limit reached. Try again in a minute."
            : res.status >= 500
              ? "Server error. Our team has been notified."
              : err.error || `Search failed (${res.status})`;
          setSearchError(msg);
          setResults(null);
          return;
        }
        const data = await res.json();
        setResults(data);
        if (data.warning) setSearchError(data.warning);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          setSearchError("Search timed out. Try a simpler query or try again in a moment.");
        } else {
          setSearchError("Search failed. Please try again.");
        }
        setResults(null);
      } finally {
        clearTimeout(timeout);
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

  async function handleLinkedInLookup(url: string) {
    setLinkedinLoading(true);
    setLinkedinResult(null);
    setResults(null);
    setSearchError(null);
    try {
      const res = await fetch("/api/lookup/linkedin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ linkedin_url: url.trim() }),
      });
      if (res.ok) {
        setLinkedinResult(await res.json());
      } else {
        const err = await res.json().catch(() => ({}));
        setSearchError(err.error || "LinkedIn lookup failed");
      }
    } catch {
      setSearchError("LinkedIn lookup failed. Please try again.");
    } finally {
      setLinkedinLoading(false);
    }
  }

  function isComplexQuery(q: string): boolean {
    const words = q.trim().split(/\s+/).length;
    const complexPhrases = ["who", "that", "with experience", "at a", "worked at", "contributed to", "find me", "looking for", "series"];
    return words > 5 || complexPhrases.some((p) => q.toLowerCase().includes(p));
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!inputValue.trim()) return;

    // Detect LinkedIn URLs
    if (isLinkedInUrl(inputValue)) {
      handleLinkedInLookup(inputValue.trim());
      return;
    }

    setLinkedinResult(null);
    setAiInterpretation(null);

    // For complex queries, use AI interpretation
    if (isComplexQuery(inputValue)) {
      try {
        const aiRes = await fetch("/api/search/interpret", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: inputValue.trim() }),
        });
        if (aiRes.ok) {
          const { interpreted } = await aiRes.json();
          setAiInterpretation(interpreted);

          // Build optimized search from AI interpretation
          const aiQuery = interpreted.suggestedQuery || inputValue.trim();
          const aiFilters = { ...filters };
          if (interpreted.languages?.length > 0 && !aiFilters.languages?.length) {
            aiFilters.languages = interpreted.languages;
          }
          if (interpreted.location && !aiFilters.location) {
            aiFilters.location = interpreted.location;
          }
          const params = buildSearchParams(aiQuery, aiFilters);
          router.push(`/search?${params}`);
          return;
        }
      } catch {
        // Fall through to normal search
      }
    }

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
    <div className="mx-auto w-full min-h-screen overflow-x-hidden">
      <div className="mx-auto max-w-7xl px-4 py-6">
      <h1 className="sr-only">Search Developers</h1>
      {/* Search bar */}
      <form onSubmit={handleSearch} className="relative mx-auto max-w-3xl mb-6">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-neutral-400" />
        <input
          ref={searchInputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Search developers or paste a LinkedIn URL"
          className="w-full rounded-xl border border-neutral-200/50 bg-surface py-3 pl-12 pr-24 text-base shadow-sm outline-none transition-all placeholder:text-neutral-400/60 focus:border-gold/50 focus:shadow-lg focus:shadow-gold/5 dark:border-neutral-700/50 dark:bg-surface dark:text-white"
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          <kbd className="hidden sm:inline-flex items-center rounded border border-neutral-200/50 px-1.5 py-0.5 text-[10px] font-mono text-neutral-400 dark:border-neutral-700/50">
            \u2318K
          </kbd>
          <button
            type="submit"
            className="rounded-lg bg-gold px-4 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-gold-hover"
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
              <label className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                Sort by
                {results && <FeatureHint id="search-sort" message="Scout Score ranks developers by real code quality — not followers or stars." position="right" />}
              </label>
              <div className="mt-1.5 grid grid-cols-2 gap-1">
                {SORT_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => updateFilter("sort", opt.value)}
                    className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                      (filters.sort || "score") === opt.value
                        ? "bg-gold text-white"
                        : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800/60 dark:text-neutral-400 dark:hover:bg-neutral-700/60"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Languages */}
            <div>
              <label className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                Languages
                {results && <FeatureHint id="search-languages" message="Filter by programming language to narrow results. Select multiple for full-stack developers." position="right" />}
              </label>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {POPULAR_LANGUAGES.map((lang) => (
                  <button
                    key={lang}
                    onClick={() => toggleLanguage(lang)}
                    className={`rounded-full px-2 py-0.5 text-[11px] font-medium transition-colors ${
                      filters.languages?.includes(lang)
                        ? "bg-gold text-white"
                        : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800/60 dark:text-neutral-400 dark:hover:bg-neutral-700/60"
                    }`}
                  >
                    {lang}
                  </button>
                ))}
              </div>
            </div>

            {/* Location */}
            <div>
              <label className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                Location
                {results && <FeatureHint id="search-location" message="Add a city to find developers in your target market." position="right" />}
              </label>
              <input
                type="text"
                value={filters.location || ""}
                onChange={(e) => updateFilter("location", e.target.value)}
                placeholder="e.g. San Francisco"
                className="mt-1.5 w-full rounded-lg border border-neutral-200/50 bg-transparent px-3 py-1.5 text-sm outline-none focus:border-gold dark:border-neutral-700/50 dark:bg-neutral-900/40 dark:focus:border-gold/50"
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
                className="mt-1.5 w-full rounded-lg border border-neutral-200/50 bg-transparent px-3 py-1.5 text-sm outline-none focus:border-gold dark:border-neutral-700/50 dark:bg-neutral-900/40 dark:focus:border-gold/50"
              />
            </div>

            {/* Toggles */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.hireable || false}
                  onChange={(e) => updateFilter("hireable", e.target.checked || undefined)}
                  className="rounded accent-gold"
                />
                Open to work only
              </label>
              <label className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hideViewed}
                  onChange={(e) => setHideViewed(e.target.checked)}
                  className="rounded accent-gold"
                />
                <EyeOff className="h-3.5 w-3.5" />
                Hide viewed ({viewedCount})
              </label>
              {viewedCount > 0 && hideViewed && (
                <button
                  onClick={() => { clearViewedProfiles(); setViewedCount(0); setHideViewed(false); }}
                  className="text-xs text-neutral-500 hover:text-red-500 transition-colors"
                >
                  Reset viewed history
                </button>
              )}
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
                className="flex items-center gap-1.5 rounded-lg border border-neutral-200/50 px-2.5 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-50 dark:border-neutral-700/50 dark:text-neutral-400 dark:hover:bg-neutral-800/50 lg:hidden"
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

          {searchError && (
            <div className="mb-4 flex items-center justify-between rounded-lg border border-red-200/50 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800/30 dark:bg-red-950/50 dark:text-red-300">
              <span>{searchError}</span>
              <button
                onClick={() => { setSearchError(null); if (query) doSearch(query, 1, filters); }}
                className="ml-3 shrink-0 rounded-md bg-red-100 px-3 py-1 text-xs font-medium text-red-800 hover:bg-red-200 dark:bg-red-900 dark:text-red-200 dark:hover:bg-red-800"
              >
                Retry
              </button>
            </div>
          )}

          {/* AI interpretation banner */}
          {aiInterpretation && results && (
            <div className="mb-4 rounded-lg border border-gold-border bg-gold-bg px-4 py-3">
              <div className="flex items-center gap-2 text-sm font-medium text-gold-muted dark:text-gold">
                <Spinner className="h-3.5 w-3.5" />
                Scout AI interpreted your search
              </div>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {aiInterpretation.languages?.map((l) => (
                  <span key={l} className="rounded-full bg-gold/10 px-2 py-0.5 text-[11px] font-medium text-gold">{l}</span>
                ))}
                {aiInterpretation.location && (
                  <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-[11px] font-medium text-blue-600 dark:text-blue-400">{aiInterpretation.location}</span>
                )}
                {aiInterpretation.seniority && (
                  <span className="rounded-full bg-purple-500/10 px-2 py-0.5 text-[11px] font-medium text-purple-600 dark:text-purple-400">{aiInterpretation.seniority}</span>
                )}
                {aiInterpretation.keywords?.map((k) => (
                  <span key={k} className="rounded-full bg-neutral-200/50 px-2 py-0.5 text-[11px] font-medium text-neutral-600 dark:bg-neutral-700/50 dark:text-neutral-400">{k}</span>
                ))}
              </div>
            </div>
          )}

          {/* LinkedIn lookup loading */}
          {linkedinLoading && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Spinner className="h-8 w-8 animate-spin text-gold" />
              <p className="text-sm text-neutral-500">Looking up LinkedIn profile...</p>
            </div>
          )}

          {/* LinkedIn lookup result */}
          {linkedinResult && !linkedinLoading && (
            <div className="mb-6">
              <p className="mb-3 text-xs font-medium uppercase tracking-wide text-neutral-400">LinkedIn Lookup Result</p>
              <div className="rounded-xl border border-neutral-200/50 bg-surface p-6 shadow-sm dark:border-neutral-800/80">
                <div className="flex items-start gap-4">
                  {linkedinResult.person.photoUrl ? (
                    <img src={linkedinResult.person.photoUrl} alt="" className="h-14 w-14 rounded-full object-cover" />
                  ) : (
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gold-bg text-lg font-bold text-gold">
                      {linkedinResult.person.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-semibold text-neutral-900 dark:text-white">
                      {linkedinResult.person.name}
                    </h3>
                    {linkedinResult.person.title && (
                      <p className="text-sm text-neutral-600 dark:text-neutral-400">
                        {linkedinResult.person.title}
                        {linkedinResult.person.company && <span className="text-neutral-400"> at {linkedinResult.person.company}</span>}
                      </p>
                    )}
                    {linkedinResult.person.city && (
                      <p className="mt-0.5 text-xs text-neutral-500">
                        {[linkedinResult.person.city, linkedinResult.person.state, linkedinResult.person.country].filter(Boolean).join(", ")}
                      </p>
                    )}

                    {/* Contact info */}
                    <div className="mt-3 flex flex-wrap gap-2">
                      {linkedinResult.person.email && (
                        <span className="rounded-md bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400">
                          {linkedinResult.person.email}
                        </span>
                      )}
                      {linkedinResult.person.phone && (
                        <span className="rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 dark:bg-blue-900/20 dark:text-blue-400">
                          {linkedinResult.person.phone}
                        </span>
                      )}
                      {linkedinResult.person.seniority && (
                        <span className="rounded-md bg-neutral-100 px-2 py-1 text-xs font-medium text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400">
                          {linkedinResult.person.seniority}
                        </span>
                      )}
                    </div>

                    {/* Employment history */}
                    {linkedinResult.person.employmentHistory.length > 0 && (
                      <div className="mt-4">
                        <p className="text-[10px] font-medium uppercase tracking-wide text-neutral-400 mb-1.5">Experience</p>
                        <div className="space-y-1">
                          {linkedinResult.person.employmentHistory.map((job, i) => (
                            <div key={i} className="flex items-center gap-2 text-xs">
                              {job.current && <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />}
                              {!job.current && <span className="h-1.5 w-1.5 rounded-full bg-neutral-300 dark:bg-neutral-600 shrink-0" />}
                              <span className="text-neutral-700 dark:text-neutral-300">{job.organization_name}</span>
                              {job.title && <span className="text-neutral-400">— {job.title}</span>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="mt-4 flex items-center gap-2">
                      <a
                        href={linkedinResult.person.linkedinUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 rounded-lg border border-neutral-200/50 px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-50 dark:border-neutral-700/50 dark:text-neutral-400 dark:hover:bg-neutral-800"
                      >
                        <ExternalLink className="h-3 w-3" />
                        LinkedIn
                      </a>
                      {linkedinResult.developer && (
                        <Link
                          href={linkedinResult.developer.profileUrl}
                          className="flex items-center gap-1.5 rounded-lg bg-gold px-3 py-1.5 text-xs font-semibold text-white hover:bg-gold-hover"
                        >
                          View Scout Profile
                          {linkedinResult.developer.score && (
                            <span className="rounded bg-white/20 px-1.5 py-0.5 text-[10px]">
                              {Math.round(linkedinResult.developer.score)}
                            </span>
                          )}
                          <ArrowRight className="h-3 w-3" />
                        </Link>
                      )}
                      {!linkedinResult.developer && linkedinResult.person.githubUsername && (
                        <Link
                          href={`/profile/${linkedinResult.person.githubUsername}`}
                          className="flex items-center gap-1.5 rounded-lg bg-gold px-3 py-1.5 text-xs font-semibold text-white hover:bg-gold-hover"
                        >
                          View GitHub Profile <ArrowRight className="h-3 w-3" />
                        </Link>
                      )}
                      {!linkedinResult.developer && !linkedinResult.person.githubUsername && (
                        <span className="text-xs text-neutral-400 italic">No GitHub profile found</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {!query && !results && !loading && !linkedinResult && !linkedinLoading && (
            <SearchDiscovery />
          )}

          <SearchResults
            results={hideViewed && results ? {
              ...results,
              developers: results.developers.filter(
                d => !getViewedProfiles().has(d.username.toLowerCase())
              ),
            } : results}
            loading={loading}
            onPageChange={(page) => doSearch(query, page, filters)}
          />
        </div>

        {/* Recommended profiles sidebar — only show when there are results */}
        {query && results && results.developers.length > 0 && (
          <div className="hidden xl:block">
            <RecommendedProfiles query={query} />
          </div>
        )}
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
