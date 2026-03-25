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
          <GitBranch className="h-10 w-10 sm:h-12 sm:w-12" />
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">GitScout</h1>
        </div>
        <p className="mb-8 text-base text-neutral-600 sm:text-lg dark:text-neutral-400">
          Discover talented developers. Search by language, location, or expertise.
        </p>

        <div className="mx-auto mb-12 w-full max-w-2xl">
          <SearchInput onSearch={handleSearch} />
        </div>

        {stats && stats.totalDevelopers > 0 && (
          <div className="grid grid-cols-1 gap-3 min-[400px]:grid-cols-2 sm:grid-cols-4">
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

        <div className="mt-12 flex flex-wrap items-center justify-center gap-2 text-sm text-neutral-500 sm:gap-3">
          <span>Try:</span>
          {["rust developers", "San Francisco", "machine learning", "TypeScript"].map(
            (term) => (
              <button
                key={term}
                onClick={() => handleSearch(term)}
                className="rounded-full border border-neutral-200 px-3 py-1 transition-all duration-200 hover:border-blue-300 hover:text-blue-600 hover:-translate-y-px dark:border-neutral-700"
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
