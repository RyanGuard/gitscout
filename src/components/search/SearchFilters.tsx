"use client";

import { SlidersHorizontal, X } from "lucide-react";
import { useState } from "react";

const POPULAR_LANGUAGES = [
  "TypeScript",
  "JavaScript",
  "Python",
  "Rust",
  "Go",
  "Java",
  "C++",
  "Ruby",
  "PHP",
  "Swift",
  "Kotlin",
  "C#",
];

interface FilterValues {
  languages?: string[];
  location?: string;
  minStars?: number;
  hireable?: boolean;
  sort?: string;
}

interface SearchFiltersProps {
  onFilterChange: (filters: FilterValues) => void;
  defaultValues?: FilterValues;
}

export function SearchFilters({ onFilterChange, defaultValues }: SearchFiltersProps) {
  const [open, setOpen] = useState(false);
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>(
    defaultValues?.languages || []
  );
  const [location, setLocation] = useState(defaultValues?.location || "");
  const [minStars, setMinStars] = useState(
    defaultValues?.minStars ? String(defaultValues.minStars) : ""
  );
  const [hireable, setHireable] = useState(defaultValues?.hireable || false);
  const [sort, setSort] = useState(defaultValues?.sort || "score");

  function apply() {
    onFilterChange({
      languages: selectedLanguages.length > 0 ? selectedLanguages : undefined,
      location: location || undefined,
      minStars: minStars ? parseInt(minStars) : undefined,
      hireable: hireable || undefined,
      sort,
    });
  }

  function toggleLanguage(lang: string) {
    setSelectedLanguages((prev) =>
      prev.includes(lang) ? prev.filter((l) => l !== lang) : [...prev, lang]
    );
  }

  function clearFilters() {
    setSelectedLanguages([]);
    setLocation("");
    setMinStars("");
    setHireable(false);
    setSort("score");
    onFilterChange({});
  }

  const hasActiveFilters =
    selectedLanguages.length > 0 || location || minStars || hireable;

  return (
    <div className="w-full">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 text-sm text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white transition-colors"
      >
        <SlidersHorizontal className="h-4 w-4" />
        Filters
        {hasActiveFilters && (
          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
            {selectedLanguages.length + (location ? 1 : 0) + (minStars ? 1 : 0) + (hireable ? 1 : 0)}
          </span>
        )}
      </button>

      {open && (
        <div className="mt-3 rounded-xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-700 dark:bg-neutral-900">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-neutral-900 dark:text-white">
              Filter results
            </h3>
            <button
              onClick={clearFilters}
              className="flex items-center gap-1 text-xs text-neutral-500 hover:text-neutral-700 transition-colors"
            >
              <X className="h-3 w-3" /> Clear all
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-neutral-500 uppercase tracking-wide">
                Languages
              </label>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {POPULAR_LANGUAGES.map((lang) => (
                  <button
                    key={lang}
                    onClick={() => toggleLanguage(lang)}
                    className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                      selectedLanguages.includes(lang)
                        ? "bg-blue-600 text-white"
                        : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-400"
                    }`}
                  >
                    {lang}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs font-medium text-neutral-500 uppercase tracking-wide">
                  Location
                </label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g. San Francisco"
                  className="mt-1 w-full rounded-lg border border-neutral-200 bg-transparent px-3 py-1.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-neutral-700 transition-colors"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-neutral-500 uppercase tracking-wide">
                  Min Stars
                </label>
                <input
                  type="number"
                  value={minStars}
                  onChange={(e) => setMinStars(e.target.value)}
                  placeholder="e.g. 100"
                  className="mt-1 w-full rounded-lg border border-neutral-200 bg-transparent px-3 py-1.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-neutral-700 transition-colors"
                />
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="hireable"
                  checked={hireable}
                  onChange={(e) => setHireable(e.target.checked)}
                  className="rounded accent-blue-600"
                />
                <label htmlFor="hireable" className="text-sm text-neutral-600 dark:text-neutral-400">
                  Hireable only
                </label>
              </div>

              <div className="flex items-center gap-2">
                <label className="text-xs font-medium text-neutral-500">Sort by</label>
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value)}
                  className="rounded-lg border border-neutral-200 bg-transparent px-2 py-1 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-neutral-700 transition-colors"
                >
                  <option value="score">Relevance</option>
                  <option value="stars">Stars</option>
                  <option value="followers">Followers</option>
                  <option value="commits">Commits</option>
                </select>
              </div>
            </div>

            <button
              onClick={apply}
              className="w-full rounded-lg bg-blue-600 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
            >
              Apply Filters
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
