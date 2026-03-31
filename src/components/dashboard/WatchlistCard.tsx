"use client";

import { Star, ArrowRight, User } from "lucide-react";
import Link from "next/link";
import type { FavoriteItem } from "./types";

// ─── Helpers ───

function getInitials(name: string | null, username: string): string {
  if (name) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  }
  return username.slice(0, 2).toUpperCase();
}

// ─── Language colors ───

const LANGUAGE_COLORS: Record<string, string> = {
  TypeScript: "bg-blue-400",
  JavaScript: "bg-yellow-400",
  Python: "bg-green-400",
  Rust: "bg-orange-400",
  Go: "bg-cyan-400",
  Java: "bg-red-400",
  Ruby: "bg-red-500",
  "C++": "bg-pink-400",
  C: "bg-gray-400",
  "C#": "bg-purple-400",
  Swift: "bg-orange-500",
  Kotlin: "bg-violet-400",
  PHP: "bg-indigo-400",
  Shell: "bg-emerald-400",
};

function languageDotColor(lang: string | null): string {
  if (!lang) return "bg-text-dim";
  return LANGUAGE_COLORS[lang] || "bg-text-dim";
}

// ─── Component ───

export function WatchlistCard({ favorites }: { favorites: FavoriteItem[] }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
            Your Watchlist
          </h3>
          {favorites.length > 0 && (
            <span className="rounded-full bg-surface-secondary px-2 py-0.5 text-[10px] font-medium text-text-muted">
              {favorites.length}
            </span>
          )}
        </div>
        <Link
          href="/favorites"
          className="flex items-center gap-1 text-xs text-text-muted hover:text-gold transition-colors"
        >
          View all
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      {/* List */}
      {favorites.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-6 text-center">
          <Star className="h-6 w-6 text-text-dim mb-2" />
          <p className="text-sm text-text-muted">
            Save developers to build your watchlist
          </p>
        </div>
      ) : (
        <div className="space-y-1">
          {favorites.map((fav) => {
            const dev = fav.developer;
            return (
              <Link
                key={fav.id}
                href={`/profile/${dev.username}`}
                className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-surface-secondary transition-colors"
              >
                {/* Avatar */}
                {dev.avatarUrl ? (
                  <img
                    src={dev.avatarUrl}
                    alt={dev.name || dev.username}
                    className="h-8 w-8 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-secondary text-xs font-medium text-text-muted">
                    {getInitials(dev.name, dev.username)}
                  </div>
                )}

                {/* Info */}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-text truncate">
                    {dev.name || dev.username}
                  </p>
                  {dev.primaryLanguage && (
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`inline-block h-2 w-2 rounded-full ${languageDotColor(dev.primaryLanguage)}`}
                      />
                      <span className="text-xs text-text-muted">
                        {dev.primaryLanguage}
                      </span>
                    </div>
                  )}
                </div>

                {/* Score */}
                <span className="text-xs font-medium text-gold">
                  {dev.score.toFixed(0)}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
