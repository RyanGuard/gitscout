"use client";

import { cn } from "@/lib/utils";

interface CompactCandidateRowProps {
  name: string;
  subtitle: string;
  avatarUrl?: string | null;
  initials: string;
  badge?: { label: string; color: string };
  isActive?: boolean;
  onClick: () => void;
}

export function CompactCandidateRow({
  name,
  subtitle,
  avatarUrl,
  initials,
  badge,
  isActive,
  onClick,
}: CompactCandidateRowProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors",
        isActive
          ? "bg-gold-bg border-l-2 border-l-gold"
          : "border-l-2 border-l-transparent hover:bg-surface"
      )}
    >
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={avatarUrl}
          alt={name}
          className="h-6 w-6 rounded-full shrink-0"
        />
      ) : (
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gold-bg text-[8px] font-bold text-gold">
          {initials}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-text truncate">{name}</p>
        <p className="text-[10px] text-text-muted truncate">{subtitle}</p>
      </div>
      {badge && (
        <span className={cn("shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded", badge.color)}>
          {badge.label}
        </span>
      )}
    </button>
  );
}
