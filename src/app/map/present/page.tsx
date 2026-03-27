"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  ChevronDown,
  ChevronRight,
  X,
  Building2,
  Users,
  TrendingUp,
  AlertTriangle,
  ExternalLink,
} from "lucide-react";

interface Candidate {
  id: string;
  name: string;
  title: string | null;
  seniority: string | null;
  city: string | null;
  state: string | null;
  fitScore: number | null;
  flightRisk: string | null;
  linkedinUrl: string | null;
  gitscoutScore: number | null;
}

interface Company {
  id: string;
  companyName: string;
  companyDomain: string;
  headcount: number | null;
  hqCity: string | null;
  fundingStage: string | null;
  flightRiskCompany: string | null;
  candidates: Candidate[];
}

interface MapData {
  name: string;
  roleTitle: string;
  roleLevel: string | null;
  tiers: Record<string, Company[]>;
  stats: {
    totalCompanies: number;
    totalCandidates: number;
    avgFitScore: number;
  };
}

const TIER_CONFIG: Record<string, { label: string; sub: string; dot: string }> = {
  A: { label: "Tier A", sub: "Direct competitors", dot: "bg-emerald-500" },
  B: { label: "Tier B", sub: "Adjacent space", dot: "bg-indigo-500" },
  C: { label: "Tier C", sub: "Upmarket talent", dot: "bg-blue-500" },
};

function scoreColor(s: number) {
  if (s >= 90) return "text-emerald-400";
  if (s >= 80) return "text-blue-400";
  if (s >= 70) return "text-amber-400";
  return "text-neutral-400";
}

function PresentationInner() {
  const searchParams = useSearchParams();
  const mapId = searchParams.get("id");
  const [mapData, setMapData] = useState<MapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedCo, setExpandedCo] = useState<string | null>(null);
  const [currentTier, setCurrentTier] = useState(0);

  const activeTiers = mapData
    ? (["A", "B", "C"] as const).filter(
        (t) => (mapData.tiers[t]?.length || 0) > 0
      )
    : [];

  useEffect(() => {
    if (!mapId) return;
    async function load() {
      const res = await fetch(`/api/market-map/${mapId}`);
      if (res.ok) {
        const data = await res.json();
        setMapData(data);
      }
      setLoading(false);
    }
    load();
  }, [mapId]);

  // Fullscreen on mount
  useEffect(() => {
    document.documentElement.requestFullscreen?.().catch(() => {});
  }, []);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        document.exitFullscreen?.().catch(() => {});
        window.history.back();
      } else if (e.key === "ArrowRight") {
        setCurrentTier((prev) => Math.min(prev + 1, activeTiers.length - 1));
        setExpandedCo(null);
      } else if (e.key === "ArrowLeft") {
        setCurrentTier((prev) => Math.max(prev - 1, 0));
        setExpandedCo(null);
      }
    },
    [activeTiers.length]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0a0f]">
        <div className="text-neutral-400">Loading presentation...</div>
      </div>
    );
  }

  if (!mapData) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0a0f]">
        <div className="text-neutral-400">Map not found</div>
      </div>
    );
  }

  const tier = activeTiers[currentTier];
  const companies = tier ? mapData.tiers[tier] || [] : [];
  const tierCfg = tier ? TIER_CONFIG[tier] : null;

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white p-8">
      {/* Exit button */}
      <button
        onClick={() => {
          document.exitFullscreen?.().catch(() => {});
          window.history.back();
        }}
        className="fixed top-6 right-6 z-50 rounded-lg bg-neutral-800/80 p-2 text-neutral-400 hover:text-white hover:bg-neutral-700 transition-colors"
        title="Exit (ESC)"
      >
        <X className="h-5 w-5" />
      </button>

      {/* Header */}
      <div className="max-w-5xl mx-auto mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="h-8 w-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white font-bold">
            G
          </div>
          <span className="text-xl font-bold">{mapData.name}</span>
        </div>
        <p className="text-neutral-400">
          {mapData.roleTitle}
          {mapData.roleLevel ? ` · ${mapData.roleLevel}` : ""}
        </p>
      </div>

      {/* Stats */}
      <div className="max-w-5xl mx-auto grid grid-cols-3 gap-4 mb-10">
        <div className="rounded-xl border border-neutral-800/50 bg-neutral-900/50 p-5 text-center">
          <Building2 className="h-5 w-5 text-neutral-400 mx-auto mb-2" />
          <div className="text-3xl font-bold">{mapData.stats.totalCompanies}</div>
          <div className="text-sm text-neutral-500 mt-1">Companies</div>
        </div>
        <div className="rounded-xl border border-neutral-800/50 bg-neutral-900/50 p-5 text-center">
          <Users className="h-5 w-5 text-neutral-400 mx-auto mb-2" />
          <div className="text-3xl font-bold">{mapData.stats.totalCandidates}</div>
          <div className="text-sm text-neutral-500 mt-1">Candidates</div>
        </div>
        <div className="rounded-xl border border-neutral-800/50 bg-neutral-900/50 p-5 text-center">
          <TrendingUp className="h-5 w-5 text-neutral-400 mx-auto mb-2" />
          <div className="text-3xl font-bold">{mapData.stats.avgFitScore}</div>
          <div className="text-sm text-neutral-500 mt-1">Avg Fit Score</div>
        </div>
      </div>

      {/* Current tier */}
      {tierCfg && (
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <div className={`h-3 w-3 rounded-full ${tierCfg.dot}`} />
            <h2 className="text-2xl font-bold">{tierCfg.label}</h2>
            <span className="text-lg text-neutral-500">{tierCfg.sub}</span>
            <span className="ml-auto text-neutral-500">
              {companies.length} companies
            </span>
          </div>

          <div className="grid gap-4">
            {companies.map((co) => (
              <div
                key={co.id}
                className="rounded-xl border border-neutral-800/50 bg-neutral-900/30 overflow-hidden"
              >
                <button
                  onClick={() =>
                    setExpandedCo(expandedCo === co.id ? null : co.id)
                  }
                  className="w-full p-5 flex items-center gap-4 text-left hover:bg-neutral-800/20 transition-colors"
                >
                  <div className="h-12 w-12 rounded-xl bg-neutral-800 flex items-center justify-center text-lg font-bold text-neutral-300">
                    {co.companyName[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <div className="text-lg font-semibold">{co.companyName}</div>
                    <div className="text-sm text-neutral-400">
                      {[co.headcount && `${co.headcount} employees`, co.hqCity, co.fundingStage]
                        .filter(Boolean)
                        .join(" · ")}
                    </div>
                  </div>
                  <div className="text-right mr-4">
                    <div className="text-2xl font-bold">{co.candidates.length}</div>
                    <div className="text-xs text-neutral-500">candidates</div>
                  </div>
                  {co.flightRiskCompany === "high" && (
                    <AlertTriangle className="h-5 w-5 text-amber-400" />
                  )}
                  {expandedCo === co.id ? (
                    <ChevronDown className="h-5 w-5 text-neutral-500" />
                  ) : (
                    <ChevronRight className="h-5 w-5 text-neutral-500" />
                  )}
                </button>

                {expandedCo === co.id && co.candidates.length > 0 && (
                  <div className="border-t border-neutral-800/50 p-4">
                    <div className="grid gap-2">
                      {co.candidates.slice(0, 8).map((c) => (
                        <div
                          key={c.id}
                          className="flex items-center gap-3 rounded-lg bg-neutral-800/30 p-3"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{c.name}</span>
                              {c.linkedinUrl && (
                                <a
                                  href={c.linkedinUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-neutral-500 hover:text-blue-400"
                                >
                                  <ExternalLink className="h-3 w-3" />
                                </a>
                              )}
                            </div>
                            <div className="text-sm text-neutral-400">
                              {c.title}
                              {c.city && ` · ${c.city}`}
                            </div>
                          </div>
                          {c.fitScore != null && (
                            <span
                              className={`text-lg font-bold ${scoreColor(c.fitScore)}`}
                            >
                              {c.fitScore}
                            </span>
                          )}
                          {c.flightRisk === "high" && (
                            <span className="text-xs text-amber-400 bg-amber-500/10 rounded px-2 py-0.5">
                              Likely open
                            </span>
                          )}
                        </div>
                      ))}
                      {co.candidates.length > 8 && (
                        <div className="text-center text-sm text-neutral-500 py-2">
                          + {co.candidates.length - 8} more
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bottom nav */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-xl border border-neutral-700/50 bg-neutral-900/95 px-5 py-3 shadow-2xl backdrop-blur-sm">
        {activeTiers.map((t, i) => (
          <button
            key={t}
            onClick={() => {
              setCurrentTier(i);
              setExpandedCo(null);
            }}
            className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-colors ${
              i === currentTier
                ? "bg-indigo-600 text-white"
                : "text-neutral-400 hover:text-white hover:bg-neutral-800"
            }`}
          >
            {TIER_CONFIG[t].label}
          </button>
        ))}
        <div className="h-4 w-px bg-neutral-700 mx-1" />
        <span className="text-xs text-neutral-500">
          ← → navigate · ESC exit
        </span>
      </div>
    </div>
  );
}

export default function PresentPage() {
  return (
    <Suspense>
      <PresentationInner />
    </Suspense>
  );
}
