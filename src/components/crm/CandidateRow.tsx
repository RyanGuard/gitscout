"use client";

import Link from "next/link";
import { Trash2, ExternalLink } from "lucide-react";
import { StageDropdown } from "./StageDropdown";
import { TagInput } from "./TagInput";
import { NoteInput } from "./NoteInput";
import { timeAgo } from "@/lib/utils";
import { DraftInStudioButton } from "@/components/outreach/DraftInStudioButton";
import { fromListEntry } from "@/lib/outreach/candidateNormalizer";

interface Note {
  id: string;
  content: string;
  createdAt: string;
}

interface CandidateRowProps {
  entry: {
    id: string;
    stage: string;
    addedAt: string;
    developer: {
      id: string;
      username: string;
      name: string | null;
      avatarUrl: string | null;
      score: number;
      location: string | null;
    };
    tags: string[];
    lastNote: string | null;
  };
  listId: string;
  tagSuggestions: string[];
  notes: Note[];
  onStageChange: (entryId: string, stage: string) => void;
  onTagAdd: (entryId: string, tag: string) => void;
  onTagRemove: (entryId: string, tag: string) => void;
  onNoteAdd: (entryId: string, content: string) => void;
  onRemove: (entryId: string) => void;
}

export function CandidateRow({
  entry,
  listId,
  tagSuggestions,
  notes,
  onStageChange,
  onTagAdd,
  onTagRemove,
  onNoteAdd,
  onRemove,
}: CandidateRowProps) {
  return (
    <tr className="border-b border-neutral-100 transition-colors hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-800/50">
      <td className="py-3 pl-4 pr-3">
        <Link
          href={`/profile/${entry.developer.username}`}
          className="flex items-center gap-3 group"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={entry.developer.avatarUrl || `https://github.com/${entry.developer.username}.png`}
            alt={entry.developer.username}
            className="h-8 w-8 rounded-full border border-neutral-200 dark:border-neutral-700"
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-neutral-900 group-hover:text-gold dark:text-white dark:group-hover:text-gold">
              {entry.developer.name || entry.developer.username}
            </p>
            <p className="text-xs text-neutral-500">@{entry.developer.username}</p>
          </div>
        </Link>
      </td>
      <td className="px-3 py-3">
        <StageDropdown
          value={entry.stage}
          onChange={(stage) => onStageChange(entry.id, stage)}
        />
      </td>
      <td className="px-3 py-3">
        <TagInput
          tags={entry.tags}
          onAdd={(tag) => onTagAdd(entry.id, tag)}
          onRemove={(tag) => onTagRemove(entry.id, tag)}
          suggestions={tagSuggestions}
        />
      </td>
      <td className="px-3 py-3">
        <NoteInput
          notes={notes}
          onAdd={(content) => onNoteAdd(entry.id, content)}
        />
      </td>
      <td className="px-3 py-3">
        <span className="text-xs text-neutral-500">{timeAgo(entry.addedAt)}</span>
      </td>
      <td className="py-3 pl-3 pr-4">
        <div className="flex items-center gap-1">
          <Link
            href={`/profile/${entry.developer.username}`}
            className="rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 dark:hover:bg-neutral-800 dark:hover:text-neutral-300"
            title="View profile"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
          <DraftInStudioButton
            variant="icon"
            candidate={fromListEntry(entry)}
            className="rounded p-1 hover:bg-gold-bg"
          />
          <button
            type="button"
            onClick={() => onRemove(entry.id)}
            className="rounded p-1 text-neutral-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950 dark:hover:text-red-400"
            title="Remove from list"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </td>
    </tr>
  );
}
