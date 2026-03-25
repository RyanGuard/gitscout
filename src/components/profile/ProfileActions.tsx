"use client";

import { useSession } from "next-auth/react";
import { useState, useCallback } from "react";
import { Loader2, Download } from "lucide-react";
import { FavoriteButton } from "@/components/auth/FavoriteButton";
import { EnrichButton } from "@/components/profile/EnrichButton";
import { PushToAshbyButton } from "@/components/ashby/PushToAshbyButton";
import { AddToListButton } from "@/components/crm/AddToListButton";

interface ProfileActionsProps {
  developerId: string;
  username: string;
  isLocal: boolean;
}

export function ProfileActions({ developerId, username, isLocal }: ProfileActionsProps) {
  const { data: session } = useSession();
  const [localId, setLocalId] = useState<string | null>(isLocal ? developerId : null);
  const [indexing, setIndexing] = useState(false);

  const indexDeveloper = useCallback(async () => {
    if (localId || indexing) return;
    setIndexing(true);
    try {
      const res = await fetch("/api/index", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
      });
      const data = await res.json();
      if (data.id) {
        setLocalId(data.id);
      }
    } catch {
      // ignore
    } finally {
      setIndexing(false);
    }
  }, [localId, indexing, username]);

  if (!session) return null;

  // Not indexed yet — show an "Index" button
  if (!localId) {
    return (
      <button
        onClick={indexDeveloper}
        disabled={indexing}
        className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300 dark:hover:bg-blue-900"
      >
        {indexing ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Indexing...
          </>
        ) : (
          <>
            <Download className="h-4 w-4" />
            Index to unlock actions
          </>
        )}
      </button>
    );
  }

  // Indexed — show all action buttons
  return (
    <>
      <FavoriteButton developerId={localId} />
      <EnrichButton developerId={localId} />
      <PushToAshbyButton developerId={localId} />
      <AddToListButton developerId={localId} />
    </>
  );
}
