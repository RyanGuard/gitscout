"use client";

import { useState } from "react";
import { ThumbsUp, ThumbsDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface FeedbackPromptProps {
  feature: string;
  question: string;
  context?: Record<string, unknown>;
  className?: string;
}

export function FeedbackPrompt({ feature, question, context, className }: FeedbackPromptProps) {
  const [submitted, setSubmitted] = useState(false);
  const [showComment, setShowComment] = useState(false);
  const [comment, setComment] = useState("");
  const [rating, setRating] = useState<number | null>(null);

  async function submit(r: number) {
    setRating(r);
    if (r === -1) {
      setShowComment(true);
      return;
    }
    await sendFeedback(r, "");
  }

  async function sendFeedback(r: number, c: string) {
    setSubmitted(true);
    try {
      await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feature, rating: r, comment: c || null, context }),
      });
    } catch {
      // Non-fatal
    }
  }

  if (submitted) {
    return (
      <div className={cn("flex items-center gap-1.5 text-[10px] text-neutral-500", className)}>
        <span>Thanks for the feedback</span>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-neutral-500">{question}</span>
        <button
          onClick={() => submit(1)}
          className={cn(
            "rounded p-1 transition-colors hover:bg-emerald-500/10",
            rating === 1 ? "text-emerald-400" : "text-neutral-600 hover:text-emerald-400"
          )}
        >
          <ThumbsUp className="h-3 w-3" />
        </button>
        <button
          onClick={() => submit(-1)}
          className={cn(
            "rounded p-1 transition-colors hover:bg-red-500/10",
            rating === -1 ? "text-red-400" : "text-neutral-600 hover:text-red-400"
          )}
        >
          <ThumbsDown className="h-3 w-3" />
        </button>
      </div>
      {showComment && (
        <div className="flex gap-1.5">
          <input
            type="text"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="What could be better?"
            className="flex-1 rounded bg-neutral-800/50 border border-neutral-700/50 px-2 py-1 text-[10px] text-neutral-300 outline-none focus:border-gold/30"
            onKeyDown={(e) => {
              if (e.key === "Enter" && comment.trim()) {
                sendFeedback(rating!, comment.trim());
              }
            }}
            autoFocus
          />
          <button
            onClick={() => sendFeedback(rating!, comment.trim())}
            className="rounded bg-neutral-800 px-2 py-1 text-[10px] text-neutral-400 hover:text-white transition-colors"
          >
            Send
          </button>
        </div>
      )}
    </div>
  );
}
