"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import { List, Plus, Check, Loader2 } from "lucide-react";
import { showSuccess, showError } from "@/lib/toast";
import type { DeveloperProfile } from "@/types";

interface ListItem {
  id: string;
  name: string;
  entryCount: number;
}

interface AddToListFromSearchProps {
  developer: DeveloperProfile;
  className?: string;
}

export function AddToListFromSearch({ developer, className }: AddToListFromSearchProps) {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const [lists, setLists] = useState<ListItem[]>([]);
  const [addedTo, setAddedTo] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchLists = useCallback(async () => {
    if (!session?.user?.id) return;
    setLoading(true);
    try {
      const res = await fetch("/api/lists");
      if (res.ok) {
        const data = await res.json();
        setLists(data.lists || []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [session?.user?.id]);

  useEffect(() => {
    if (open) fetchLists();
  }, [open, fetchLists]);

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

  async function indexAndAdd(listId: string) {
    setAdding(true);
    try {
      // Step 1: Ensure developer is indexed (persisted in DB)
      const indexRes = await fetch("/api/index", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: developer.username }),
      });

      if (!indexRes.ok) {
        showError("Failed to index developer");
        setAdding(false);
        return;
      }

      const { id: developerId } = await indexRes.json();

      // Step 2: Add to the selected list
      const addRes = await fetch("/api/candidates/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ developerId, listId }),
      });

      if (addRes.ok || addRes.status === 409) {
        setAddedTo((prev) => new Set(prev).add(listId));
        showSuccess(`Added ${developer.name || developer.username} to list`);
      } else {
        const err = await addRes.json().catch(() => ({}));
        showError(err.error || "Failed to add to list");
      }
    } catch {
      showError("Failed to add to list");
    } finally {
      setAdding(false);
    }
  }

  async function createAndAdd() {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/lists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() }),
      });
      if (res.ok) {
        const list = await res.json();
        setLists((prev) => [{ id: list.id, name: list.name, entryCount: 0 }, ...prev]);
        await indexAndAdd(list.id);
        setNewName("");
      }
    } catch {
      showError("Failed to create list");
    } finally {
      setCreating(false);
    }
  }

  function handleToggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setOpen(!open);
  }

  return (
    <div ref={dropdownRef} className={`relative ${className || ""}`}>
      <button
        onClick={handleToggle}
        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium text-text-muted hover:bg-gold-bg hover:text-gold transition-colors"
        title="Add to list"
      >
        <List className="h-3 w-3" />
        List
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(false); }} />
          <div
            className="absolute right-0 top-full z-20 mt-1 w-56 rounded-lg border border-neutral-200 bg-white shadow-lg dark:border-neutral-700 dark:bg-neutral-900"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
          >
            <div className="p-2">
              <p className="px-2 py-1 text-xs font-medium text-neutral-500">Add to list</p>
              {loading && (
                <div className="flex justify-center py-3">
                  <Loader2 className="h-4 w-4 animate-spin text-neutral-400" />
                </div>
              )}
              {!loading && lists.length === 0 && (
                <p className="px-2 py-2 text-xs text-neutral-400">No lists yet</p>
              )}
              {!loading &&
                lists.map((list) => {
                  const added = addedTo.has(list.id);
                  return (
                    <button
                      key={list.id}
                      onClick={() => !added && !adding && indexAndAdd(list.id)}
                      disabled={added || adding}
                      className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
                        added
                          ? "text-green-600 dark:text-green-400"
                          : "text-neutral-700 hover:bg-neutral-50 dark:text-neutral-300 dark:hover:bg-neutral-800"
                      }`}
                    >
                      <span className="truncate">{list.name}</span>
                      {added ? (
                        <Check className="h-3.5 w-3.5 shrink-0" />
                      ) : adding ? (
                        <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
                      ) : (
                        <Plus className="h-3.5 w-3.5 shrink-0 text-neutral-400" />
                      )}
                    </button>
                  );
                })}
            </div>
            <div className="border-t border-neutral-200 p-2 dark:border-neutral-700">
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && createAndAdd()}
                  placeholder="New list name..."
                  className="flex-1 rounded-md border border-neutral-200 bg-white px-2.5 py-1.5 text-xs outline-none focus:border-gold dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"
                />
                <button
                  onClick={createAndAdd}
                  disabled={creating || !newName.trim()}
                  className="rounded-md bg-gold px-2.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-gold-hover disabled:opacity-50"
                >
                  {creating ? "..." : "Create"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
