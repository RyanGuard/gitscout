"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Link2,
  Building2,
  Users,
  Code2,
  RefreshCw,
  Search,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Upload,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { ConnectionResults } from "@/components/connections/ConnectionResults";
import { LinkedinImport } from "@/components/connections/LinkedinImport";

interface HomeBase {
  id: string;
  companyName: string;
  companyDomain: string;
  setupStatus: string;
  teamCount: number;
  engCount: number;
  githubMatchedCount: number;
  investors: string[];
  fundingStage: string | null;
  lastEnrichedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface LookupResult {
  id: string;
  targetCompanyName: string;
  targetCompanyDomain: string;
  totalConnectionsFound: number;
  connectionBreakdown: Record<string, number>;
  connections: Array<{
    id: string;
    connectionType: string;
    strength: string;
    homePersonName: string | null;
    homePersonTitle: string | null;
    targetPersonName: string | null;
    targetPersonTitle: string | null;
    detail: Record<string, unknown>;
    suggestedAction: string | null;
  }>;
}

export default function ConnectionsPage() {
  const [homeBase, setHomeBase] = useState<HomeBase | null>(null);
  const [loading, setLoading] = useState(true);
  const [setupDomain, setSetupDomain] = useState("");
  const [settingUp, setSettingUp] = useState(false);
  const [targetDomain, setTargetDomain] = useState("");
  const [lookingUp, setLookingUp] = useState(false);
  const [lookupResult, setLookupResult] = useState<LookupResult | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [linkedinOpen, setLinkedinOpen] = useState(false);

  const fetchHomeBase = useCallback(async () => {
    try {
      const res = await fetch("/api/connections/home-base");
      const data = await res.json();
      setHomeBase(data.homeBase);
    } catch {
      // Silent fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHomeBase();
  }, [fetchHomeBase]);

  // Poll while enriching — auto-reset if stuck for >5 minutes
  useEffect(() => {
    if (
      !homeBase ||
      homeBase.setupStatus === "ready" ||
      homeBase.setupStatus === "failed"
    ) {
      return;
    }

    // Check if stuck (updatedAt > 5 minutes ago)
    const updatedAt = new Date(homeBase.updatedAt || homeBase.createdAt).getTime();
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    if (updatedAt < fiveMinutesAgo) {
      // Reset the stuck record
      fetch(`/api/connections/home-base/${homeBase.id}/reset`, { method: "POST" })
        .then(() => fetchHomeBase())
        .catch(() => {});
      return;
    }

    const interval = setInterval(fetchHomeBase, 3000);
    return () => clearInterval(interval);
  }, [homeBase, fetchHomeBase]);

  const handleSetup = async () => {
    if (!setupDomain.trim()) return;
    setSettingUp(true);
    try {
      const res = await fetch("/api/connections/setup-home-base", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company_domain: setupDomain.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setHomeBase({
          id: data.id,
          companyName: setupDomain.split(".")[0],
          companyDomain: setupDomain.trim(),
          setupStatus: data.status,
          teamCount: 0,
          engCount: 0,
          githubMatchedCount: 0,
          investors: [],
          fundingStage: null,
          lastEnrichedAt: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        setSetupDomain("");
      }
    } catch {
      // Error handled by UI state
    } finally {
      setSettingUp(false);
    }
  };

  const handleLookup = async () => {
    if (!targetDomain.trim() || !homeBase) return;
    setLookingUp(true);
    setLookupError(null);
    setLookupResult(null);

    try {
      const res = await fetch("/api/connections/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target_company_domain: targetDomain.trim(),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setLookupResult(data);
      } else {
        setLookupError(data.error || "Lookup failed");
      }
    } catch {
      setLookupError("Failed to connect to server");
    } finally {
      setLookingUp(false);
    }
  };

  const handleRefresh = async () => {
    if (!homeBase) return;
    setSettingUp(true);
    try {
      await fetch("/api/connections/setup-home-base", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company_domain: homeBase.companyDomain }),
      });
      fetchHomeBase();
    } catch {
      // Error
    } finally {
      setSettingUp(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
      </div>
    );
  }

  const isEnriching =
    homeBase &&
    homeBase.setupStatus !== "ready" &&
    homeBase.setupStatus !== "failed";

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Page header */}
      <div className="mb-8">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-neutral-900 dark:text-white">
          <Link2 className="h-6 w-6 text-teal-500" />
          Connection Mapper
        </h1>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          Map warm paths between your company and any target. Find former
          colleagues, shared investors, education ties, and OSS overlap.
        </p>
      </div>

      {/* Home base section */}
      {!homeBase ? (
        <SetupCard
          domain={setupDomain}
          onDomainChange={setSetupDomain}
          onSetup={handleSetup}
          loading={settingUp}
        />
      ) : isEnriching ? (
        <EnrichingCard homeBase={homeBase} onReset={async () => {
          await fetch(`/api/connections/home-base/${homeBase.id}/reset`, { method: "POST" });
          fetchHomeBase();
        }} />
      ) : homeBase.setupStatus === "failed" ? (
        <FailedCard onRetry={handleRefresh} loading={settingUp} />
      ) : (
        <ReadyCard
          homeBase={homeBase}
          onRefresh={handleRefresh}
          refreshing={settingUp}
        />
      )}

      {/* Connection lookup section — only show when home base is ready */}
      {homeBase?.setupStatus === "ready" && (
        <div className="mt-8">
          <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
            <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">
              Find Connections
            </h2>
            <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
              Enter a target company to map warm paths from{" "}
              <span className="font-medium text-neutral-700 dark:text-neutral-300">
                {homeBase.companyName}
              </span>
            </p>

            <div className="mt-4 flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                <input
                  type="text"
                  value={targetDomain}
                  onChange={(e) => setTargetDomain(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleLookup()}
                  placeholder="e.g. coreweave.com"
                  className="w-full rounded-lg border border-neutral-200 bg-white py-2.5 pl-10 pr-4 text-sm text-neutral-900 placeholder-neutral-400 transition-colors focus:border-gold/50 focus:outline-none focus:ring-1 focus:ring-gold/5 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white dark:placeholder-neutral-500"
                />
              </div>
              <button
                onClick={handleLookup}
                disabled={lookingUp || !targetDomain.trim()}
                className="flex items-center gap-2 rounded-lg bg-gold px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-gold-hover disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {lookingUp ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ArrowRight className="h-4 w-4" />
                )}
                Map Connections
              </button>
            </div>
          </div>

          {/* Lookup results */}
          {lookupError && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-400">
              <AlertCircle className="mb-1 inline h-4 w-4" /> {lookupError}
            </div>
          )}

          {lookingUp && (
            <div className="mt-6 flex flex-col items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-teal-500" />
              <p className="mt-3 text-sm text-neutral-500 dark:text-neutral-400">
                Analyzing connections to {targetDomain}...
              </p>
              <p className="mt-1 text-xs text-neutral-400 dark:text-neutral-500">
                Checking employment history, investors, education, and GitHub
                activity
              </p>
            </div>
          )}

          {lookupResult && !lookingUp && (
            <ConnectionResults result={lookupResult} />
          )}
        </div>
      )}

      {/* LinkedIn import section */}
      {homeBase?.setupStatus === "ready" && (
        <div className="mt-8">
          <button
            onClick={() => setLinkedinOpen(!linkedinOpen)}
            className="flex w-full items-center justify-between rounded-xl border border-neutral-200 bg-white px-6 py-4 text-left shadow-sm transition-colors hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900 dark:hover:bg-neutral-800/50"
          >
            <div className="flex items-center gap-3">
              <Upload className="h-5 w-5 text-blue-500" />
              <div>
                <p className="text-sm font-medium text-neutral-900 dark:text-white">
                  Import LinkedIn Connections
                </p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  Upload your LinkedIn CSV for deeper connection mapping
                </p>
              </div>
            </div>
            {linkedinOpen ? (
              <ChevronUp className="h-4 w-4 text-neutral-400" />
            ) : (
              <ChevronDown className="h-4 w-4 text-neutral-400" />
            )}
          </button>

          {linkedinOpen && (
            <div className="mt-2 rounded-xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
              <LinkedinImport />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SetupCard({
  domain,
  onDomainChange,
  onSetup,
  loading,
}: {
  domain: string;
  onDomainChange: (v: string) => void;
  onSetup: () => void;
  loading: boolean;
}) {
  const connectionTypes = [
    { label: "Former colleagues", desc: "People who worked at your company and moved to the target", icon: Users },
    { label: "Shared investors", desc: "Companies backed by the same VCs as yours", icon: Building2 },
    { label: "Education ties", desc: "Same university, bootcamp, or program alumni", icon: Link2 },
    { label: "Open source overlap", desc: "Collaborated on the same GitHub projects", icon: Code2 },
  ];

  return (
    <div className="rounded-xl border-2 border-dashed border-neutral-300 bg-neutral-50 p-8 dark:border-neutral-700 dark:bg-neutral-900/50">
      <div className="text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gold-bg border border-gold-border">
          <Link2 className="h-6 w-6 text-gold" />
        </div>
        <h2 className="mt-5 text-lg font-semibold text-neutral-900 dark:text-white">
          Map your warm paths
        </h2>
        <p className="mx-auto mt-2 max-w-lg text-sm text-neutral-500 dark:text-neutral-400">
          Stop cold outreach. Scout finds people at your company who can intro you to anyone.
          Enter your company domain and we&apos;ll map every warm path you have.
        </p>
      </div>

      <div className="mx-auto mt-6 grid max-w-lg grid-cols-2 gap-3">
        {connectionTypes.map((ct) => (
          <div key={ct.label} className="flex items-start gap-2.5 rounded-lg border border-neutral-200/50 bg-white p-3 dark:border-neutral-700/50 dark:bg-neutral-800/50">
            <ct.icon className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
            <div>
              <p className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">{ct.label}</p>
              <p className="mt-0.5 text-[11px] leading-tight text-neutral-500">{ct.desc}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mx-auto mt-6 flex max-w-sm gap-3">
        <input
          type="text"
          value={domain}
          onChange={(e) => onDomainChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onSetup()}
          placeholder="yourcompany.com"
          className="flex-1 rounded-lg border border-neutral-300 bg-white px-4 py-2.5 text-sm text-neutral-900 placeholder-neutral-400 focus:border-gold/50 focus:outline-none focus:ring-1 focus:ring-gold/5 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white dark:placeholder-neutral-500"
        />
        <button
          onClick={onSetup}
          disabled={loading || !domain.trim()}
          className="flex items-center gap-2 rounded-lg bg-gold px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-gold-hover disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          Set Up
        </button>
      </div>
    </div>
  );
}

function EnrichingCard({ homeBase, onReset }: { homeBase: HomeBase; onReset: () => void }) {
  const statusMessages: Record<string, { label: string; sub: string }> = {
    pending: {
      label: "Starting enrichment...",
      sub: "Preparing to analyze your company",
    },
    enriching_team: {
      label: "Finding your team...",
      sub: `${homeBase.teamCount > 0 ? `${homeBase.teamCount} people found so far` : "Searching Apollo for team members"}`,
    },
    enriching_github: {
      label: "Matching GitHub profiles...",
      sub: `${homeBase.engCount} engineers identified, matching to GitHub`,
    },
  };

  const status = statusMessages[homeBase.setupStatus] || statusMessages.pending;

  return (
    <div className="rounded-xl border border-teal-200 bg-teal-50 p-6 dark:border-teal-900/50 dark:bg-teal-900/10">
      <div className="flex items-center gap-3">
        <Loader2 className="h-5 w-5 animate-spin text-teal-600 dark:text-teal-400" />
        <div>
          <p className="font-medium text-teal-800 dark:text-teal-300">
            {status.label}
          </p>
          <p className="text-sm text-teal-600 dark:text-teal-400">
            {status.sub}
          </p>
        </div>
      </div>
      {homeBase.teamCount > 0 && (
        <div className="mt-4 flex gap-4 text-sm text-teal-700 dark:text-teal-400">
          <span className="flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" /> {homeBase.teamCount} people
          </span>
          <span className="flex items-center gap-1.5">
            <Code2 className="h-3.5 w-3.5" /> {homeBase.engCount} engineers
          </span>
          {homeBase.githubMatchedCount > 0 && (
            <span className="flex items-center gap-1.5">
              <Code2 className="h-3.5 w-3.5" /> {homeBase.githubMatchedCount}{" "}
              GitHub matches
            </span>
          )}
        </div>
      )}
      <button
        onClick={onReset}
        className="mt-3 text-xs text-teal-600 hover:text-teal-800 dark:text-teal-400 dark:hover:text-teal-200 transition-colors"
      >
        Stuck? Click to restart setup
      </button>
    </div>
  );
}

function FailedCard({
  onRetry,
  loading,
}: {
  onRetry: () => void;
  loading: boolean;
}) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-6 dark:border-red-900/50 dark:bg-red-900/10">
      <div className="flex items-center gap-3">
        <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
        <div>
          <p className="font-medium text-red-800 dark:text-red-300">
            Setup failed
          </p>
          <p className="text-sm text-red-600 dark:text-red-400">
            Something went wrong during enrichment. Try again or use a different
            domain.
          </p>
        </div>
      </div>
      <button
        onClick={onRetry}
        disabled={loading}
        className="mt-4 flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <RefreshCw className="h-4 w-4" />
        )}
        Retry
      </button>
    </div>
  );
}

function ReadyCard({
  homeBase,
  onRefresh,
  refreshing,
}: {
  homeBase: HomeBase;
  onRefresh: () => void;
  refreshing: boolean;
}) {
  const timeAgo = homeBase.lastEnrichedAt
    ? formatTimeAgo(new Date(homeBase.lastEnrichedAt))
    : "never";

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-100 dark:bg-teal-900/30">
            <CheckCircle2 className="h-5 w-5 text-teal-600 dark:text-teal-400" />
          </div>
          <div>
            <h2 className="font-semibold text-neutral-900 dark:text-white capitalize">
              {homeBase.companyName}
            </h2>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Last refreshed: {timeAgo}
            </p>
          </div>
        </div>
        <button
          onClick={onRefresh}
          disabled={refreshing}
          className="flex items-center gap-1.5 rounded-lg border border-neutral-200 px-3 py-1.5 text-xs text-neutral-600 transition-colors hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800"
        >
          <RefreshCw
            className={`h-3 w-3 ${refreshing ? "animate-spin" : ""}`}
          />
          Refresh
        </button>
      </div>

      <div className="mt-4 flex flex-wrap gap-4 text-sm">
        <span className="flex items-center gap-1.5 text-neutral-600 dark:text-neutral-400">
          <Users className="h-3.5 w-3.5" />
          {homeBase.teamCount} team members
        </span>
        <span className="flex items-center gap-1.5 text-neutral-600 dark:text-neutral-400">
          <Code2 className="h-3.5 w-3.5" />
          {homeBase.engCount} engineers
        </span>
        <span className="flex items-center gap-1.5 text-neutral-600 dark:text-neutral-400">
          <Code2 className="h-3.5 w-3.5" />
          {homeBase.githubMatchedCount} GitHub profiles matched
        </span>
        {homeBase.investors.length > 0 && (
          <span className="flex items-center gap-1.5 text-neutral-600 dark:text-neutral-400">
            <Building2 className="h-3.5 w-3.5" />
            {homeBase.investors.length} investors
          </span>
        )}
      </div>
    </div>
  );
}

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
