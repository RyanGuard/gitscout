"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import { timeAgo } from "@/lib/utils";

interface Note {
  id: string;
  content: string;
  createdAt: string;
}

interface NoteInputProps {
  notes: Note[];
  onAdd: (content: string) => void;
  loading?: boolean;
}

export function NoteInput({ notes, onAdd, loading }: NoteInputProps) {
  const [content, setContent] = useState("");
  const [expanded, setExpanded] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;
    onAdd(content.trim());
    setContent("");
  }

  return (
    <div>
      {!expanded && notes.length === 0 && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="text-xs text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
        >
          Add note...
        </button>
      )}
      {!expanded && notes.length > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="max-w-[200px] truncate text-left text-xs text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
          title={notes[0].content}
        >
          {notes[0].content}
        </button>
      )}
      {expanded && (
        <div className="space-y-2">
          <form onSubmit={handleSubmit} className="flex gap-1.5">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write a note..."
              rows={2}
              className="flex-1 resize-none rounded-md border border-neutral-200 bg-white px-2.5 py-1.5 text-xs text-neutral-700 outline-none focus:border-gold/30 focus:ring-1 focus:ring-gold/30 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300"
            />
            <button
              type="submit"
              disabled={loading || !content.trim()}
              className="self-end rounded-md bg-gold p-1.5 text-white transition-colors hover:bg-gold-hover disabled:opacity-50"
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          </form>
          {notes.length > 0 && (
            <div className="max-h-32 space-y-1.5 overflow-auto">
              {notes.map((note) => (
                <div
                  key={note.id}
                  className="rounded-md bg-neutral-50 px-2.5 py-1.5 text-xs dark:bg-neutral-800"
                >
                  <p className="text-neutral-700 dark:text-neutral-300">{note.content}</p>
                  <p className="mt-0.5 text-neutral-400">{timeAgo(note.createdAt)}</p>
                </div>
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={() => setExpanded(false)}
            className="text-xs text-neutral-400 hover:text-neutral-600"
          >
            Collapse
          </button>
        </div>
      )}
    </div>
  );
}
