"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Bookmark, ChevronDown, Trash2, Loader2 } from "lucide-react";
import { showSuccess, showError } from "@/lib/toast";

interface SavedSearch {
  id: string;
  name: string;
  query: string;
  filters: Record<string, unknown> | null;
  sortBy: string | null;
}

interface SavedSearchesProps {
  currentQuery: string;
  currentFilters: {
    languages?: string[];
    location?: string;
    minStars?: number;
    hireable?: boolean;
    sort?: string;
  };
}

export function SavedSearches({ currentQuery, currentFilters }: SavedSearchesProps) {
  const { data: session } = useSession();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [searches, setSearches] = useState<SavedSearch[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchSearches = useCallback(async () => {
    if (!session?.user?.id) return;
    setLoading(true);
    try {
      const res = await fetch("/api/saved-searches");
      if (res.ok) {
        const data = await res.json();
        setSearches(data.savedSearches || []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [session?.user?.id]);

  useEffect(() => {
    if (open) fetchSearches();
  }, [open, fetchSearches]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open]);

  if (!session) return null;

  async function handleSave() {
    if (!currentQuery.trim()) {
      showError("Run a search first before saving");
      return;
    }
    const name = window.prompt("Name this search:", currentQuery);
    if (!name?.trim()) return;

    setSaving(true);
    try {
      const res = await fetch("/api/saved-searches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          query: currentQuery,
          filters: currentFilters,
          sortBy: currentFilters.sort,
        }),
      });
      if (res.ok) {
        showSuccess("Search saved");
        await fetchSearches();
      } else {
        const err = await res.json().catch(() => ({}));
        showError(err.error || "Failed to save search");
      }
    } catch {
      showError("Failed to save search");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    try {
      const res = await fetch(`/api/saved-searches/${id}`, { method: "DELETE" });
      if (res.ok) {
        setSearches((prev) => prev.filter((s) => s.id !== id));
        showSuccess("Search deleted");
      }
    } catch {
      showError("Failed to delete search");
    }
  }

  function handleLoad(search: SavedSearch) {
    const params = new URLSearchParams();
    params.set("q", search.query);
    const f = (search.filters || {}) as Record<string, unknown>;
    if (Array.isArray(f.languages) && f.languages.length > 0) {
      params.set("languages", f.languages.join(","));
    }
    if (f.location) params.set("location", String(f.location));
    if (f.minStars) params.set("minStars", String(f.minStars));
    if (f.hireable) params.set("hireable", "true");
    if (search.sortBy && search.sortBy !== "score") params.set("sort", search.sortBy);
    router.push(`/search?${params}`);
    setOpen(false);
  }

  return (
    <div ref={dropdownRef} className="relative inline-flex items-center gap-1">
      {/* Save button */}
      {currentQuery && (
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200/50 px-2.5 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-50 dark:border-neutral-700/50 dark:text-neutral-400 dark:hover:bg-neutral-800/50"
          title="Save this search"
        >
          {saving ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Bookmark className="h-3.5 w-3.5" />
          )}
          Save
        </button>
      )}

      {/* Dropdown toggle */}
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1 rounded-lg border border-neutral-200/50 px-2.5 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-50 dark:border-neutral-700/50 dark:text-neutral-400 dark:hover:bg-neutral-800/50"
        title="Load a saved search"
      >
        <Bookmark className="h-3.5 w-3.5" />
        Saved
        <ChevronDown className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-30 mt-2 w-72 rounded-lg border border-neutral-200 bg-white shadow-lg dark:border-neutral-700 dark:bg-neutral-900">
          <div className="p-2">
            <p className="px-2 py-1 text-xs font-medium text-neutral-500">Saved searches</p>
            {loading && (
              <div className="flex justify-center py-3">
                <Loader2 className="h-4 w-4 animate-spin text-neutral-400" />
              </div>
            )}
            {!loading && searches.length === 0 && (
              <p className="px-2 py-2 text-xs text-neutral-400">No saved searches yet</p>
            )}
            {!loading &&
              searches.map((search) => (
                <button
                  key={search.id}
                  onClick={() => handleLoad(search)}
                  className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm text-neutral-700 hover:bg-neutral-50 dark:text-neutral-300 dark:hover:bg-neutral-800"
                >
                  <div className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{search.name}</span>
                    <span className="block truncate text-xs text-neutral-400">{search.query}</span>
                  </div>
                  <button
                    onClick={(e) => handleDelete(search.id, e)}
                    className="ml-2 shrink-0 rounded p-1 text-neutral-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20"
                    title="Delete saved search"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </button>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
