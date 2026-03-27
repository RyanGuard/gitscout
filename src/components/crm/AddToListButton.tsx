"use client";

import { useSession } from "next-auth/react";
import { Plus, Check, Loader2 } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";

interface ListItem {
  id: string;
  name: string;
  entryCount: number;
}

interface AddToListButtonProps {
  developerId: string;
  className?: string;
}

export function AddToListButton({ developerId, className }: AddToListButtonProps) {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const [lists, setLists] = useState<ListItem[]>([]);
  const [addedTo, setAddedTo] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");

  const fetchLists = useCallback(async () => {
    if (!session?.user?.id) return;
    setLoading(true);
    try {
      const res = await fetch("/api/lists");
      const data = await res.json();
      setLists(data.lists || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [session?.user?.id]);

  useEffect(() => {
    if (open) fetchLists();
  }, [open, fetchLists]);

  if (!session) return null;

  async function addToList(listId: string) {
    try {
      const res = await fetch("/api/candidates/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ developerId, listId }),
      });
      if (res.ok || res.status === 409) {
        setAddedTo((prev) => new Set(prev).add(listId));
      }
    } catch {
      // ignore
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
        await addToList(list.id);
        setNewName("");
      }
    } catch {
      // ignore
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 px-3 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800",
          className
        )}
      >
        <Plus className="h-4 w-4" />
        Add to List
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-20 mt-2 w-64 rounded-lg border border-neutral-200 bg-white shadow-lg dark:border-neutral-700 dark:bg-neutral-900">
            <div className="p-2">
              <p className="px-2 py-1 text-xs font-medium text-neutral-500">Your Lists</p>
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
                      type="button"
                      onClick={() => !added && addToList(list.id)}
                      disabled={added}
                      className={cn(
                        "flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm transition-colors",
                        added
                          ? "text-green-600 dark:text-green-400"
                          : "text-neutral-700 hover:bg-neutral-50 dark:text-neutral-300 dark:hover:bg-neutral-800"
                      )}
                    >
                      <span className="truncate">{list.name}</span>
                      {added ? (
                        <Check className="h-3.5 w-3.5 shrink-0" />
                      ) : (
                        <span className="text-xs text-neutral-400">{list.entryCount}</span>
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
                  type="button"
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
