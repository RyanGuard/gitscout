"use client";

import { useState } from "react";
import type { ParsedRequirements, AshbyJob } from "@/types";

interface JobInputProps {
  onParsed: (requirements: ParsedRequirements) => void;
  ashbyJobs: AshbyJob[] | null;
}

export function JobInput({ onParsed, ashbyJobs }: JobInputProps) {
  const [mode, setMode] = useState<"paste" | "ashby">(
    ashbyJobs && ashbyJobs.length > 0 ? "ashby" : "paste"
  );
  const [text, setText] = useState("");
  const [selectedJobId, setSelectedJobId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasAshby = ashbyJobs && ashbyJobs.length > 0;

  async function handleParse() {
    setError(null);
    setLoading(true);

    try {
      if (mode === "paste") {
        if (!text.trim()) {
          setError("Please paste a job description");
          setLoading(false);
          return;
        }
        const res = await fetch("/api/match/parse", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        });
        if (!res.ok) throw new Error("Failed to parse");
        const requirements: ParsedRequirements = await res.json();
        onParsed(requirements);
      } else {
        if (!selectedJobId) {
          setError("Please select a job");
          setLoading(false);
          return;
        }
        // Fetch JD from Ashby and parse
        const res = await fetch("/api/match", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jobId: selectedJobId }),
        });
        if (!res.ok) throw new Error("Failed to fetch job description");
        const data = await res.json();
        onParsed(data.requirements);
      }
    } catch {
      setError("Failed to parse job description. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-700 dark:bg-neutral-900">
      <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">
        Job Description
      </h2>
      <p className="mt-1 text-sm text-neutral-500">
        Paste a job description or select from Ashby to find matching candidates.
      </p>

      {/* Mode toggle */}
      {hasAshby && (
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={() => setMode("paste")}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              mode === "paste"
                ? "bg-gold text-white"
                : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-700"
            }`}
          >
            Paste JD
          </button>
          <button
            type="button"
            onClick={() => setMode("ashby")}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              mode === "ashby"
                ? "bg-gold text-white"
                : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-700"
            }`}
          >
            From Ashby
          </button>
        </div>
      )}

      {/* Input area */}
      <div className="mt-4">
        {mode === "paste" ? (
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste the full job description here..."
            rows={8}
            className="w-full rounded-lg border border-neutral-300 bg-white px-4 py-3 text-sm text-neutral-900 placeholder-neutral-400 focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/20 dark:border-neutral-600 dark:bg-neutral-800 dark:text-white dark:placeholder-neutral-500"
          />
        ) : (
          <select
            value={selectedJobId}
            onChange={(e) => setSelectedJobId(e.target.value)}
            className="w-full rounded-lg border border-neutral-300 bg-white px-4 py-3 text-sm text-neutral-900 focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/20 dark:border-neutral-600 dark:bg-neutral-800 dark:text-white"
          >
            <option value="">Select a job...</option>
            {ashbyJobs?.map((job) => (
              <option key={job.id} value={job.id}>
                {job.title}
              </option>
            ))}
          </select>
        )}
      </div>

      {error && (
        <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      <button
        type="button"
        onClick={handleParse}
        disabled={loading}
        className="mt-4 rounded-lg bg-gold px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-gold-hover disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? "Parsing..." : "Parse Requirements"}
      </button>
    </div>
  );
}
