"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Sparkles, Loader2, GitFork } from "lucide-react";

interface DiscoveredDev {
  id: string;
  username: string;
  name: string | null;
  avatarUrl: string;
  bio: string | null;
  company: string | null;
  location: string | null;
  followers: number;
  score: number;
  tier: string;
  discoveredVia?: string;
}

interface DiscoverResult {
  developers: DiscoveredDev[];
  repos: Array<{ name: string; fullName: string; stars: number; description: string }>;
}

export function RecommendedProfiles({ query }: { query: string }) {
  const [data, setData] = useState<DiscoverResult | null>(null);
  const [loading, setLoading] = useState(false);
  const lastFetchedQueryRef = useRef("");

  useEffect(() => {
    if (!query || query === lastFetchedQueryRef.current) return;

    const coreQuery = query
      .replace(/\b(in|at|from|near)\s+[A-Z][a-z]+(\s+[A-Z][a-z]+)*/g, "")
      .replace(/\b(senior|junior|mid|staff|principal|lead|developer|engineer|engineers|developers)\b/gi, "")
      .trim();

    if (!coreQuery || coreQuery.length < 2) return;

    lastFetchedQueryRef.current = query;

    queueMicrotask(() => {
      setLoading(true);
      fetch(`/api/search/discover?q=${encodeURIComponent(coreQuery)}&limit=8`)
        .then((res) => (res.ok ? res.json() : null))
        .then((result) => {
          if (result) setData(result);
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    });
  }, [query]);

  if (!query) return null;

  return (
    <div className="w-72 shrink-0">
      <div className="sticky top-4 space-y-4">
        {/* Discovered via repos */}
        <div className="rounded-xl border border-neutral-200/50 bg-surface p-4 shadow-sm dark:border-neutral-800/80">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="h-4 w-4 text-gold" />
            <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Discovered by Code
            </h3>
          </div>

          {loading && (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-4 w-4 animate-spin text-gold" />
            </div>
          )}

          {!loading && !data && (
            <p className="text-xs text-neutral-400 py-3">
              Searching repos for contributors...
            </p>
          )}

          {!loading && data && data.developers.length === 0 && (
            <p className="text-xs text-neutral-400 py-3">
              No additional profiles found via repo discovery.
            </p>
          )}

          {!loading && data && data.developers.length > 0 && (
            <div className="space-y-2.5">
              {data.developers.map((dev) => (
                <Link
                  key={dev.id}
                  href={`/profile/${dev.username}`}
                  className="group flex items-start gap-2.5 rounded-lg p-1.5 -mx-1.5 transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={dev.avatarUrl}
                    alt={dev.username}
                    className="h-8 w-8 rounded-full border border-neutral-200/50 dark:border-neutral-700/50"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-neutral-900 dark:text-white truncate group-hover:text-gold transition-colors">
                      {dev.name || dev.username}
                    </p>
                    {dev.company && (
                      <p className="text-[10px] text-neutral-500 truncate">
                        {dev.company.replace(/^@/, "")}
                      </p>
                    )}
                    {dev.discoveredVia && (
                      <p className="mt-0.5 flex items-center gap-1 text-[10px] text-neutral-400">
                        <GitFork className="h-2.5 w-2.5" />
                        via {dev.discoveredVia}
                      </p>
                    )}
                  </div>
                  <span className={`shrink-0 text-[10px] font-bold tabular-nums ${
                    dev.score >= 75 ? "text-gold" : dev.score >= 60 ? "text-blue-500" : "text-neutral-400"
                  }`}>
                    {Math.round(dev.score)}
                  </span>
                </Link>
              ))}
            </div>
          )}

          {/* Source repos */}
          {!loading && data && data.repos && data.repos.length > 0 && (
            <div className="mt-3 pt-3 border-t border-neutral-200/50 dark:border-neutral-700/50">
              <p className="text-[10px] font-medium uppercase tracking-wide text-neutral-400 mb-1.5">
                Source repos
              </p>
              <div className="space-y-1">
                {data.repos.slice(0, 4).map((repo) => (
                  <a
                    key={repo.fullName}
                    href={`https://github.com/${repo.fullName}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between text-[10px] text-neutral-500 hover:text-gold transition-colors"
                  >
                    <span className="truncate">{repo.name}</span>
                    <span className="shrink-0 ml-1">⭐ {repo.stars > 1000 ? `${(repo.stars / 1000).toFixed(1)}k` : repo.stars}</span>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
