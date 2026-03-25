"use client";

import { useRouter } from "next/navigation";
import { GitBranch, Search, Users, Star, Code } from "lucide-react";
import { SearchInput } from "@/components/ui/SearchInput";
import { StatCard } from "@/components/ui/StatCard";
import { useEffect, useState } from "react";
import type { PipelineStats } from "@/types";
import { formatNumber } from "@/lib/utils";

export default function Home() {
  const router = useRouter();
  const [stats, setStats] = useState<PipelineStats | null>(null);

  useEffect(() => {
    fetch("/api/stats")
      .then((r) => r.json())
      .then(setStats)
      .catch(() => {});
  }, []);

  function handleSearch(query: string) {
    router.push(`/search?q=${encodeURIComponent(query)}`);
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4">
      <div className="w-full max-w-3xl text-center">
        <div className="mb-6 flex items-center justify-center gap-3">
          <GitBranch className="h-12 w-12" />
          <h1 className="text-5xl font-bold tracking-tight">GitScout</h1>
        </div>
        <p className="mb-8 text-lg text-neutral-600 dark:text-neutral-400">
          Discover talented developers. Search by language, location, or expertise.
        </p>

        <div className="flex justify-center mb-12">
          <SearchInput onSearch={handleSearch} />
        </div>

        {stats && stats.totalDevelopers > 0 && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard
              label="Developers"
              value={formatNumber(stats.totalDevelopers)}
              icon={<Users className="h-5 w-5" />}
            />
            <StatCard
              label="Repositories"
              value={formatNumber(stats.totalRepositories)}
              icon={<Code className="h-5 w-5" />}
            />
            <StatCard
              label="Activities"
              value={formatNumber(stats.totalActivities)}
              icon={<Star className="h-5 w-5" />}
            />
            <StatCard
              label="Indexed"
              value={stats.lastSyncedAt ? "Live" : "Pending"}
              icon={<Search className="h-5 w-5" />}
            />
          </div>
        )}

        <div className="mt-12 flex flex-wrap items-center justify-center gap-3 text-sm text-neutral-500">
          <span>Try:</span>
          {["rust developers", "San Francisco", "machine learning", "TypeScript"].map(
            (term) => (
              <button
                key={term}
                onClick={() => handleSearch(term)}
                className="rounded-full border border-neutral-200 px-3 py-1 transition-colors hover:border-blue-300 hover:text-blue-600 dark:border-neutral-700"
              >
                {term}
              </button>
            )
          )}
        </div>
      </div>
    </div>
  );
}
