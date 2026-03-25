"use client";

import { useSession } from "next-auth/react";
import { Heart } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";

interface FavoriteButtonProps {
  developerId: string;
  className?: string;
}

export function FavoriteButton({ developerId, className }: FavoriteButtonProps) {
  const { data: session } = useSession();
  const [favorited, setFavorited] = useState(false);
  const [loading, setLoading] = useState(false);

  const checkFavorite = useCallback(async () => {
    if (!session?.user?.id) return;
    try {
      const res = await fetch("/api/favorites");
      const data = await res.json();
      const isFav = (data.favorites || []).some(
        (f: { developerId: string }) => f.developerId === developerId
      );
      setFavorited(isFav);
    } catch {
      // ignore
    }
  }, [session?.user?.id, developerId]);

  useEffect(() => {
    checkFavorite();
  }, [checkFavorite]);

  if (!session) return null;

  async function toggle() {
    setLoading(true);
    try {
      if (favorited) {
        await fetch(`/api/favorites/${developerId}`, { method: "DELETE" });
        setFavorited(false);
      } else {
        await fetch("/api/favorites", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ developerId }),
        });
        setFavorited(true);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
        favorited
          ? "border-red-200 bg-red-50 text-red-600 hover:bg-red-100 dark:border-red-800 dark:bg-red-950 dark:text-red-400"
          : "border-neutral-200 text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800",
        className
      )}
    >
      <Heart className={cn("h-4 w-4", favorited && "fill-current")} />
      {favorited ? "Saved" : "Save"}
    </button>
  );
}
