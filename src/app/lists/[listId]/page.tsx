"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, Pencil, Trash2, Filter } from "lucide-react";
import { CandidateRow } from "@/components/crm/CandidateRow";
import { STAGES, STAGE_COLORS } from "@/components/crm/StageDropdown";
import { cn } from "@/lib/utils";
import type { CandidateEntry } from "@/types";

interface Note {
  id: string;
  content: string;
  createdAt: string;
}

export default function ListDetailPage({
  params,
}: {
  params: Promise<{ listId: string }>;
}) {
  const { listId } = use(params);
  const { data: session, status } = useSession();
  const router = useRouter();

  const [listName, setListName] = useState("");
  const [listDescription, setListDescription] = useState("");
  const [entries, setEntries] = useState<CandidateEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [stageFilter, setStageFilter] = useState<string | null>(null);
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"addedAt" | "stage" | "score" | "name">("addedAt");
  const [tagSuggestions, setTagSuggestions] = useState<string[]>([]);
  const [entryNotes, setEntryNotes] = useState<Record<string, Note[]>>({});

  const fetchList = useCallback(async () => {
    try {
      const res = await fetch(`/api/lists/${listId}`);
      if (!res.ok) {
        router.push("/lists");
        return;
      }
      const data = await res.json();
      setListName(data.name);
      setListDescription(data.description || "");
      setEntries(data.entries || []);

      // Collect all unique tags for suggestions
      const allTags = new Set<string>();
      (data.entries || []).forEach((e: CandidateEntry) =>
        e.tags.forEach((t) => allTags.add(t))
      );
      setTagSuggestions(Array.from(allTags));
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [listId, router]);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/");
      return;
    }
    if (session?.user?.id) fetchList();
  }, [session?.user?.id, status, router, fetchList]);

  async function handleSave() {
    await fetch(`/api/lists/${listId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editName, description: editDesc }),
    });
    setListName(editName);
    setListDescription(editDesc);
    setEditing(false);
  }

  async function handleDelete() {
    if (!confirm("Delete this list and all its entries?")) return;
    await fetch(`/api/lists/${listId}`, { method: "DELETE" });
    router.push("/lists");
  }

  async function handleStageChange(entryId: string, stage: string) {
    await fetch(`/api/lists/${listId}/entries/${entryId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage }),
    });
    setEntries((prev) =>
      prev.map((e) => (e.id === entryId ? { ...e, stage } : e))
    );
  }

  async function handleTagAdd(entryId: string, tag: string) {
    await fetch(`/api/lists/${listId}/entries/${entryId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ addTags: [tag] }),
    });
    setEntries((prev) =>
      prev.map((e) =>
        e.id === entryId ? { ...e, tags: [...e.tags, tag] } : e
      )
    );
    if (!tagSuggestions.includes(tag)) {
      setTagSuggestions((prev) => [...prev, tag]);
    }
  }

  async function handleTagRemove(entryId: string, tag: string) {
    await fetch(`/api/lists/${listId}/entries/${entryId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ removeTags: [tag] }),
    });
    setEntries((prev) =>
      prev.map((e) =>
        e.id === entryId
          ? { ...e, tags: e.tags.filter((t) => t !== tag) }
          : e
      )
    );
  }

  async function handleNoteAdd(entryId: string, content: string) {
    const res = await fetch(
      `/api/lists/${listId}/entries/${entryId}/notes`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      }
    );
    if (res.ok) {
      const note = await res.json();
      setEntryNotes((prev) => ({
        ...prev,
        [entryId]: [note, ...(prev[entryId] || [])],
      }));
      setEntries((prev) =>
        prev.map((e) =>
          e.id === entryId ? { ...e, lastNote: content } : e
        )
      );
    }
  }

  async function handleRemove(entryId: string) {
    await fetch(`/api/lists/${listId}/entries/${entryId}`, {
      method: "DELETE",
    });
    setEntries((prev) => prev.filter((e) => e.id !== entryId));
  }

  // Filtering and sorting
  let filtered = entries;
  if (stageFilter) filtered = filtered.filter((e) => e.stage === stageFilter);
  if (tagFilter) filtered = filtered.filter((e) => e.tags.includes(tagFilter));

  const stageOrder = Object.fromEntries(STAGES.map((s, i) => [s, i]));
  const sorted = [...filtered].sort((a, b) => {
    switch (sortBy) {
      case "stage":
        return (stageOrder[a.stage] ?? 0) - (stageOrder[b.stage] ?? 0);
      case "score":
        return b.developer.score - a.developer.score;
      case "name":
        return (a.developer.name || a.developer.username).localeCompare(
          b.developer.name || b.developer.username
        );
      default:
        return new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime();
    }
  });

  if (status === "loading" || loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <Link
        href="/lists"
        className="mb-4 inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to lists
      </Link>

      {/* List header */}
      <div className="mb-6 flex items-start justify-between">
        {editing ? (
          <div className="flex-1 space-y-2">
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-lg font-bold outline-none focus:border-gold/50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
              autoFocus
            />
            <input
              type="text"
              value={editDesc}
              onChange={(e) => setEditDesc(e.target.value)}
              placeholder="Description"
              className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:border-gold/50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleSave}
                className="rounded-lg bg-gold px-3 py-1.5 text-sm font-medium text-white hover:bg-gold-hover"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="rounded-lg border border-neutral-200 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div>
            <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">
              {listName}
            </h1>
            {listDescription && (
              <p className="mt-1 text-sm text-neutral-500">{listDescription}</p>
            )}
            <p className="mt-1 text-xs text-neutral-400">
              {entries.length} candidate{entries.length !== 1 ? "s" : ""}
            </p>
          </div>
        )}
        {!editing && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setEditName(listName);
                setEditDesc(listDescription);
                setEditing(true);
              }}
              className="rounded-lg border border-neutral-200 p-2 text-neutral-500 hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
              title="Edit list"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={handleDelete}
              className="rounded-lg border border-red-200 p-2 text-red-500 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-950"
              title="Delete list"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5 text-xs text-neutral-500">
          <Filter className="h-3.5 w-3.5" />
          Filter:
        </div>
        <select
          value={stageFilter || ""}
          onChange={(e) => setStageFilter(e.target.value || null)}
          className="rounded-md border border-neutral-200 bg-white px-2 py-1 text-xs outline-none dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"
        >
          <option value="">All stages</option>
          {STAGES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        {tagSuggestions.length > 0 && (
          <select
            value={tagFilter || ""}
            onChange={(e) => setTagFilter(e.target.value || null)}
            className="rounded-md border border-neutral-200 bg-white px-2 py-1 text-xs outline-none dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"
          >
            <option value="">All tags</option>
            {tagSuggestions.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        )}
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
          className="rounded-md border border-neutral-200 bg-white px-2 py-1 text-xs outline-none dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"
        >
          <option value="addedAt">Sort: Added date</option>
          <option value="stage">Sort: Stage</option>
          <option value="score">Sort: Score</option>
          <option value="name">Sort: Name</option>
        </select>

        {/* Stage distribution */}
        <div className="ml-auto flex gap-1.5">
          {STAGES.map((stage) => {
            const count = entries.filter((e) => e.stage === stage).length;
            if (count === 0) return null;
            return (
              <span
                key={stage}
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium capitalize",
                  STAGE_COLORS[stage]
                )}
              >
                {count} {stage}
              </span>
            );
          })}
        </div>
      </div>

      {/* Candidates table */}
      {sorted.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-sm text-neutral-500">
            {entries.length === 0
              ? "No candidates in this list yet. Add developers from search or profile pages."
              : "No candidates match the current filters."}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-900">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-neutral-200 text-xs font-medium text-neutral-500 dark:border-neutral-700">
                <th className="py-2.5 pl-4 pr-3">Developer</th>
                <th className="px-3 py-2.5">Stage</th>
                <th className="px-3 py-2.5">Tags</th>
                <th className="px-3 py-2.5">Notes</th>
                <th className="px-3 py-2.5">Added</th>
                <th className="py-2.5 pl-3 pr-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((entry) => (
                <CandidateRow
                  key={entry.id}
                  entry={entry}
                  tagSuggestions={tagSuggestions}
                  notes={
                    entryNotes[entry.id] ||
                    (entry.lastNote
                      ? [{ id: "initial", content: entry.lastNote, createdAt: entry.addedAt }]
                      : [])
                  }
                  onStageChange={handleStageChange}
                  onTagAdd={handleTagAdd}
                  onTagRemove={handleTagRemove}
                  onNoteAdd={handleNoteAdd}
                  onRemove={handleRemove}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
