"use client";

import { cn } from "@/lib/utils";

// ─── Props ───

interface LinkedInPreviewProps {
  message: string;
  candidateName: string;
}

// ─── Component ───

export function LinkedInPreview({ message, candidateName }: LinkedInPreviewProps) {
  return (
    <div className="rounded-lg border border-border bg-surface p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-text-muted mb-2">LinkedIn Preview</p>
      <div className="rounded-lg bg-white dark:bg-neutral-800 p-3 border border-neutral-200 dark:border-neutral-700">
        <div className="flex items-center gap-2 mb-2">
          <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-xs font-bold text-blue-600">You</div>
          <div className="text-xs text-neutral-600 dark:text-neutral-400">wants to connect</div>
        </div>
        <p className="text-sm text-neutral-900 dark:text-neutral-100">{message}</p>
        <div className="mt-2 flex items-center justify-between">
          <span className={cn("text-[10px]", message.length > 200 ? "text-danger" : "text-text-muted")}>
            {message.length}/200 characters
          </span>
          {message.length > 200 && <span className="text-[10px] text-danger">Over limit!</span>}
        </div>
      </div>
    </div>
  );
}
