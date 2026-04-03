"use client";

import { useState, useEffect } from "react";
import { Mic, ExternalLink, Loader2, Users } from "lucide-react";
import { cn } from "@/lib/utils";

interface Speaker {
  name: string;
  title?: string;
  company?: string;
  source: "GitHub" | "Apollo";
  evidence: string;
  linkedinUrl?: string;
  githubUrl?: string;
}

interface SpeakersData {
  speakers: Speaker[];
  technology: string;
}

interface SpeakerDiscoveryProps {
  technology: string;
}

function SourceBadge({ source }: { source: "GitHub" | "Apollo" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium",
        source === "GitHub"
          ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
          : "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400"
      )}
    >
      {source}
    </span>
  );
}

function SpeakerRow({ speaker }: { speaker: Speaker }) {
  return (
    <div className="group flex items-start gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-800/40">
      {/* Avatar placeholder */}
      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gold-bg text-gold">
        <Users className="h-3.5 w-3.5" />
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-neutral-900 dark:text-white truncate">
            {speaker.name}
          </span>
          <SourceBadge source={speaker.source} />
        </div>

        {(speaker.title || speaker.company) && (
          <p className="mt-0.5 text-xs text-neutral-500 truncate">
            {speaker.title}
            {speaker.title && speaker.company && " at "}
            {speaker.company}
          </p>
        )}

        {speaker.evidence && (
          <p className="mt-1 text-xs italic text-neutral-400 line-clamp-1">
            {speaker.evidence}
          </p>
        )}
      </div>

      {/* Links */}
      <div className="flex flex-shrink-0 items-center gap-1.5 opacity-0 transition-opacity group-hover:opacity-100">
        {speaker.githubUrl && (
          <a
            href={speaker.githubUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center rounded-md p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-300"
            title="GitHub profile"
          >
            <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5" aria-hidden="true">
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
            </svg>
          </a>
        )}
        {speaker.linkedinUrl && (
          <a
            href={speaker.linkedinUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center rounded-md p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-300"
            title="LinkedIn profile"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
      </div>
    </div>
  );
}

export function SpeakerDiscovery({ technology }: SpeakerDiscoveryProps) {
  const [data, setData] = useState<SpeakersData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!technology) {
      queueMicrotask(() => setLoading(false));
      return;
    }

    queueMicrotask(() => {
    fetch(`/api/intelligence/speakers?technology=${encodeURIComponent(technology)}`)
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then(setData)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
    });
  }, [technology]);

  if (loading) {
    return (
      <div className="rounded-xl border border-neutral-200/50 bg-surface p-5 shadow-sm dark:border-neutral-800/80">
        <div className="flex items-center gap-2 mb-4">
          <Mic className="h-4 w-4 text-gold" />
          <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">
            Conference Speakers
          </h3>
        </div>
        <div className="flex items-center justify-center py-8 text-sm text-neutral-500">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Finding speakers for {technology}...
        </div>
      </div>
    );
  }

  if (error) return null;

  const speakers = data?.speakers ?? [];

  return (
    <div className="rounded-xl border border-neutral-200/50 bg-surface shadow-sm dark:border-neutral-800/80">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-4 dark:border-neutral-800">
        <div className="flex items-center gap-2">
          <Mic className="h-4 w-4 text-gold" />
          <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">
            Conference Speakers
          </h3>
          {speakers.length > 0 && (
            <span className="rounded-full bg-gold-bg px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-gold">
              {speakers.length}
            </span>
          )}
        </div>
        <span className="text-[10px] text-neutral-400 uppercase tracking-wider">
          {technology}
        </span>
      </div>

      {/* Speaker list */}
      {speakers.length > 0 ? (
        <div className="divide-y divide-neutral-100 dark:divide-neutral-800/60">
          {speakers.map((speaker, i) => (
            <SpeakerRow key={`${speaker.name}-${i}`} speaker={speaker} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <Mic className="mb-2 h-5 w-5 text-neutral-300 dark:text-neutral-600" />
          <p className="text-sm text-neutral-500">
            No speakers found for <span className="font-medium text-neutral-700 dark:text-neutral-300">{technology}</span>
          </p>
        </div>
      )}
    </div>
  );
}
