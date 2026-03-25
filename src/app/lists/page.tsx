"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { List, Plus, Loader2 } from "lucide-react";
import { ListCard } from "@/components/crm/ListCard";
import type { CandidateListSummary } from "@/types";

export default function ListsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [lists, setLists] = useState<CandidateListSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const fetchLists = useCallback(async () => {
    try {
      const res = await fetch("/api/lists");
      const data = await res.json();
      setLists(data.lists || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/");
      return;
    }
    if (session?.user?.id) fetchLists();
  }, [session?.user?.id, status, router, fetchLists]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/lists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), description: description.trim() || undefined }),
      });
      if (res.ok) {
        const list = await res.json();
        setLists((prev) => [list, ...prev]);
        setName("");
        setDescription("");
        setShowCreate(false);
      }
    } catch {
      // ignore
    } finally {
      setCreating(false);
    }
  }

  if (status === "loading" || loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">
          Candidate Lists
        </h1>
        <button
          type="button"
          onClick={() => setShowCreate(!showCreate)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          New List
        </button>
      </div>

      {showCreate && (
        <form
          onSubmit={handleCreate}
          className="mb-6 rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-700 dark:bg-neutral-900"
        >
          <div className="space-y-3">
            <div>
              <label htmlFor="list-name" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                Name
              </label>
              <input
                id="list-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Rust Engineers Q1"
                className="mt-1 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-300 focus:ring-1 focus:ring-blue-300 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
                autoFocus
              />
            </div>
            <div>
              <label htmlFor="list-desc" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                Description (optional)
              </label>
              <input
                id="list-desc"
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="A brief description of this list"
                className="mt-1 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-300 focus:ring-1 focus:ring-blue-300 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={creating || !name.trim()}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
              >
                {creating ? "Creating..." : "Create List"}
              </button>
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="rounded-lg border border-neutral-200 px-4 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
              >
                Cancel
              </button>
            </div>
          </div>
        </form>
      )}

      {lists.length === 0 ? (
        <div className="py-16 text-center">
          <List className="mx-auto h-12 w-12 text-neutral-300 dark:text-neutral-600" />
          <h2 className="mt-4 text-lg font-medium text-neutral-600 dark:text-neutral-400">
            No lists yet
          </h2>
          <p className="mt-1 text-sm text-neutral-500">
            Create a list to start organizing your candidates.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {lists.map((list) => (
            <ListCard key={list.id} list={list} />
          ))}
        </div>
      )}
    </div>
  );
}
