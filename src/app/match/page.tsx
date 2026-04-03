"use client";

import { useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { JobInput } from "@/components/match/JobInput";
import { RequirementsEditor } from "@/components/match/RequirementsEditor";
import { MatchCard } from "@/components/match/MatchCard";
import type { ParsedRequirements, MatchResult } from "@/types";

interface MatchResponse {
  requirements: ParsedRequirements;
  candidates: Array<{
    developer: MatchResult["developer"];
    fitScore: number;
    matchedLanguages: string[];
    matchedSkills: string[];
    locationMatch: boolean;
    reasons: string[];
  }>;
  total: number;
}

export default function MatchPage() {
  const { status } = useSession();
  const router = useRouter();
  const [requirements, setRequirements] = useState<ParsedRequirements | null>(null);
  const [results, setResults] = useState<MatchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleParsed(parsed: ParsedRequirements) {
    setRequirements(parsed);
    setResults(null);
    setError(null);
  }

  const handleSearch = useCallback(async () => {
    if (!requirements) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requirements }),
      });
      if (!res.ok) throw new Error("Search failed");
      const data: MatchResponse = await res.json();
      setResults(data);
    } catch {
      setError("Failed to find matches. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [requirements]);

  // Auth guard
  if (status === "loading") {
    return (
      <div className="flex flex-1 items-center justify-center py-20">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-neutral-300 border-t-gold" />
      </div>
    );
  }
  if (status === "unauthenticated") {
    router.push("/api/auth/signin?callbackUrl=/match");
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
    <div className="mx-auto w-full max-w-4xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">
          Match Candidates
        </h1>
        <p className="mt-1 text-neutral-500">
          Parse a job description to find the best matching developers in your database.
        </p>
      </div>

      {/* Step 1: Job input */}
      <JobInput onParsed={handleParsed} ashbyJobs={null} />

      {/* Step 2: Requirements editor */}
      {requirements && (
        <div className="mt-6">
          <RequirementsEditor
            requirements={requirements}
            onChange={setRequirements}
            onSearch={handleSearch}
            loading={loading}
          />
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Step 3: Results */}
      {results && (
        <div className="mt-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">
              Results
            </h2>
            <span className="text-sm text-neutral-500">
              {results.total} candidate{results.total !== 1 ? "s" : ""} found
            </span>
          </div>

          {results.candidates.length === 0 ? (
            <div className="rounded-xl border border-neutral-200 bg-white p-12 text-center dark:border-neutral-700 dark:bg-neutral-900">
              <p className="text-neutral-500">
                No matching candidates found. Try adjusting the requirements or broadening the search.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {results.candidates.map((candidate) => (
                <MatchCard
                  key={candidate.developer.id}
                  developer={candidate.developer}
                  fitScore={candidate.fitScore}
                  matchedLanguages={candidate.matchedLanguages}
                  matchedSkills={candidate.matchedSkills}
                  locationMatch={candidate.locationMatch}
                  reasons={candidate.reasons}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
    </div>
  );
}
