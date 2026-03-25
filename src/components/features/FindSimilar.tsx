"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Users, Loader2, AlertCircle } from "lucide-react";

interface FindSimilarProps {
  username: string;
  displayName: string;
}

export function FindSimilar({ username, displayName }: FindSimilarProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFindSimilar = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/find-similar?username=${encodeURIComponent(username)}`
      );

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Failed to find similar developers");
        setLoading(false);
        return;
      }

      const data = await res.json();

      // Build search URL with filter chips as query params
      const params = new URLSearchParams();

      // Use the first filter's language as the search query
      const langFilter = data.filters?.find(
        (f: { label: string }) => f.label === "Language"
      );
      if (langFilter) {
        params.set("q", langFilter.value);
      }

      // Pass location if available
      const locFilter = data.filters?.find(
        (f: { label: string }) => f.label === "Location"
      );
      if (locFilter) {
        params.set("location", locFilter.value);
      }

      // Mark this as a "similar" search so the search page can show a banner
      params.set("similarTo", username);
      params.set("similarName", displayName);

      if (data.locationSkipped) {
        params.set("locationSkipped", "true");
      }

      router.push(`/search?${params.toString()}`);
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }, [username, displayName, router]);

  return (
    <div className="inline-flex flex-col items-start">
      <button
        onClick={handleFindSimilar}
        disabled={loading}
        className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50 disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Users className="h-4 w-4" />
        )}
        {loading ? "Finding..." : "Find Similar"}
      </button>

      {error && (
        <div className="mt-2 flex items-center gap-1.5 text-xs text-red-400">
          <AlertCircle className="h-3.5 w-3.5" />
          {error}
        </div>
      )}
    </div>
  );
}
