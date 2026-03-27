"use client";

import { useState } from "react";
import {
  Building2,
  Users,
  TrendingUp,
  MapPin,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  AlertTriangle,
} from "lucide-react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyCompany = Record<string, any>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyCandidate = Record<string, any>;

interface SharedData {
  permissionLevel: string;
  sharedBy: string;
  expiresAt: string | null;
  map: {
    name: string;
    roleTitle: string;
    roleLevel: string | null;
    roleStack: string[];
    geography: string[];
    tiers: Record<string, AnyCompany[]>;
    stats: {
      totalCompanies: number;
      totalCandidates: number;
      avgFitScore: number;
      statusCounts: Record<string, number>;
    };
  };
}

const TIER_CONFIG: Record<string, { label: string; sub: string; dot: string }> =
  {
    A: {
      label: "Tier A",
      sub: "Direct competitors",
      dot: "bg-emerald-500",
    },
    B: { label: "Tier B", sub: "Adjacent space", dot: "bg-blue-500" },
    C: { label: "Tier C", sub: "Upmarket talent", dot: "bg-blue-500" },
  };

function scoreColor(s: number) {
  if (s >= 90) return "text-emerald-400 bg-emerald-500/10";
  if (s >= 80) return "text-blue-400 bg-blue-500/10";
  if (s >= 70) return "text-amber-400 bg-amber-500/10";
  return "text-neutral-400 bg-neutral-500/10";
}

function flightRiskLabel(risk: string) {
  if (risk === "high") return "Likely open to new opportunities";
  if (risk === "medium") return "May be open to opportunities";
  return null;
}

export function SharedMapView({ data }: { data: SharedData }) {
  const { map, permissionLevel, sharedBy, expiresAt } = data;
  const [expandedCompanies, setExpandedCompanies] = useState<Set<string>>(
    new Set()
  );

  const toggleCompany = (id: string) => {
    setExpandedCompanies((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="min-h-screen dark bg-background">
      {/* Header */}
      <header className="border-b border-neutral-800/50 bg-neutral-900/50 backdrop-blur-sm">
        <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-gold flex items-center justify-center text-sidebar-bg font-bold text-sm">
                S
              </div>
              <span className="text-lg font-semibold text-white">Scout</span>
            </div>
            <span className="text-neutral-500">·</span>
            <span className="text-sm text-neutral-400">
              Shared by {sharedBy}
            </span>
          </div>
          <span className="text-xs text-neutral-500">
            {permissionLevel === "overview"
              ? "Company overview"
              : "Full detail view"}
          </span>
        </div>
      </header>

      {/* Content */}
      <div className="mx-auto max-w-6xl px-6 py-8">
        {/* Role Summary */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white mb-1">{map.name}</h1>
          <div className="flex flex-wrap gap-3 text-sm text-neutral-400">
            <span>{map.roleTitle}</span>
            {map.roleLevel && (
              <>
                <span className="text-neutral-600">·</span>
                <span>{map.roleLevel}</span>
              </>
            )}
            {map.geography.length > 0 && (
              <>
                <span className="text-neutral-600">·</span>
                <span>{map.geography.join(", ")}</span>
              </>
            )}
          </div>
          {map.roleStack.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {map.roleStack.map((t) => (
                <span
                  key={t}
                  className="rounded-md bg-neutral-800 px-2 py-0.5 text-xs text-neutral-300"
                >
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          <StatCard
            icon={<Building2 className="h-4 w-4" />}
            label="Companies"
            value={map.stats.totalCompanies}
          />
          <StatCard
            icon={<Users className="h-4 w-4" />}
            label="Candidates"
            value={map.stats.totalCandidates}
          />
          <StatCard
            icon={<TrendingUp className="h-4 w-4" />}
            label="Avg Fit Score"
            value={map.stats.avgFitScore}
          />
          <StatCard
            icon={<MapPin className="h-4 w-4" />}
            label="Tiers"
            value={Object.values(map.tiers).filter((t) => t.length > 0).length}
          />
        </div>

        {/* Tiers */}
        {(["A", "B", "C"] as const).map((tier) => {
          const companies = map.tiers[tier] || [];
          if (companies.length === 0) return null;
          const cfg = TIER_CONFIG[tier];
          return (
            <div key={tier} className="mb-8">
              <div className="flex items-center gap-2 mb-4">
                <div className={`h-2.5 w-2.5 rounded-full ${cfg.dot}`} />
                <h2 className="text-lg font-semibold text-white">
                  {cfg.label}
                </h2>
                <span className="text-sm text-neutral-500">{cfg.sub}</span>
                <span className="ml-auto text-sm text-neutral-500">
                  {companies.length}{" "}
                  {companies.length === 1 ? "company" : "companies"}
                </span>
              </div>
              <div className="space-y-3">
                {companies.map((co: AnyCompany) => (
                  <CompanyCard
                    key={co.id}
                    company={co}
                    permissionLevel={permissionLevel}
                    expanded={expandedCompanies.has(co.id)}
                    onToggle={() => toggleCompany(co.id)}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <footer className="border-t border-neutral-800/50 py-6 mt-8">
        <div className="mx-auto max-w-6xl px-6 flex items-center justify-between text-xs text-neutral-500">
          <span>Powered by Scout</span>
          {expiresAt && (
            <span>
              This link expires{" "}
              {new Date(expiresAt).toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </span>
          )}
        </div>
      </footer>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-xl border border-neutral-800/50 bg-neutral-900/50 p-4">
      <div className="flex items-center gap-2 text-neutral-400 mb-1">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <div className="text-2xl font-bold text-white">{value}</div>
    </div>
  );
}

function CompanyCard({
  company,
  permissionLevel,
  expanded,
  onToggle,
}: {
  company: AnyCompany;
  permissionLevel: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  const hasCandidates =
    permissionLevel === "full" && company.candidates?.length > 0;

  return (
    <div className="rounded-xl border border-neutral-800/50 bg-neutral-900/30 overflow-hidden">
      <button
        onClick={hasCandidates ? onToggle : undefined}
        className={`w-full p-4 flex items-center gap-3 text-left ${hasCandidates ? "cursor-pointer hover:bg-neutral-800/30" : "cursor-default"} transition-colors`}
      >
        {/* Company avatar */}
        <div className="h-9 w-9 rounded-lg bg-neutral-800 flex items-center justify-center text-sm font-bold text-neutral-300 shrink-0">
          {company.companyName?.[0]?.toUpperCase() || "?"}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-white text-sm truncate">
              {company.companyName}
            </span>
            <span className="text-xs text-neutral-500">
              {company.companyDomain}
            </span>
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-neutral-400 mt-0.5">
            {company.headcount && <span>{company.headcount} employees</span>}
            {company.hqCity && <span>{company.hqCity}</span>}
            {company.fundingStage && <span>{company.fundingStage}</span>}
            {company.growthRate && <span>{company.growthRate} growth</span>}
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-3 shrink-0">
          {permissionLevel === "overview" ? (
            <>
              <div className="text-right">
                <div className="text-sm font-semibold text-white">
                  {company.candidateCount}
                </div>
                <div className="text-[10px] text-neutral-500">candidates</div>
              </div>
              {company.avgFitScore > 0 && (
                <div className="text-right">
                  <div
                    className={`text-sm font-semibold rounded px-1.5 ${scoreColor(company.avgFitScore)}`}
                  >
                    {company.avgFitScore}
                  </div>
                  <div className="text-[10px] text-neutral-500">avg fit</div>
                </div>
              )}
              {company.highFlightRiskCount > 0 && (
                <div className="flex items-center gap-1 text-amber-400">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  <span className="text-xs">
                    {company.highFlightRiskCount} likely open
                  </span>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="text-right">
                <div className="text-sm font-semibold text-white">
                  {company.candidates?.length || 0}
                </div>
                <div className="text-[10px] text-neutral-500">candidates</div>
              </div>
              {hasCandidates &&
                (expanded ? (
                  <ChevronDown className="h-4 w-4 text-neutral-500" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-neutral-500" />
                ))}
            </>
          )}
        </div>
      </button>

      {/* Expanded candidate list (full permission only) */}
      {hasCandidates && expanded && (
        <div className="border-t border-neutral-800/50 divide-y divide-neutral-800/30">
          {company.candidates.map((c: AnyCandidate) => (
            <div
              key={c.id}
              className="px-4 py-3 flex items-center gap-3 text-sm"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-white truncate">
                    {c.name}
                  </span>
                  {c.linkedinUrl && (
                    <a
                      href={c.linkedinUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-neutral-500 hover:text-blue-400 transition-colors"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
                <div className="text-xs text-neutral-400 mt-0.5">
                  {c.title}
                  {c.city && ` · ${c.city}${c.state ? `, ${c.state}` : ""}`}
                </div>
                {c.flightRisk && flightRiskLabel(c.flightRisk) && (
                  <div className="text-[10px] text-amber-400/80 mt-0.5">
                    {flightRiskLabel(c.flightRisk)}
                  </div>
                )}
              </div>
              {c.fitScore != null && (
                <span
                  className={`rounded-md px-2 py-0.5 text-xs font-semibold ${scoreColor(c.fitScore)}`}
                >
                  {c.fitScore}
                </span>
              )}
              {c.gitscoutScore != null && (
                <span
                  className="rounded-md px-2 py-0.5 text-xs font-semibold bg-emerald-500/10 text-emerald-400"
                  title="Quality signal based on open source contributions"
                >
                  GS {c.gitscoutScore}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
