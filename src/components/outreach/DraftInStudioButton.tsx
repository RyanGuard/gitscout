"use client";

import Link from "next/link";
import { PenLine } from "lucide-react";
import { cn } from "@/lib/utils";
import { buildOutreachUrl, type CandidateData } from "@/lib/outreach/candidateNormalizer";

interface DraftInStudioButtonProps {
  candidate: CandidateData;
  variant?: "icon" | "button" | "compact";
  className?: string;
}

export function DraftInStudioButton({
  candidate,
  variant = "icon",
  className,
}: DraftInStudioButtonProps) {
  const href = buildOutreachUrl(candidate);

  if (variant === "icon") {
    return (
      <Link
        href={href}
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "inline-flex items-center justify-center text-neutral-400 transition-colors hover:text-gold",
          className
        )}
        title="Draft in Outreach Studio"
      >
        <PenLine className="h-3.5 w-3.5" />
      </Link>
    );
  }

  if (variant === "compact") {
    return (
      <Link
        href={href}
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium text-text-muted transition-colors hover:bg-gold-bg hover:text-gold",
          className
        )}
        title="Draft in Outreach Studio"
      >
        <PenLine className="h-3 w-3" />
        Studio
      </Link>
    );
  }

  // variant === "button"
  return (
    <Link
      href={href}
      onClick={(e) => e.stopPropagation()}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg border border-gold-border bg-gold-bg px-3 py-2 text-xs font-medium text-gold transition-colors hover:bg-gold-bg-strong",
        className
      )}
    >
      <PenLine className="h-3.5 w-3.5" />
      Draft in Studio
    </Link>
  );
}
