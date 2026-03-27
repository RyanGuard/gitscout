"use client";

import { useState, useRef, useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface TagInputProps {
  tags: string[];
  onAdd: (tag: string) => void;
  onRemove: (tag: string) => void;
  suggestions?: string[];
  disabled?: boolean;
}

export function TagInput({ tags, onAdd, onRemove, suggestions = [], disabled }: TagInputProps) {
  const [input, setInput] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = suggestions.filter(
    (s) => s.toLowerCase().includes(input.toLowerCase()) && !tags.includes(s)
  );

  useEffect(() => {
    setShowSuggestions(input.length > 0 && filtered.length > 0);
  }, [input, filtered.length]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && input.trim()) {
      e.preventDefault();
      const tag = input.trim().toLowerCase().replace(/\s+/g, "-");
      if (!tags.includes(tag)) {
        onAdd(tag);
      }
      setInput("");
      setShowSuggestions(false);
    }
  }

  return (
    <div className="relative">
      <div className="flex flex-wrap items-center gap-1.5">
        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-full bg-gold-bg px-2 py-0.5 text-xs font-medium text-gold dark:bg-gold-bg dark:text-gold"
          >
            {tag}
            {!disabled && (
              <button
                type="button"
                onClick={() => onRemove(tag)}
                className="rounded-full p-0.5 hover:bg-gold/20 dark:hover:bg-gold/20"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            )}
          </span>
        ))}
        {!disabled && (
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
            placeholder="Add tag..."
            className="w-20 border-none bg-transparent text-xs text-neutral-700 outline-none placeholder:text-neutral-400 dark:text-neutral-300"
          />
        )}
      </div>
      {showSuggestions && (
        <div className="absolute left-0 top-full z-20 mt-1 max-h-32 w-44 overflow-auto rounded-lg border border-neutral-200 bg-white py-1 shadow-lg dark:border-neutral-700 dark:bg-neutral-900">
          {filtered.slice(0, 8).map((s) => (
            <button
              key={s}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onAdd(s);
                setInput("");
                setShowSuggestions(false);
                inputRef.current?.focus();
              }}
              className={cn(
                "block w-full px-3 py-1.5 text-left text-xs text-neutral-700 hover:bg-neutral-50 dark:text-neutral-300 dark:hover:bg-neutral-800"
              )}
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
