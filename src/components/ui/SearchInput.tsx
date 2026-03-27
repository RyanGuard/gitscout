"use client";

import { Search, X } from "lucide-react";
import { useState, useCallback, forwardRef } from "react";

interface SearchInputProps {
  onSearch: (query: string) => void;
  placeholder?: string;
  defaultValue?: string;
}

export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  function SearchInput(
    {
      onSearch,
      placeholder = "Search developers by name, language, or location...",
      defaultValue = "",
    },
    ref
  ) {
    const [value, setValue] = useState(defaultValue);

    const handleSubmit = useCallback(
      (e: React.FormEvent) => {
        e.preventDefault();
        if (value.trim()) onSearch(value.trim());
      },
      [value, onSearch]
    );

    const handleClear = useCallback(() => {
      setValue("");
    }, []);

    return (
      <form onSubmit={handleSubmit} className="relative w-full max-w-2xl">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-neutral-400" />
        <input
          ref={ref}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-xl border border-neutral-200 bg-white py-3 pl-12 pr-12 text-base shadow-sm outline-none transition-all placeholder:text-neutral-400 focus:border-gold focus:ring-2 focus:ring-gold/20 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white dark:placeholder:text-neutral-500"
        />
        {value && (
          <button
            type="button"
            onClick={handleClear}
            aria-label="Clear search"
            className="absolute right-14 top-1/2 -translate-y-1/2 rounded p-0.5 text-neutral-400 hover:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-gold/20 dark:hover:text-neutral-300"
          >
            <X className="h-4 w-4" />
          </button>
        )}
        <button
          type="submit"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg bg-gold px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-gold-hover focus:outline-none focus:ring-2 focus:ring-gold/20"
        >
          Search
        </button>
      </form>
    );
  }
);
