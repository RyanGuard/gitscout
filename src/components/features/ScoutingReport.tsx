"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { Sparkles, Copy, Check, RefreshCw, Share2 } from "lucide-react";

interface ProfileData {
  name: string | null;
  bio: string | null;
  location: string | null;
  company: string | null;
  followers: number;
  totalStars: number;
  publicRepos: number;
  hireable: boolean;
  createdAt?: string | null;
  languages: { language: string; percentage: number }[];
  repositories: {
    name: string;
    stars: number;
    language: string | null;
    description: string | null;
  }[];
}

interface ScoreData {
  score: number;
  tier: string;
  totalCommits: number;
  externalMergedPRs: number;
  recentActivity: number;
  impactScore: number;
  contributionScore: number;
  consistencyScore: number;
  technicalScore: number;
  reputationScore: number;
}

interface ScoutingReportProps {
  username: string;
  profileData: ProfileData;
  scoreData?: ScoreData | null;
}

export function ScoutingReport({
  username,
  profileData,
  scoreData,
}: ScoutingReportProps) {
  const { data: session } = useSession();
  const [report, setReport] = useState<string | null>(null);
  const [displayedText, setDisplayedText] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState<"copy" | "share" | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Check 24h cache on mount
  useEffect(() => {
    const cacheKey = `scouting_report_${username}`;
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      try {
        const { report: cachedReport, timestamp } = JSON.parse(cached);
        const age = Date.now() - timestamp;
        if (age < 24 * 60 * 60 * 1000) {
          setReport(cachedReport);
          setDisplayedText(cachedReport);
        } else {
          localStorage.removeItem(cacheKey);
        }
      } catch {
        localStorage.removeItem(cacheKey);
      }
    }
  }, [username]);

  const generate = useCallback(async () => {
    setLoading(true);
    setError(null);
    setReport(null);
    setDisplayedText("");

    try {
      const res = await fetch("/api/scouting-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, profileData, scoreData }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to generate report");
      }

      const data = await res.json();
      const newReport = data.report as string;
      setReport(newReport);

      // Cache for 24 hours
      const cacheKey = `scouting_report_${username}`;
      localStorage.setItem(
        cacheKey,
        JSON.stringify({ report: newReport, timestamp: Date.now() })
      );

      // Typewriter animation
      let i = 0;
      const interval = setInterval(() => {
        i++;
        setDisplayedText(newReport.slice(0, i));
        if (i >= newReport.length) clearInterval(interval);
      }, 1500 / newReport.length); // ~1.5s total duration
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, [username, profileData, scoreData]);

  const copyToClipboard = useCallback(async () => {
    if (!report) return;
    await navigator.clipboard.writeText(report);
    setCopied("copy");
    setTimeout(() => setCopied(null), 2000);
  }, [report]);

  const shareReport = useCallback(async () => {
    if (!report) return;
    const displayName = profileData.name || username;
    const score = scoreData?.score ?? 0;
    const formatted = `\u{1F984} GitScout Scouting Report \u{2014} ${displayName} (Score: ${score}/100)
\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}
${report}
\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}
Sourced via GitScout \u{00B7} gitscout.dev`;
    await navigator.clipboard.writeText(formatted);
    setCopied("share");
    setTimeout(() => setCopied(null), 2000);
  }, [report, profileData.name, username, scoreData?.score]);

  if (!session) return null;

  return (
    <div>
      {!report && !loading && (
        <button
          onClick={generate}
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
        >
          <Sparkles className="h-4 w-4" />
          Generate Scouting Report
        </button>
      )}

      {loading && (
        <div className="mt-4 rounded-lg border-l-4 border-emerald-500 border border-neutral-200 bg-white p-5 dark:border-neutral-700 dark:bg-neutral-900 dark:border-l-emerald-500">
          <div className="flex items-center gap-2 text-sm text-neutral-500">
            <Sparkles className="h-4 w-4 animate-pulse text-emerald-500" />
            Writing report...
          </div>
        </div>
      )}

      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
          {error}
        </div>
      )}

      {report && !loading && (
        <div className="mt-4 rounded-lg border-l-4 border-emerald-500 border border-neutral-200 bg-white p-5 dark:border-neutral-700 dark:bg-neutral-900 dark:border-l-emerald-500">
          <p className="text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">
            {displayedText}
            {displayedText.length < report.length && (
              <span className="inline-block h-4 w-0.5 animate-pulse bg-emerald-500 ml-0.5" />
            )}
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              onClick={copyToClipboard}
              className="inline-flex items-center gap-1.5 rounded-md bg-neutral-100 px-3 py-1.5 text-xs font-medium text-neutral-700 transition-colors hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
            >
              {copied === "copy" ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-500" /> Copied!
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" /> Copy to clipboard
                </>
              )}
            </button>

            <button
              onClick={shareReport}
              className="inline-flex items-center gap-1.5 rounded-md bg-neutral-100 px-3 py-1.5 text-xs font-medium text-neutral-700 transition-colors hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
            >
              {copied === "share" ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-500" /> Copied!
                </>
              ) : (
                <>
                  <Share2 className="h-3.5 w-3.5" /> Share
                </>
              )}
            </button>

            <button
              onClick={generate}
              className="inline-flex items-center gap-1.5 rounded-md bg-neutral-100 px-3 py-1.5 text-xs font-medium text-neutral-700 transition-colors hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Regenerate
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
