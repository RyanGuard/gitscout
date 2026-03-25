"use client";

import { Search, X } from "lucide-react";
import { useState, useCallback } from "react";

interface SearchInputProps {
  onSearch: (query: string) => void;
  placeholder?: string;
  defaultValue?: string;
}

export function SearchInput({
  onSearch,
  placeholder = "Search developers by name, language, or location...",
  defaultValue = "",
}: SearchInputProps) {
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
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-neutral-200 bg-white py-3 pl-12 pr-12 text-base shadow-sm outline-none transition-all placeholder:text-neutral-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white dark:placeholder:text-neutral-500"
      />
      {value && (
        <button
          type="button"
          onClick={handleClear}
          className="absolute right-14 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
        >
          <X className="h-4 w-4" />
        </button>
      )}
      <button
        type="submit"
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
      >
        Search
      </button>
    </form>
  );
}
