"use client";

import { useSession } from "next-auth/react";
import { useState, useEffect, useCallback } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { showSuccess, showError as toastError } from "@/lib/toast";
import { ContactCard } from "@/components/profile/ContactCard";
import type { ContactInfo } from "@/types";

interface EnrichButtonProps {
  developerId: string;
  className?: string;
}

export function EnrichButton({ developerId, className }: EnrichButtonProps) {
  const { data: session } = useSession();
  const [loading, setLoading] = useState(false);
  const [contactInfo, setContactInfo] = useState<ContactInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);

  const checkStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/enrich/status/${developerId}`);
      const data = await res.json();
      if (data.enriched && data.contactInfo) {
        setContactInfo(data.contactInfo);
      }
    } catch {
      // Ignore — just means no enrichment data yet
    } finally {
      setChecking(false);
    }
  }, [developerId]);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  if (!session) return null;
  if (checking) return null;

  async function handleEnrich() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/enrich/${developerId}`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Enrichment failed");
        return;
      }
      // Refresh status to get the full contact info
      const statusRes = await fetch(`/api/enrich/status/${developerId}`);
      const statusData = await statusRes.json();
      if (statusData.enriched) {
        setContactInfo(statusData.contactInfo);
        showSuccess("Contact info enriched");
      }
    } catch {
      setError("Enrichment failed — please try again");
      toastError("Enrichment failed");
    } finally {
      setLoading(false);
    }
  }

  if (contactInfo) {
    return (
      <div className={cn("w-full", className)}>
        <ContactCard contactInfo={contactInfo} onReEnrich={handleEnrich} loading={loading} />
      </div>
    );
  }

  return (
    <div className={className}>
      <button
        onClick={handleEnrich}
        disabled={loading}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
          "border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100",
          "dark:border-purple-800 dark:bg-purple-950 dark:text-purple-300 dark:hover:bg-purple-900",
          loading && "cursor-not-allowed opacity-60",
        )}
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Enriching...
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4" />
            Enrich Profile
          </>
        )}
      </button>
      {error && (
        <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
}
