"use client";

import { useState } from "react";
import { Send, Loader2, Check, AlertCircle } from "lucide-react";
import type { DeveloperProfile } from "@/types";

interface AddToSequenceFromSearchProps {
  developer: DeveloperProfile;
  className?: string;
}

/**
 * Bridge between Developer Search and Outreach Studio.
 *
 * When clicked:
 * 1. Indexes the developer (persists to DB if not already)
 * 2. Enriches via Apollo (gets LinkedIn URL, title, company)
 * 3. Navigates to Outreach Studio with the enriched candidate data
 *
 * This closes the gap where search results are ephemeral GitHub data
 * without the LinkedIn URLs needed for outreach sequences.
 */
export function AddToSequenceFromSearch({ developer, className }: AddToSequenceFromSearchProps) {
  const [status, setStatus] = useState<"idle" | "enriching" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (status === "enriching") return;

    setStatus("enriching");
    setError(null);

    try {
      // Step 1: Index the developer (persists GitHub data to DB)
      const indexRes = await fetch("/api/index", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: developer.username }),
      });

      if (!indexRes.ok) {
        // Non-fatal — developer may already be indexed
        console.warn("[add-to-sequence] Index failed:", await indexRes.text().catch(() => ""));
      }

      // Step 2: Enrich via Apollo (gets LinkedIn, title, company, email)
      const enrichRes = await fetch(`/api/enrich/${developer.id || developer.username}`, {
        method: "POST",
      });

      let linkedinUrl = "";
      let title = "";
      let company = developer.company?.replace(/^@/, "") || "";

      if (enrichRes.ok) {
        const enrichData = await enrichRes.json();
        linkedinUrl = enrichData.linkedinUrl || enrichData.contactInfo?.linkedinUrl || "";
        title = enrichData.currentTitle || enrichData.contactInfo?.currentTitle || "";
        company = enrichData.normalizedCompany || enrichData.contactInfo?.normalizedCompany || company;
      }

      // Step 3: Navigate to Outreach Studio with candidate data
      const params = new URLSearchParams();
      params.set("name", developer.name || developer.username);
      if (title) params.set("title", title);
      if (company) params.set("company", company);
      if (developer.location) params.set("location", developer.location);
      if (linkedinUrl) params.set("linkedin", linkedinUrl);
      if (developer.email) params.set("email", developer.email);
      params.set("github", `https://github.com/${developer.username}`);
      params.set("source", "search");
      params.set("devId", developer.id);
      params.set("ctx", JSON.stringify({
        score: developer.score,
        bio: developer.bio,
        languages: developer.languages?.slice(0, 5).map((l) => l.language),
        topRepos: developer.repositories?.slice(0, 3).map((r) => ({
          name: r.name, stars: r.stars, language: r.language,
        })),
      }));

      setStatus("done");

      // Brief delay so user sees the checkmark
      setTimeout(() => {
        window.location.href = `/outreach/new?${params.toString()}`;
      }, 300);

    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Failed to enrich");
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={status === "enriching"}
      className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium transition-colors ${
        status === "done"
          ? "bg-emerald-500/10 text-emerald-500"
          : status === "error"
          ? "bg-red-500/10 text-red-400"
          : "text-text-muted hover:bg-gold-bg hover:text-gold"
      } ${className || ""}`}
      title={error || "Enrich & draft outreach"}
    >
      {status === "enriching" ? (
        <><Loader2 className="h-3 w-3 animate-spin" /> Enriching...</>
      ) : status === "done" ? (
        <><Check className="h-3 w-3" /> Ready</>
      ) : status === "error" ? (
        <><AlertCircle className="h-3 w-3" /> {error}</>
      ) : (
        <><Send className="h-3 w-3" /> Outreach</>
      )}
    </button>
  );
}
