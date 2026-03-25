"use client";

import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { GitBranch, Globe, Zap, Shield, Search, Heart, Clock, ArrowRight } from "lucide-react";
import { SearchInput } from "@/components/ui/SearchInput";
import { useEffect, useState } from "react";
import Link from "next/link";

// ── Logged-out landing page ──
function LandingHero() {
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

// ── Logged-in dashboard ──
interface FavoriteDev {
  id: string;
  developer: {
    username: string;
    name: string | null;
    avatarUrl: string | null;
    score: number;
    primaryLanguage: string | null;
    location: string | null;
  };
  createdAt: string;
}

function Dashboard() {
  const router = useRouter();
  const [favorites, setFavorites] = useState<FavoriteDev[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/favorites")
      .then((r) => r.json())
      .then((data) => setFavorites(data.favorites || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function handleSearch(query: string) {
    router.push(`/search?q=${encodeURIComponent(query)}`);
  }

  const rolePresets = [
    { label: "Frontend Engineer", query: "react typescript" },
    { label: "Backend Engineer", query: "go python backend" },
    { label: "ML Engineer", query: "python machine learning" },
    { label: "DevOps / Infra", query: "kubernetes terraform go" },
    { label: "Rust Systems", query: "rust systems" },
    { label: "Mobile Developer", query: "swift kotlin mobile" },
  ];

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      {/* Search bar */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-neutral-900 dark:text-white mb-1">
          Good {new Date().getHours() < 12 ? "morning" : new Date().getHours() < 17 ? "afternoon" : "evening"}
        </h1>
        <p className="text-sm text-neutral-500 mb-4">Start sourcing or pick up where you left off.</p>
        <div className="max-w-2xl">
          <SearchInput onSearch={handleSearch} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Quick searches */}
        <div className="lg:col-span-2">
          <div className="rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-700 dark:bg-neutral-900">
            <div className="flex items-center gap-2 mb-4">
              <Search className="h-4 w-4 text-neutral-400" />
              <h2 className="text-sm font-semibold text-neutral-900 dark:text-white">Quick Search by Role</h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {rolePresets.map((preset) => (
                <button
                  key={preset.label}
                  onClick={() => handleSearch(preset.query)}
                  className="flex items-center justify-between rounded-lg border border-neutral-200 px-3 py-2.5 text-left text-sm transition-colors hover:border-blue-300 hover:bg-blue-50 dark:border-neutral-700 dark:hover:border-blue-600 dark:hover:bg-blue-950"
                >
                  <span className="text-neutral-700 dark:text-neutral-300">{preset.label}</span>
                  <ArrowRight className="h-3.5 w-3.5 text-neutral-400" />
                </button>
              ))}
            </div>
          </div>

          {/* Recent favorites */}
          {favorites.length > 0 && (
            <div className="mt-4 rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-700 dark:bg-neutral-900">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Heart className="h-4 w-4 text-red-400" />
                  <h2 className="text-sm font-semibold text-neutral-900 dark:text-white">Saved Developers</h2>
                </div>
                <Link href="/favorites" className="text-xs text-blue-600 hover:text-blue-700">
                  View all →
                </Link>
              </div>
              <div className="space-y-2">
                {favorites.slice(0, 5).map((fav) => (
                  <Link
                    key={fav.id}
                    href={`/profile/${fav.developer.username}`}
                    className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-800"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={fav.developer.avatarUrl || `https://github.com/${fav.developer.username}.png`}
                      alt=""
                      className="h-8 w-8 rounded-full"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-neutral-900 dark:text-white truncate">
                        {fav.developer.name || fav.developer.username}
                      </p>
                      <p className="text-xs text-neutral-500 truncate">
                        {fav.developer.primaryLanguage && `${fav.developer.primaryLanguage} · `}
                        {fav.developer.location || `@${fav.developer.username}`}
                      </p>
                    </div>
                    {fav.developer.score > 0 && (
                      <span className="text-xs font-bold tabular-nums text-neutral-500">
                        {fav.developer.score}
                      </span>
                    )}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Quick links */}
          <div className="rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-700 dark:bg-neutral-900">
            <h2 className="text-sm font-semibold text-neutral-900 dark:text-white mb-3">Quick Links</h2>
            <div className="space-y-1.5">
              <Link
                href="/search"
                className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm text-neutral-600 hover:bg-neutral-50 dark:text-neutral-400 dark:hover:bg-neutral-800"
              >
                <Search className="h-4 w-4" /> Search developers
              </Link>
              <Link
                href="/match"
                className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm text-neutral-600 hover:bg-neutral-50 dark:text-neutral-400 dark:hover:bg-neutral-800"
              >
                <Zap className="h-4 w-4" /> Match to job
              </Link>
              <Link
                href="/lists"
                className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm text-neutral-600 hover:bg-neutral-50 dark:text-neutral-400 dark:hover:bg-neutral-800"
              >
                <Heart className="h-4 w-4" /> My lists
              </Link>
              <Link
                href="/settings"
                className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm text-neutral-600 hover:bg-neutral-50 dark:text-neutral-400 dark:hover:bg-neutral-800"
              >
                <Shield className="h-4 w-4" /> Settings
              </Link>
            </div>
          </div>

          {/* Platform stats */}
          <div className="rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-700 dark:bg-neutral-900">
            <h2 className="text-sm font-semibold text-neutral-900 dark:text-white mb-3">Platform</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-neutral-500">Saved developers</span>
                <span className="font-medium text-neutral-900 dark:text-white">
                  {loading ? "..." : favorites.length}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">Search engine</span>
                <span className="font-medium text-emerald-600">Live</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">Enrichment</span>
                <span className="font-medium text-emerald-600">Apollo</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Route: show landing for logged-out, dashboard for logged-in ──
export default function Home() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-300 border-t-blue-600" />
      </div>
    );
  }

  if (session) return <Dashboard />;
  return <LandingHero />;
}
