"use client";
import { Target } from "lucide-react";
import Link from "next/link";

export default function MatchError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 text-center">
      <div className="rounded-full bg-red-500/10 p-4 mb-4">
        <Target className="h-8 w-8 text-red-400" />
      </div>
      <h2 className="text-lg font-semibold text-neutral-200">Match error</h2>
      <p className="mt-2 text-sm text-neutral-500 max-w-md">{error.message || "Matching failed."}</p>
      <div className="flex gap-3 mt-6">
        <button onClick={reset} className="rounded-lg bg-gold px-4 py-2 text-sm font-medium text-white hover:bg-gold-hover transition-colors">Retry</button>
        <Link href="/match" className="rounded-lg border border-neutral-700 px-4 py-2 text-sm font-medium text-neutral-400 hover:text-white transition-colors">Try again</Link>
      </div>
    </div>
  );
}
