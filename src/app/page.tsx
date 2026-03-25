"use client";

import { useRouter } from "next/navigation";
import { GitBranch, Globe, Zap, Shield } from "lucide-react";
import { SearchInput } from "@/components/ui/SearchInput";

export default function Home() {
  const router = useRouter();

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
          Source engineering talent from GitHub. Search millions of developers by skill, location, or name.
        </p>

        <div className="mx-auto mb-10 w-full max-w-2xl">
          <SearchInput onSearch={handleSearch} />
        </div>

        <div className="mx-auto grid max-w-lg grid-cols-3 gap-4 text-center text-sm text-neutral-500">
          <div className="flex flex-col items-center gap-1.5">
            <Globe className="h-5 w-5 text-blue-500" />
            <span>Live GitHub search</span>
          </div>
          <div className="flex flex-col items-center gap-1.5">
            <Zap className="h-5 w-5 text-yellow-500" />
            <span>Apollo enrichment</span>
          </div>
          <div className="flex flex-col items-center gap-1.5">
            <Shield className="h-5 w-5 text-green-500" />
            <span>Push to Ashby</span>
          </div>
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-2 text-sm text-neutral-500 sm:gap-3">
          <span>Try:</span>
          {[
            "rust developers in San Francisco",
            "python machine learning",
            "TypeScript React",
            "go engineers in Berlin",
            "karpathy",
          ].map((term) => (
            <button
              key={term}
              onClick={() => handleSearch(term)}
              className="rounded-full border border-neutral-200 px-3 py-1 transition-all duration-200 hover:border-blue-300 hover:text-blue-600 hover:-translate-y-px dark:border-neutral-700"
            >
              {term}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
