"use client";

import { useState, useEffect, useCallback, useMemo, useRef, Suspense } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ChevronDown, X, Users, Building2, TrendingUp,
  Download, Share2, Send, Map, Plus, Loader2, AlertTriangle,
  CheckSquare, Square, Link2, Shield, Filter,
  GripVertical, Search, Save, Copy, Clock, Mail, Pencil, FileText, ArrowRight,
  LayoutDashboard, Presentation, Sparkles,
} from "lucide-react";
import Link from "next/link";
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useDroppable } from "@dnd-kit/core";
import { FeatureHint } from "@/components/ui/FeatureHint";
import { AddToSequenceButton } from "@/components/sequences/AddToSequenceButton";
import { DraftInStudioButton } from "@/components/outreach/DraftInStudioButton";
import { fromMapCandidate } from "@/lib/outreach/candidateNormalizer";
import CompanyTimeline from "@/components/map/CompanyTimeline";
import { MarketMapGeneratingOverlay } from "@/components/map/MarketMapGeneratingOverlay";
import { showError, showSuccess } from "@/lib/toast";
import { trackEvent } from "@/lib/posthog";

// ═══════════════════════════════════════════════════════════
//  TYPES
// ═══════════════════════════════════════════════════════════

interface Candidate {
  id: string;
  name: string;
  firstName: string | null;
  lastName: string | null;
  title: string | null;
  seniority: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  linkedinUrl: string | null;
  headline: string | null;
  fitScore: number | null;
  fitReasoning: string | null;
  flightRisk: string | null;
  flightRiskSignals: string[];
  flightRiskReasoning: string | null;
  status: string;
  email: string | null;
  phone: string | null;
  tenureMonths: number | null;
  yearsOfExperience: number | null;
  shortlistNote: string | null;
}

interface Company {
  id: string;
  companyName: string;
  companyDomain: string;
  tier: string;
  tierOverride: boolean;
  tierReasoning: string | null;
  tierScore: number | null;
  tierBreakdown: { stack: number; headcount: number; funding: number; domain: number; growth: number; geo: number } | null;
  headcount: number | null;
  engHeadcount: number | null;
  hqCity: string | null;
  hqCountry: string | null;
  fundingStage: string | null;
  fundingAmount: string | null;
  growthRate: string | null;
  newsSummary: string | null;
  flightRiskCompany: string | null;
  enrichmentStatus: string;
  candidates: Candidate[];
  techStackVerified: string[];
  techStackSources: Record<string, string[]> | null;
  stackConfidence: Record<string, string> | null;
  jdCount: number | null;
  stackScanStatus: string | null;
  lastStackScanAt: string | null;
  newsEvents: Array<{ event_type: string; severity: string; summary: string; date: string }> | null;
  departmentalHeadcount: Record<string, number> | null;
}

interface MapData {
  id: string;
  name: string;
  roleTitle: string;
  roleLevel: string | null;
  roleStack: string[];
  geography: string[];
  status: string;
  tiers: Record<string, Company[]>;
  hiddenCompanies: Array<{ id: string; companyName: string; tier: string }>;
  stats: {
    totalCompanies: number;
    totalCandidates: number;
    openCandidates: number;
    avgFitScore: number;
    statusCounts: Record<string, number>;
  };
}

type Tier = "A" | "B" | "C";

// ═══════════════════════════════════════════════════════════
//  CONSTANTS
// ═══════════════════════════════════════════════════════════

const TIER_CONFIG: Record<Tier, { label: string; sub: string; dot: string; badge: string }> = {
  A: { label: "Tier A", sub: "Direct competitors", dot: "bg-emerald-500", badge: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20" },
  B: { label: "Tier B", sub: "Adjacent space", dot: "bg-indigo-500", badge: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-500/20" },
  C: { label: "Tier C", sub: "Upmarket talent", dot: "bg-blue-500", badge: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20" },
};

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  mapped: { label: "Mapped", color: "bg-neutral-500/10 text-neutral-400" },
  shortlisted: { label: "Shortlisted", color: "bg-blue-500/10 text-blue-400" },
  contacted: { label: "Contacted", color: "bg-amber-500/10 text-amber-400" },
  responded: { label: "Responded", color: "bg-teal-500/10 text-teal-400" },
  screening: { label: "Screening", color: "bg-purple-500/10 text-purple-400" },
  offer: { label: "Offer", color: "bg-emerald-500/10 text-emerald-400" },
  rejected: { label: "Rejected", color: "bg-red-500/15 text-red-400/80" },
};

const FLIGHT_RISK_LABELS: Record<string, string> = {
  short_tenure: "Short tenure at current role",
  company_layoffs: "Company had recent layoffs",
  company_reorg: "Company restructuring",
  team_backfilling: "Team is backfilling similar roles",
  rapid_growth_hire: "Joined during hypergrowth",
  leadership_change: "Recent engineering leadership change",
};

function scoreColor(s: number) {
  if (s >= 90) return "text-emerald-700 dark:text-emerald-400 bg-emerald-500/10";
  if (s >= 80) return "text-blue-700 dark:text-blue-400 bg-blue-500/10";
  if (s >= 70) return "text-amber-700 dark:text-amber-400 bg-amber-500/10";
  return "text-neutral-600 dark:text-neutral-400 bg-neutral-500/10";
}

const MAP_FIELD_BASE =
  "rounded-lg border border-neutral-200/65 bg-white/75 px-3 py-2 text-sm text-neutral-900 outline-none transition-[border-color,box-shadow] focus:border-gold/65 focus:shadow-[0_0_0_1px_rgba(200,165,90,0.35),0_0_24px_rgba(6,182,212,0.14)] dark:border-cyan-500/28 dark:bg-black/50 dark:text-white dark:focus:border-cyan-400/50 dark:focus:shadow-[0_0_0_1px_rgba(34,211,238,0.28),0_0_32px_rgba(34,211,238,0.16)]";
const MAP_FIELD = `w-full ${MAP_FIELD_BASE}`;
const MAP_FIELD_FLEX = `flex-1 min-w-0 ${MAP_FIELD_BASE}`;

/** Ensures the mapping overlay stays up long enough on success for the beat to land */
const MAP_GEN_OVERLAY_MIN_MS = 1_500;
const MAP_SEARCH_OVERLAY_MIN_MS = 1_200;

function waitMinOverlayMs(startedAt: number, minMs: number) {
  const remaining = minMs - (Date.now() - startedAt);
  if (remaining <= 0) return Promise.resolve();
  return new Promise<void>((resolve) => setTimeout(resolve, remaining));
}

// ═══════════════════════════════════════════════════════════
//  STATUS DROPDOWN
// ═══════════════════════════════════════════════════════════

function StatusDropdown({ status, onUpdate }: { status: string; onUpdate: (s: string) => void }) {
  const [open, setOpen] = useState(false);
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.mapped;

  return (
    <div className="relative">
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        className={`rounded-md px-2 py-0.5 text-[10px] font-semibold ${cfg.color} hover:brightness-125 transition-all`}
      >
        {cfg.label}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-6 z-50 w-36 rounded-lg border border-neutral-200/50 dark:border-neutral-700/50 bg-neutral-900 p-1 shadow-xl">
            {Object.entries(STATUS_CONFIG).map(([key, val]) => (
              <button
                key={key}
                onClick={(e) => { e.stopPropagation(); onUpdate(key); setOpen(false); }}
                className={`w-full rounded-md px-2.5 py-1.5 text-left text-[11px] font-medium transition-colors ${
                  key === status ? "bg-neutral-800 text-neutral-900 dark:text-white" : "text-neutral-400 hover:bg-neutral-100/50 dark:bg-neutral-800/50 hover:text-neutral-900 dark:text-white"
                }`}
              >
                {val.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
//  FLIGHT RISK BADGE
// ═══════════════════════════════════════════════════════════

function FlightRiskBadge({ risk, signals, reasoning }: { risk: string | null; signals: string[]; reasoning: string | null }) {
  const [showTooltip, setShowTooltip] = useState(false);

  if (!risk || risk === "low") return null;

  return (
    <div className="relative flex items-center gap-1">
      <button
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onClick={(e) => e.stopPropagation()}
        className={`flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${
          risk === "high"
            ? "bg-red-500/15 text-red-400"
            : "bg-amber-500/10 text-amber-400"
        }`}
      >
        <AlertTriangle className="h-2.5 w-2.5" />
        {risk === "high" ? "High risk" : "Medium risk"}
      </button>
      {risk === "high" && <FeatureHint id="map-flight-risk" message="High flight risk = signals this person may be open to moving. Great time to reach out." position="top" />}
      {showTooltip && (signals.length > 0 || reasoning) && (
        <div className="absolute left-0 top-7 z-50 w-64 rounded-lg border border-neutral-200/50 dark:border-neutral-700/50 bg-neutral-900 p-3 shadow-xl text-xs">
          {signals.map((s) => (
            <div key={s} className="flex items-start gap-2 mb-1.5 text-neutral-700 dark:text-neutral-300">
              <Shield className="h-3 w-3 mt-0.5 shrink-0 text-amber-400" />
              {FLIGHT_RISK_LABELS[s] || s}
            </div>
          ))}
          {reasoning && (
            <p className="mt-2 text-neutral-500 italic border-t border-neutral-800 pt-2">{reasoning}</p>
          )}
          {risk === "high" && (
            <p className="mt-2 text-emerald-400/80 text-[10px] font-medium">This candidate may be open to outreach</p>
          )}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
//  CANDIDATE ROW
// ═══════════════════════════════════════════════════════════

function CandidateRow({ candidate, mapId, selected, onSelect, onSelectPerson, isActive, onCandidateStatusUpdated }: {
  candidate: Candidate;
  mapId: string;
  selected: boolean;
  onSelect: (id: string) => void;
  onSelectPerson: (c: Candidate) => void;
  isActive: boolean;
  onCandidateStatusUpdated?: () => void;
}) {
  async function updateStatus(newStatus: string) {
    await fetch(`/api/market-map/${mapId}/candidate/${candidate.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    onCandidateStatusUpdated?.();
  }

  return (
    <div
      onClick={() => onSelectPerson(candidate)}
      className={`grid grid-cols-[auto_1fr_auto_auto] sm:grid-cols-[auto_1fr_auto_auto_auto_auto_auto] items-center gap-2 px-3 py-2.5 text-sm transition-all sm:px-4 cursor-pointer
        ${isActive ? "border-l-2 border-l-cyan-400 bg-gradient-to-r from-cyan-500/10 to-transparent shadow-[inset_0_0_20px_rgba(34,211,238,0.06)] dark:from-cyan-400/15" : "border-l-2 border-l-transparent hover:bg-neutral-50/80 dark:hover:bg-cyan-500/[0.04]"}`}
    >
      <button
        onClick={(e) => { e.stopPropagation(); onSelect(candidate.id); }}
        className="text-neutral-600 hover:text-neutral-900 dark:text-white transition-colors"
      >
        {selected ? <CheckSquare className="h-3.5 w-3.5 text-gold" /> : <Square className="h-3.5 w-3.5" />}
      </button>
      <div className="min-w-0">
        <p className="font-medium text-[13px] truncate text-foreground">{candidate.name}</p>
        <p className="text-[11px] text-neutral-500 truncate mt-0.5">{candidate.title}</p>
      </div>
      <FlightRiskBadge risk={candidate.flightRisk} signals={candidate.flightRiskSignals} reasoning={candidate.flightRiskReasoning} />
      <span className="hidden sm:inline-flex"><StatusDropdown status={candidate.status} onUpdate={updateStatus} /></span>
      {candidate.linkedinUrl && (
        <a href={candidate.linkedinUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
          className="hidden sm:inline-flex text-neutral-600 hover:text-blue-400 transition-colors">
          <Link2 className="h-3.5 w-3.5" />
        </a>
      )}
      <span className="hidden sm:inline-flex">
        <DraftInStudioButton
          variant="icon"
          candidate={fromMapCandidate(candidate, mapId)}
          className="text-neutral-600 hover:text-gold transition-colors"
        />
      </span>
      {candidate.fitScore != null && candidate.fitScore > 0 && (
        <span className="flex items-center gap-0.5">
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-md ${scoreColor(candidate.fitScore)}`}>
            {candidate.fitScore}
          </span>
          <FeatureHint id="map-fit-score" message="Fit score (0-100) measures how closely this person matches your specific role." position="left" />
        </span>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
//  COMPANY CARD
// ═══════════════════════════════════════════════════════════

function DraggableCompanyCard({ company, mapId, tier, expanded, onToggle, selectedIds, onSelectCandidate, onSelectPerson, activePerson, onRemove, connectionCount, mapRoleStack, sourcingMode, onCandidateStatusUpdated }: {
  company: Company; mapId: string; tier: Tier; expanded: boolean; onToggle: () => void;
  selectedIds: Set<string>; onSelectCandidate: (id: string) => void;
  onSelectPerson: (c: Candidate) => void; activePerson: Candidate | null;
  onRemove: (id: string) => void;
  connectionCount?: number;
  mapRoleStack?: string[];
  sourcingMode?: string;
  onCandidateStatusUpdated?: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: company.id,
    data: { type: "company", tier, company },
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : undefined,
  };

  const cfg = TIER_CONFIG[tier];
  const openCount = company.candidates.filter((c) => c.flightRisk === "high").length;
  const isEnriching = company.enrichmentStatus === "pending" || company.enrichmentStatus === "enriching";

  const candidateIds = company.candidates.map((c) => c.id);
  const selectedCount = candidateIds.filter((id) => selectedIds.has(id)).length;
  const allSelected = candidateIds.length > 0 && selectedCount === candidateIds.length;
  const someSelected = selectedCount > 0 && !allSelected;

  function handleSelectAll(e: React.MouseEvent) {
    e.stopPropagation();
    if (allSelected) {
      candidateIds.forEach((id) => onSelectCandidate(id));
    } else {
      candidateIds.filter((id) => !selectedIds.has(id)).forEach((id) => onSelectCandidate(id));
    }
  }

  return (
    <div ref={setNodeRef} style={style} className={`overflow-hidden rounded-xl border border-neutral-200/55 bg-white/70 backdrop-blur-sm transition-all dark:border-cyan-500/15 dark:bg-black/45 dark:shadow-[0_0_40px_rgba(34,211,238,0.04)] ${expanded ? "ring-1 ring-cyan-400/25 shadow-[0_0_28px_rgba(34,211,238,0.08)]" : ""} hover:border-cyan-400/20 dark:hover:border-cyan-400/25 ${isDragging ? "scale-[1.02] shadow-2xl ring-2 ring-gold/40" : ""}`}>
      <div onClick={onToggle} className="flex items-center gap-3 px-4 py-3.5 cursor-pointer group">
        <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-neutral-700 hover:text-neutral-400 transition-colors shrink-0 touch-none"
          onClick={(e) => e.stopPropagation()}>
          <GripVertical className="h-4 w-4" />
        </button>
        <button onClick={handleSelectAll} className="shrink-0 text-neutral-600 hover:text-neutral-900 dark:text-white transition-colors">
          {allSelected ? (
            <CheckSquare className="h-4 w-4 text-gold" />
          ) : someSelected ? (
            <CheckSquare className="h-4 w-4 text-neutral-500" />
          ) : (
            <Square className="h-4 w-4" />
          )}
        </button>
        <div
          className={`w-9 h-9 rounded-lg ${cfg.badge} border flex items-center justify-center text-sm font-bold shrink-0`}
          title={company.tierScore != null && company.tierBreakdown
            ? `${cfg.label} (score: ${company.tierScore})\nStack: ${company.tierBreakdown.stack}  Headcount: ${company.tierBreakdown.headcount}  Funding: ${company.tierBreakdown.funding}\nDomain: ${company.tierBreakdown.domain}  Growth: ${company.tierBreakdown.growth}  Geo: ${company.tierBreakdown.geo}`
            : `${cfg.label}${company.tierOverride ? " (manual)" : ""}`}
        >
          {company.companyName.charAt(0)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-neutral-900 dark:text-white truncate">{company.companyName}</p>
            {connectionCount && connectionCount > 0 ? (
              <span className="flex items-center gap-0.5">
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-teal-500/10 text-teal-400 font-medium shrink-0 border border-teal-500/20" title={`${connectionCount} warm connection${connectionCount !== 1 ? "s" : ""}`}>
                  <Link2 className="inline h-2.5 w-2.5 mr-0.5" />{connectionCount}
                </span>
                <FeatureHint id="map-connections" message="Warm paths into this company. Set up Connection Mapper to see these everywhere." position="right" />
              </span>
            ) : null}
            {company.flightRiskCompany === "high" && (
              <AlertTriangle className="h-3.5 w-3.5 text-red-400 shrink-0" />
            )}
          </div>
          <p className="text-[11px] text-neutral-500 mt-0.5">{company.companyDomain}</p>
        </div>
        <div className="text-right shrink-0">
          {isEnriching ? (
            <div className="flex items-center gap-2 text-[11px] text-neutral-500">
              <Loader2 className="h-3 w-3 animate-spin" /> Enriching...
            </div>
          ) : (
            <>
              <p className="text-[11px] text-neutral-500">
                {company.engHeadcount ? `${company.engHeadcount} eng` : ""}{company.hqCity ? ` · ${company.hqCity}` : ""}
              </p>
              <div className="flex gap-1.5 justify-end mt-1 flex-wrap">
                {/* Stack mode: show stack badges prominently */}
                {sourcingMode === "stack" && company.stackScanStatus === "complete" && company.techStackVerified.length > 0 && (
                  <>
                    {company.techStackVerified.slice(0, 4).map((tech) => {
                      const confidence = company.stackConfidence?.[tech] || "reported";
                      const matchesRole = mapRoleStack?.some((s) => s.toLowerCase() === tech.toLowerCase());
                      const colorClass =
                        confidence === "confirmed" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                          : confidence === "likely" ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
                          : "bg-neutral-500/10 text-neutral-400 border-neutral-500/20";
                      return (
                        <span key={tech} className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${colorClass} ${matchesRole ? "ring-1 ring-gold/40" : ""}`}>
                          {tech}
                        </span>
                      );
                    })}
                    {company.techStackVerified.length > 4 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-500/10 text-neutral-400 font-medium">+{company.techStackVerified.length - 4}</span>
                    )}
                  </>
                )}
                {sourcingMode === "stack" && company.stackScanStatus === "scanning" && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-gold/10 text-gold font-medium flex items-center gap-1">
                    <Loader2 className="h-2.5 w-2.5 animate-spin" /> Verifying...
                  </span>
                )}

                {/* Company mode: show company attributes prominently */}
                {sourcingMode === "company" && (
                  <>
                    {company.fundingStage && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 font-medium">{company.fundingStage}</span>
                    )}
                    {company.headcount && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-200/50 dark:bg-neutral-700/50 text-neutral-400 font-medium">{company.headcount} people</span>
                    )}
                  </>
                )}

                {/* Role mode (default): show existing badges */}
                {sourcingMode !== "stack" && sourcingMode !== "company" && (
                  <>
                    {company.growthRate && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-medium">{company.growthRate}</span>
                    )}
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-200/50 dark:bg-neutral-700/50 text-neutral-400 font-medium">{company.candidates.length} people</span>
                    {openCount > 0 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 font-medium">{openCount} high risk</span>
                    )}
                    {company.stackScanStatus === "complete" && company.techStackVerified.length > 0 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-medium border border-emerald-500/20">
                        {company.stackConfidence ? Object.values(company.stackConfidence).filter((c) => c === "confirmed").length : 0} verified
                      </span>
                    )}
                  </>
                )}
              </div>
            </>
          )}
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(company.id); }}
          className="opacity-0 group-hover:opacity-100 text-neutral-600 hover:text-red-400 transition-all shrink-0"
        >
          <X className="h-3.5 w-3.5" />
        </button>
        <ChevronDown className={`h-4 w-4 text-neutral-600 transition-transform shrink-0 ${expanded ? "rotate-180" : ""}`} />
      </div>

      {expanded && (
        <div className="border-t border-neutral-200/30 dark:border-neutral-800/50">
          {company.newsSummary && company.flightRiskCompany !== "low" && (
            <div className="px-4 py-2 text-[11px] text-amber-400/80 bg-amber-500/5 border-b border-neutral-200/20 dark:border-neutral-800/30">
              <AlertTriangle className="inline h-3 w-3 mr-1" />
              {company.newsSummary}
            </div>
          )}
          {company.stackScanStatus === "complete" && company.techStackVerified.length > 0 && (
            <div className="px-4 py-2.5 border-b border-neutral-200/20 dark:border-neutral-800/30">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-600 mb-1.5">
                Verified Stack{company.jdCount ? ` (${company.jdCount} JDs analyzed)` : ""}
              </p>
              <div className="flex flex-wrap gap-1">
                {company.techStackVerified.map((tech) => {
                  const confidence = company.stackConfidence?.[tech] || "reported";
                  const sources = company.techStackSources?.[tech] || [];
                  const matchesRole = mapRoleStack?.some(
                    (s) => s.toLowerCase() === tech.toLowerCase()
                  );
                  const colorClass =
                    confidence === "confirmed"
                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                      : confidence === "likely"
                      ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
                      : "bg-neutral-500/10 text-neutral-400 border-neutral-500/20";
                  return (
                    <span
                      key={tech}
                      className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${colorClass} ${matchesRole ? "ring-1 ring-gold/40" : ""}`}
                      title={sources.join(", ")}
                    >
                      {tech}
                    </span>
                  );
                })}
              </div>
            </div>
          )}
          {expanded && company.enrichmentStatus === "complete" && (
            <CompanyTimeline
              candidates={company.candidates}
              newsEvents={company.newsEvents}
              headcount={company.headcount}
              engHeadcount={company.engHeadcount}
            />
          )}
          <p className="px-4 pt-2 pb-1 text-xs font-semibold uppercase tracking-wider text-neutral-600">
            {company.candidates.length} candidates
          </p>
          {company.candidates.map((c) => (
            <CandidateRow
              key={c.id}
              candidate={c}
              mapId={mapId}
              selected={selectedIds.has(c.id)}
              onSelect={onSelectCandidate}
              onSelectPerson={onSelectPerson}
              isActive={activePerson?.id === c.id}
              onCandidateStatusUpdated={onCandidateStatusUpdated}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
//  CANDIDATE DETAIL PANEL
// ═══════════════════════════════════════════════════════════

function CandidateDetail({ person, onClose, mapId }: { person: Candidate; onClose: () => void; mapId: string }) {
  return (
    <div className="map-hud-card relative p-5">
      <button onClick={onClose} className="absolute right-3 top-3 text-neutral-500 transition-colors hover:text-cyan-600 dark:text-neutral-400 dark:hover:text-cyan-300">
        <X className="h-4 w-4" />
      </button>

      <div className="flex items-center gap-3 mb-5">
        <div className={`w-12 h-12 rounded-full flex items-center justify-center text-base font-bold ${person.fitScore ? scoreColor(person.fitScore) : "bg-neutral-800 text-neutral-400"}`}>
          {person.name.split(" ").map(n => n[0]).join("")}
        </div>
        <div>
          <p className="text-base font-semibold text-neutral-900 dark:text-white">{person.name}</p>
          <p className="text-xs text-neutral-500 mt-0.5">{person.title}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-5">
        {[
          { label: "Fit score", val: person.fitScore != null ? String(person.fitScore) : "—" },
          { label: "Seniority", val: person.seniority || "—" },
          { label: "Location", val: [person.city, person.state].filter(Boolean).join(", ") || "—" },
          { label: "Status", val: STATUS_CONFIG[person.status]?.label || person.status },
        ].map((m) => (
          <div key={m.label} className="rounded-lg bg-neutral-100/60 dark:bg-neutral-800/40 p-3">
            <p className="text-xs uppercase tracking-wider text-neutral-500 mb-1">{m.label}</p>
            <p className="text-sm font-semibold text-neutral-900 dark:text-white">{m.val}</p>
          </div>
        ))}
      </div>

      {person.fitReasoning && (
        <div className="mb-4 rounded-lg bg-neutral-50/50 dark:bg-neutral-800/30 p-3">
          <p className="text-xs uppercase tracking-wider text-neutral-500 mb-1">Fit analysis</p>
          <p className="text-xs text-neutral-700 dark:text-neutral-300">{person.fitReasoning}</p>
        </div>
      )}

      {person.shortlistNote && (
        <div className="mb-4 rounded-lg bg-gold/5 border border-gold/10 p-3">
          <p className="text-xs uppercase tracking-wider text-gold mb-1 font-semibold">Shortlist Note</p>
          <p className="text-xs text-neutral-700 dark:text-neutral-300">{person.shortlistNote}</p>
        </div>
      )}

      {person.flightRisk && person.flightRisk !== "low" && (
        <div className={`mb-4 rounded-lg p-3 ${person.flightRisk === "high" ? "bg-red-500/5 border border-red-500/10" : "bg-amber-500/5 border border-amber-500/10"}`}>
          <p className="text-xs uppercase tracking-wider text-neutral-500 mb-2">Flight risk: {person.flightRisk}</p>
          {person.flightRiskSignals.map((s) => (
            <div key={s} className="flex items-start gap-2 mb-1 text-xs text-neutral-700 dark:text-neutral-300">
              <Shield className="h-3 w-3 mt-0.5 shrink-0 text-amber-400" />
              {FLIGHT_RISK_LABELS[s] || s}
            </div>
          ))}
          {person.flightRiskReasoning && (
            <p className="mt-2 text-[11px] text-neutral-400 italic">{person.flightRiskReasoning}</p>
          )}
          {person.flightRisk === "high" && (
            <p className="mt-2 text-[10px] text-emerald-400 font-medium">Consider reaching out soon — this candidate may be open to new opportunities</p>
          )}
        </div>
      )}

      <div className="flex items-center gap-2 mb-4">
        {person.linkedinUrl && (
          <a href={person.linkedinUrl} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors">
            <Link2 className="h-3.5 w-3.5" /> LinkedIn
          </a>
        )}
        {person.email && (
          <span className="text-xs text-neutral-400">{person.email}</span>
        )}
        {!person.email && (
          <button className="text-xs text-gold hover:text-gold-hover transition-colors">
            Reveal contact (1 credit)
          </button>
        )}
      </div>

      <div className="flex gap-2">
        {person.id && (
          <AddToSequenceButton developerId={person.id} sourceType="map_candidate" className="flex-1 py-2 text-xs" />
        )}
        <DraftInStudioButton
          variant="button"
          candidate={fromMapCandidate(person, mapId, "")}
          className="flex-1 py-2 text-xs"
        />
      </div>

      <div className="mt-4 pt-3 border-t border-neutral-200/20 dark:border-neutral-800/30 flex items-center justify-center gap-3 text-[10px] text-neutral-500">
        <span><kbd className="px-1 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 font-mono">←</kbd> <kbd className="px-1 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 font-mono">→</kbd> navigate</span>
        <span><kbd className="px-1 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 font-mono">S</kbd> shortlist</span>
        <span><kbd className="px-1 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 font-mono">X</kbd> reject</span>
        <span><kbd className="px-1 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 font-mono">Esc</kbd> close</span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
//  TIER SECTION
// ═══════════════════════════════════════════════════════════

function TierSection({ tier, companies, mapId, expandedCo, onToggleCo, selectedIds, onSelectCandidate, onSelectPerson, activePerson, onRemoveCompany, onAddCompany, connectionCounts, mapRoleStack, sourcingMode, onCandidateStatusUpdated }: {
  tier: Tier; companies: Company[]; mapId: string; expandedCo: string | null;
  onToggleCo: (name: string) => void; selectedIds: Set<string>;
  onSelectCandidate: (id: string) => void; onSelectPerson: (c: Candidate) => void;
  activePerson: Candidate | null; onRemoveCompany: (id: string) => void;
  onAddCompany: (tier: Tier) => void;
  connectionCounts?: Record<string, number>;
  mapRoleStack?: string[];
  sourcingMode?: string;
  onCandidateStatusUpdated?: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `tier-${tier}`, data: { tier } });
  const cfg = TIER_CONFIG[tier];
  const totalPeople = companies.reduce((a, c) => a + c.candidates.length, 0);
  const avgScore = totalPeople > 0
    ? Math.round(companies.reduce((a, c) => a + c.candidates.reduce((s, p) => s + (p.fitScore || 0), 0), 0) / totalPeople)
    : 0;

  return (
    <div ref={setNodeRef} className={`-m-2 rounded-xl border border-transparent p-2 transition-all dark:border-cyan-500/0 ${isOver ? "bg-cyan-500/5 ring-1 ring-cyan-400/30" : ""}`}>
      <div className="mb-3 flex items-center gap-2.5">
        <div className={`h-2.5 w-2.5 rounded shadow-[0_0_10px_currentColor] ${cfg.dot}`} />
        <span className="bg-gradient-to-r from-neutral-900 to-neutral-600 bg-clip-text font-mono text-sm font-bold tracking-wide text-transparent dark:from-white dark:to-cyan-100/80">{cfg.label}</span>
        <span className="text-xs text-neutral-500 dark:text-cyan-200/35">{cfg.sub}</span>
        {tier === "A" && <FeatureHint id="map-tier-a" message="Tier A = closest competitors for this talent. Start your outreach here." position="right" />}
      </div>
      <div className="flex gap-2 mb-3">
        {[
          { val: companies.length, label: "cos" },
          { val: totalPeople, label: "people" },
          { val: avgScore, label: "avg fit" },
        ].map((b) => (
          <div key={b.label} className={`rounded-md border px-2.5 py-1 text-[11px] ${cfg.badge}`}>
            <span className="font-semibold">{b.val}</span>
            <span className="opacity-70"> {b.label}</span>
          </div>
        ))}
      </div>
      <div className="space-y-2">
        {companies.map((co) => (
          <DraggableCompanyCard
            key={co.id}
            company={co}
            mapId={mapId}
            tier={tier}
            expanded={expandedCo === co.id}
            onToggle={() => onToggleCo(co.id)}
            selectedIds={selectedIds}
            onSelectCandidate={onSelectCandidate}
            onSelectPerson={onSelectPerson}
            activePerson={activePerson}
            onRemove={onRemoveCompany}
            connectionCount={connectionCounts?.[co.id]}
            mapRoleStack={mapRoleStack}
            sourcingMode={sourcingMode}
            onCandidateStatusUpdated={onCandidateStatusUpdated}
          />
        ))}
        {companies.length === 0 && (
          <p className="text-xs text-neutral-600 italic py-4 text-center">No companies in this tier</p>
        )}
        <button
          onClick={() => onAddCompany(tier)}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-cyan-500/20 py-2.5 font-mono text-[10px] font-medium uppercase tracking-wider text-neutral-500 transition-all hover:border-gold/35 hover:text-gold dark:border-cyan-400/15 dark:text-cyan-200/40"
        >
          <Plus className="h-3 w-3" /> Add company
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
//  MAIN PAGE
// ═══════════════════════════════════════════════════════════

function MarketMapInner() {
  const { data: session } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const mapIdParam = searchParams.get("id");

  // Sourcing mode
  type SourcingMode = "role" | "stack" | "company";
  const [sourcingMode, setSourcingMode] = useState<SourcingMode>("role");

  // Form state — role mode
  const [roleTitle, setRoleTitle] = useState("Sr. Platform Engineer");
  const [roleLevel, setRoleLevel] = useState("senior");
  const [roleStack, setRoleStack] = useState("Go, Kubernetes");
  const [geography, setGeography] = useState("San Francisco");
  const [roleDescription, setRoleDescription] = useState("");
  const [compRangeMin, setCompRangeMin] = useState("");
  const [compRangeMax, setCompRangeMax] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Form state — stack mode
  const [targetStack, setTargetStack] = useState<string[]>([]);
  const [stackInput, setStackInput] = useState("");

  // Form state — company mode
  const [companyLocation, setCompanyLocation] = useState("");
  const [companyMinSize, setCompanyMinSize] = useState("");
  const [companyMaxSize, setCompanyMaxSize] = useState("");
  const [companyFunding, setCompanyFunding] = useState<string[]>([]);
  const [companySearchResults, setCompanySearchResults] = useState<Array<{ name: string; domain: string; headcount: number | null; city: string | null; funding: string | null; techStack: string[] }>>([]);
  const [companySearching, setCompanySearching] = useState(false);

  // Map state
  const [mapData, setMapData] = useState<MapData | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recentMaps, setRecentMaps] = useState<Array<{
    id: string; name: string; roleTitle: string; status: string;
    companyCount: number; candidateCount: number; createdAt: string;
  }>>([]);
  const [expandedCo, setExpandedCo] = useState<string | null>(null);
  const [activePerson, setActivePerson] = useState<Candidate | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [addCompanyTier, setAddCompanyTier] = useState<Tier | null>(null);
  const [addCompanyQuery, setAddCompanyQuery] = useState("");
  const [addCompanyResults, setAddCompanyResults] = useState<Array<{ company_name: string; company_domain: string; headcount: number | null; hq_city: string | null; apollo_org_id: string | null }>>([]);
  const [addCompanyLoading, setAddCompanyLoading] = useState(false);
  const [flightRiskFilter, setFlightRiskFilter] = useState(false);
  const [connectionCounts, setConnectionCounts] = useState<Record<string, number>>({});
  const [revealLoading, setRevealLoading] = useState(false);
  const [resumeUploading, setResumeUploading] = useState(false);
  const resumeInputRef = useRef<HTMLInputElement>(null);

  const allCandidates = useMemo(() => {
    if (!mapData) return [];
    const flat: Candidate[] = [];
    for (const tier of ["A", "B", "C"] as Tier[]) {
      for (const co of (mapData.tiers[tier] || []) as Company[]) {
        for (const c of co.candidates) {
          flat.push(c);
        }
      }
    }
    return flat;
  }, [mapData]);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  // Handle drag end — move company to new tier
  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || !mapData) return;

    const overId = String(over.id);
    if (!overId.startsWith("tier-")) return;
    const newTier = overId.replace("tier-", "") as Tier;
    const companyId = String(active.id);

    // Find which tier this company is currently in
    let currentTier: string | null = null;
    for (const [tier, companies] of Object.entries(mapData.tiers)) {
      if ((companies as Company[]).some((c) => c.id === companyId)) {
        currentTier = tier;
        break;
      }
    }
    if (!currentTier || currentTier === newTier) return;

    // Optimistic UI: move the company
    const company = (mapData.tiers[currentTier] as Company[]).find((c) => c.id === companyId);
    if (!company) return;

    setMapData({
      ...mapData,
      tiers: {
        ...mapData.tiers,
        [currentTier]: (mapData.tiers[currentTier] as Company[]).filter((c) => c.id !== companyId),
        [newTier]: [...(mapData.tiers[newTier] as Company[] || []), { ...company, tier: newTier }],
      },
    });

    // Persist
    await fetch(`/api/market-map/${mapData.id}/company/${companyId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tier: newTier }),
    });
  }

  // Load recent maps when no map is selected
  useEffect(() => {
    if (!session?.user?.id || mapIdParam) return;
    fetch("/api/market-map/list")
      .then((r) => r.json())
      .then((data) => setRecentMaps(data.maps || []))
      .catch(() => {});
  }, [session, mapIdParam]);

  // Add company search
  useEffect(() => {
    if (!addCompanyQuery || addCompanyQuery.length < 2) {
      setAddCompanyResults([]);
      return;
    }
    const timeout = setTimeout(async () => {
      setAddCompanyLoading(true);
      try {
        const res = await fetch(`/api/apollo/company-search?q=${encodeURIComponent(addCompanyQuery)}`);
        if (res.ok) {
          const data = await res.json();
          setAddCompanyResults(data.results || []);
        }
      } catch { /* ignore */ }
      finally { setAddCompanyLoading(false); }
    }, 300);
    return () => clearTimeout(timeout);
  }, [addCompanyQuery]);

  async function addCompany(co: { company_name: string; company_domain: string; apollo_org_id: string | null }) {
    if (!mapData || !addCompanyTier) return;
    setAddCompanyTier(null);
    setAddCompanyQuery("");

    await fetch(`/api/market-map/${mapData.id}/company/add`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        company_name: co.company_name,
        company_domain: co.company_domain,
        tier: addCompanyTier,
        apollo_org_id: co.apollo_org_id,
      }),
    });

    // Reload map to show the new company
    loadMap(mapData.id);
  }

  // Load existing map if ID in URL
  const loadMap = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/market-map/${id}`);
      if (!res.ok) {
        if (res.status === 404) {
          throw new Error("MAP_NOT_FOUND");
        }
        throw new Error("SERVER_ERROR");
      }
      const data = await res.json();
      setMapData(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "SERVER_ERROR";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-verify all companies in stack mode
  async function verifyAllStacks() {
    if (!mapData) return;
    const companies = Object.values(mapData.tiers).flat() as Company[];
    const unverified = companies.filter(
      (c) => c.enrichmentStatus === "complete" && !c.stackScanStatus
    );
    // Run up to 3 at a time
    for (let i = 0; i < unverified.length; i += 3) {
      const batch = unverified.slice(i, i + 3);
      await Promise.allSettled(
        batch.map((c) =>
          fetch("/api/market-map/enrich-stack", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ company_id: c.id, company_name: c.companyName, company_domain: c.companyDomain }),
          })
        )
      );
    }
    if (mapData) loadMap(mapData.id);
  }

  // Search companies by filters (company mode)
  async function searchCompanies() {
    setCompanySearching(true);
    const overlayStartedAt = Date.now();
    try {
      const res = await fetch("/api/market-map/search-companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          location: companyLocation || undefined,
          min_headcount: companyMinSize ? parseInt(companyMinSize) : undefined,
          max_headcount: companyMaxSize ? parseInt(companyMaxSize) : undefined,
          funding_stages: companyFunding.length > 0 ? companyFunding : undefined,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        await waitMinOverlayMs(overlayStartedAt, MAP_SEARCH_OVERLAY_MIN_MS);
        setCompanySearchResults(data.companies || []);
      }
    } catch {
      showError("Company search failed. Try again.");
    }
    setCompanySearching(false);
  }

  // Fetch connection counts for all companies on the map
  const loadConnectionCounts = useCallback(async (mapId: string) => {
    try {
      const res = await fetch(`/api/market-map/${mapId}/connections`);
      if (res.ok) {
        const data = await res.json();
        setConnectionCounts(data.counts || {});
      }
    } catch {
      // Non-fatal — badges just won't show
    }
  }, []);

  useEffect(() => {
    if (mapIdParam) loadMap(mapIdParam);
  }, [mapIdParam, loadMap]);

  // Load connection counts when map data is available
  useEffect(() => {
    if (mapData?.id) {
      loadConnectionCounts(mapData.id);
    }
  }, [mapData?.id, loadConnectionCounts]);

  // Keyboard navigation for candidate review
  useEffect(() => {
    if (!activePerson || allCandidates.length === 0) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
      const currentIndex = allCandidates.findIndex(c => c.id === activePerson!.id);
      if (currentIndex === -1) return;
      switch (e.key) {
        case "ArrowRight":
        case "ArrowDown":
          e.preventDefault();
          if (currentIndex < allCandidates.length - 1) setActivePerson(allCandidates[currentIndex + 1]);
          break;
        case "ArrowLeft":
        case "ArrowUp":
          e.preventDefault();
          if (currentIndex > 0) setActivePerson(allCandidates[currentIndex - 1]);
          break;
        case "Escape":
          e.preventDefault();
          setActivePerson(null);
          break;
        case "s":
          e.preventDefault();
          fetch(`/api/market-map/${mapData!.id}/candidate/${activePerson!.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "shortlisted" }),
          }).then(() => { showSuccess("Shortlisted"); loadMap(mapData!.id); });
          break;
        case "x":
          e.preventDefault();
          fetch(`/api/market-map/${mapData!.id}/candidate/${activePerson!.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "rejected" }),
          }).then(() => {
            showSuccess("Rejected — advancing");
            if (currentIndex < allCandidates.length - 1) setActivePerson(allCandidates[currentIndex + 1]);
            loadMap(mapData!.id);
          });
          break;
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activePerson, allCandidates, mapData, loadMap]);

  // Resume upload handler
  async function handleResumeUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setResumeUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/market-map/parse-resume", { method: "POST", body: formData });
      if (res.ok) {
        const data = await res.json();
        if (data.role_title) setRoleTitle(data.role_title);
        if (data.role_level) setRoleLevel(data.role_level);
        if (data.role_stack?.length) setRoleStack(data.role_stack.join(", "));
        if (data.location) setGeography(data.location);
      }
    } catch { /* ignore */ }
    setResumeUploading(false);
    if (resumeInputRef.current) resumeInputRef.current.value = "";
  }

  // Generate new map
  async function generateMap() {
    if (!session?.user?.id) {
      setError("Please sign in to generate market maps");
      return;
    }
    setGenerating(true);
    setError(null);
    const overlayStartedAt = Date.now();

    try {
      const res = await fetch("/api/market-map/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role_title: roleTitle,
          role_level: roleLevel,
          role_stack: roleStack.split(",").map((s) => s.trim()).filter(Boolean),
          geography: geography ? [geography] : [],
          role_description: roleDescription || undefined,
          comp_range_min: compRangeMin ? parseInt(compRangeMin) * 1000 : undefined,
          comp_range_max: compRangeMax ? parseInt(compRangeMax) * 1000 : undefined,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Map generation failed");
      }

      const data = await res.json();
      await waitMinOverlayMs(overlayStartedAt, MAP_GEN_OVERLAY_MIN_MS);
      showSuccess(`Map generated! Enriching ${data.companies.length} companies...`);
      router.push(`/map?id=${data.mapId}`);
      trackEvent("map_generated", { roleTitle, roleLevel, sourcingMode });

      // Enrich companies in background — process 2 at a time to avoid timeouts
      const companies = data.companies || [];
      (async () => {
        for (let i = 0; i < companies.length; i += 2) {
          const batch = companies.slice(i, i + 2);
          await Promise.all(
            batch.map((co: { id: string; domain: string; name: string }) =>
              fetch("/api/market-map/enrich-company", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  map_id: data.mapId,
                  company_id: co.id,
                  company_domain: co.domain,
                  company_name: co.name,
                  role_title: roleTitle,
                  role_level: roleLevel,
                  role_stack: roleStack.split(",").map((s: string) => s.trim()),
                  geography: geography ? [geography] : [],
                }),
              }).catch(() => {})
            )
          );
          // Reload map after each batch to show progress
          loadMap(data.mapId);
        }
      })();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  }

  function toggleSelectCandidate(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function removeCompany(companyId: string) {
    if (!mapData) return;
    await fetch(`/api/market-map/${mapData.id}/company/${companyId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hidden: true }),
    });
    loadMap(mapData.id);
  }

  async function bulkUpdateStatus(status: string) {
    if (!mapData || selectedIds.size === 0) return;
    await fetch(`/api/market-map/${mapData.id}/candidates/bulk-update`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ candidate_ids: Array.from(selectedIds), update: { status } }),
    });
    showSuccess(`Updated ${selectedIds.size} candidates to ${status}`);
    trackEvent("bulk_status_updated", { status, count: selectedIds.size });
    setSelectedIds(new Set());
    loadMap(mapData.id);
  }

  async function bulkRevealContacts() {
    if (!mapData || selectedIds.size === 0) return;
    setRevealLoading(true);
    try {
      const ids = Array.from(selectedIds);
      for (let i = 0; i < ids.length; i += 10) {
        const batch = ids.slice(i, i + 10);
        await fetch("/api/market-map/reveal-contacts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ candidate_ids: batch }),
        });
      }
      showSuccess(`Revealed contacts for ${ids.length} candidates`);
      trackEvent("contacts_revealed", { count: ids.length });
      loadMap(mapData.id);
    } catch (err) {
      console.error("Reveal contacts error:", err);
      showError("Failed to reveal contacts");
    } finally {
      setRevealLoading(false);
    }
  }

  function getSelectedCandidates(): Array<Candidate & { companyName: string }> {
    if (!mapData) return [];
    const results: Array<Candidate & { companyName: string }> = [];
    for (const companies of Object.values(mapData.tiers)) {
      for (const co of companies as Company[]) {
        for (const c of co.candidates) {
          if (selectedIds.has(c.id)) {
            results.push({ ...c, companyName: co.companyName });
          }
        }
      }
    }
    return results;
  }

  function handleDraftInStudio() {
    if (!mapData) return;
    const candidates = getSelectedCandidates();
    if (candidates.length === 0) return;
    const batch = {
      mapId: mapData.id,
      candidates: candidates.map((c) => ({
        id: c.id,
        name: c.name,
        title: c.title,
        company: c.companyName,
        location: [c.city, c.state, c.country].filter(Boolean).join(", ") || null,
        linkedinUrl: c.linkedinUrl,
        email: c.email,
        fitScore: c.fitScore,
        fitReasoning: c.fitReasoning,
        flightRisk: c.flightRisk,
        flightRiskSignals: c.flightRiskSignals,
        seniority: c.seniority,
      })),
    };
    sessionStorage.setItem("gitscout_outreach_batch", JSON.stringify(batch));
    router.push(`/outreach?batch=map&mapId=${mapData.id}`);
  }

  const allCompanies = mapData ? Object.values(mapData.tiers).flat() : [];
  const totalCandidates = allCompanies.reduce((s, c) => s + c.candidates.length, 0);

  const allSelectedHaveEmail = (() => {
    if (!mapData || selectedIds.size === 0) return false;
    const candidates = getSelectedCandidates();
    return candidates.every((c) => c.email);
  })();

  const mappingOverlayLabel =
    generating
      ? sourcingMode === "stack"
        ? targetStack.join(" · ") || "your stack"
        : roleTitle
      : [companyLocation, companyFunding.join(", ")].filter(Boolean).join(" · ") || "your filters";

  return (
    <div className="map-hud mx-auto max-w-6xl overflow-x-hidden px-4 py-6 sm:px-6 lg:px-8">
      <MarketMapGeneratingOverlay
        show={generating || companySearching}
        kind={generating ? "generate" : "search"}
        focusLabel={mappingOverlayLabel}
      />
      <div className="map-hud-inner">
      {/* Header */}
      <header className="mb-8 border-b border-neutral-200/50 pb-8 dark:border-cyan-500/10">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex gap-4 min-w-0">
            <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-cyan-500/25 bg-gradient-to-br from-gold-bg to-cyan-500/5 shadow-[0_0_28px_rgba(34,211,238,0.12)] dark:from-cyan-500/10 dark:to-violet-500/5 dark:shadow-[0_0_36px_rgba(34,211,238,0.15)]">
              <Map className="h-7 w-7 text-gold dark:text-cyan-200" aria-hidden />
              <span className="absolute -right-0.5 -top-0.5 flex h-2 w-2 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.9)] animate-pulse" aria-hidden />
            </div>
            <div className="min-w-0">
              <p className="font-mono text-[10px] font-medium tracking-[0.2em] text-cyan-700/90 dark:text-cyan-400/70">
                TALENT MESH // SCOUT OS
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-2 gap-y-1">
                <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-white sm:text-3xl">
                  Market <span className="bg-gradient-to-r from-gold via-cyan-200 to-violet-300 bg-clip-text text-transparent dark:from-gold dark:via-cyan-300 dark:to-violet-400">Map</span>
                </h1>
                <span className="inline-flex items-center gap-1 rounded-md border border-cyan-500/25 bg-cyan-500/5 px-2 py-0.5 font-mono text-[9px] font-bold tracking-wider text-cyan-700 dark:border-cyan-400/30 dark:bg-cyan-400/10 dark:text-cyan-300">
                  <Sparkles className="h-2.5 w-2.5" />
                  LIVE
                </span>
              </div>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
                Neural company tiers, fit vectors, and flight-risk telemetry—shortlist and beam candidates into Outreach in one run.
              </p>
            </div>
          </div>
          <nav className="flex flex-wrap items-center gap-2 sm:justify-end sm:pt-1" aria-label="Market map shortcuts">
            <Link
              href="/map/dashboard"
              className="inline-flex items-center gap-2 rounded-lg border border-neutral-200/70 bg-white/60 px-3 py-2 font-mono text-[11px] font-medium uppercase tracking-wide text-neutral-800 transition-all hover:border-cyan-400/35 hover:shadow-[0_0_20px_rgba(34,211,238,0.12)] dark:border-cyan-500/20 dark:bg-black/40 dark:text-cyan-100/90 dark:hover:border-cyan-400/40 dark:hover:shadow-[0_0_24px_rgba(34,211,238,0.12)]"
            >
              <LayoutDashboard className="h-3.5 w-3.5 text-gold" />
              All maps
            </Link>
            <Link
              href="/map/templates"
              className="inline-flex items-center gap-2 rounded-lg border border-neutral-200/70 bg-white/60 px-3 py-2 font-mono text-[11px] font-medium uppercase tracking-wide text-neutral-800 transition-all hover:border-cyan-400/35 hover:shadow-[0_0_20px_rgba(34,211,238,0.12)] dark:border-cyan-500/20 dark:bg-black/40 dark:text-cyan-100/90 dark:hover:border-cyan-400/40 dark:hover:shadow-[0_0_24px_rgba(34,211,238,0.12)]"
            >
              <Copy className="h-3.5 w-3.5 text-gold" />
              Templates
            </Link>
          </nav>
        </div>
      </header>

      {/* Sourcing mode selector + Generate form */}
      {!mapData && (
        <div
          data-onboarding="market-map"
          className="map-hud-card relative mb-6 overflow-hidden"
        >
          <div className="map-hud-beam" aria-hidden />
          <div className="p-5 sm:p-6">
          {/* Mode selector — stacks on narrow viewports to avoid horizontal overflow */}
          <div className="map-hud-chip mb-5 grid grid-cols-1 gap-2 sm:grid-cols-3">
            {([
              { id: "role" as const, label: "By Role", desc: "AI picks target companies for a role" },
              { id: "stack" as const, label: "By Stack", desc: "Find companies using specific tech" },
              { id: "company" as const, label: "By Company", desc: "Search by size, location, funding" },
            ]).map((mode) => (
              <button
                key={mode.id}
                type="button"
                onClick={() => { setSourcingMode(mode.id); trackEvent("sourcing_mode_changed", { mode: mode.id }); }}
                className={`rounded-lg px-3 py-2.5 text-left transition-all sm:text-center ${
                  sourcingMode === mode.id
                    ? "bg-gradient-to-br from-gold to-amber-600 text-white shadow-[0_0_24px_rgba(200,165,90,0.35)] ring-1 ring-cyan-400/30 dark:from-gold dark:to-amber-700 dark:shadow-[0_0_32px_rgba(34,211,238,0.2)]"
                    : "text-neutral-600 hover:bg-white/90 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-cyan-500/10 dark:hover:text-cyan-100"
                }`}
              >
                <p className="text-xs font-semibold">{mode.label}</p>
                <p className={`mt-0.5 text-[10px] leading-snug ${sourcingMode === mode.id ? "text-white/80" : "text-neutral-500 dark:text-neutral-500"}`}>
                  {mode.desc}
                </p>
              </button>
            ))}
          </div>

          <div className="mb-4 flex justify-end">
            <Link
              href="/intake/new"
              className="inline-flex items-center gap-1.5 font-mono text-[11px] font-medium uppercase tracking-wide text-cyan-700/80 transition-colors hover:text-gold dark:text-cyan-400/70"
            >
              <FileText className="h-3.5 w-3.5" />
              Start from an intake call
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          {/* Role mode form */}
          {sourcingMode === "role" && (
            <>
              <div className="mb-4">
                <input ref={resumeInputRef} type="file" accept=".pdf" onChange={handleResumeUpload} className="hidden" />
                <button
                  type="button"
                  onClick={() => resumeInputRef.current?.click()}
                  disabled={resumeUploading}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-cyan-500/25 bg-cyan-500/[0.03] px-4 py-3 text-sm text-neutral-500 transition-all hover:border-gold/40 hover:text-gold hover:shadow-[0_0_20px_rgba(34,211,238,0.08)] dark:border-cyan-400/20 dark:text-neutral-400 dark:hover:text-cyan-200"
                >
                  {resumeUploading ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Parsing resume...</>
                  ) : (
                    <><Download className="h-4 w-4 rotate-180" /> Import from Resume (PDF)</>
                  )}
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                <div>
                  <label className="map-hud-label">Role title</label>
                  <input type="text" value={roleTitle} onChange={(e) => setRoleTitle(e.target.value)}
                    className={MAP_FIELD} />
                </div>
                <div>
                  <label className="map-hud-label">Level</label>
                  <select value={roleLevel} onChange={(e) => setRoleLevel(e.target.value)}
                    className={MAP_FIELD}>
                    <option value="mid">Mid</option>
                    <option value="senior">Senior</option>
                    <option value="staff">Staff</option>
                    <option value="principal">Principal</option>
                  </select>
                </div>
                <div>
                  <label className="map-hud-label">Tech stack</label>
                  <input type="text" value={roleStack} onChange={(e) => setRoleStack(e.target.value)} placeholder="Go, Kubernetes, AWS"
                    className={MAP_FIELD} />
                </div>
                <div>
                  <label className="map-hud-label">Geography</label>
                  <input type="text" value={geography} onChange={(e) => setGeography(e.target.value)} placeholder="San Francisco"
                    className={MAP_FIELD} />
                </div>
              </div>

              {/* Advanced fields toggle */}
              <button type="button" onClick={() => setShowAdvanced(!showAdvanced)}
                className="mb-3 flex items-center gap-1 font-mono text-[10px] font-medium uppercase tracking-wider text-cyan-700/80 transition-colors hover:text-gold dark:text-cyan-400/60">
                <ChevronDown className={`h-3 w-3 transition-transform ${showAdvanced ? "rotate-180" : ""}`} />
                {showAdvanced ? "Hide" : "Show"} advanced options
              </button>

              {showAdvanced && (
                <div className="space-y-3 mb-4">
                  <div>
                    <label className="map-hud-label">Role description</label>
                    <textarea value={roleDescription} onChange={(e) => setRoleDescription(e.target.value)}
                      placeholder="Describe the ideal candidate, team context, key responsibilities..."
                      rows={3} className={`${MAP_FIELD} resize-none`} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="map-hud-label">Comp min ($K)</label>
                      <input type="number" value={compRangeMin} onChange={(e) => setCompRangeMin(e.target.value)} placeholder="150"
                        className={MAP_FIELD} />
                    </div>
                    <div>
                      <label className="map-hud-label">Comp max ($K)</label>
                      <input type="number" value={compRangeMax} onChange={(e) => setCompRangeMax(e.target.value)} placeholder="220"
                        className={MAP_FIELD} />
                    </div>
                  </div>
                </div>
              )}

              <button onClick={generateMap} disabled={generating || !roleTitle}
                className="map-hud-btn-primary flex items-center gap-2 bg-gold px-5 py-2.5 text-sm text-neutral-900 hover:bg-gold-hover dark:text-white disabled:opacity-50">
                {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Map className="h-4 w-4" />}
                {generating ? "Generating map..." : "Generate market map"}
              </button>
            </>
          )}

          {/* Stack mode form */}
          {sourcingMode === "stack" && (
            <>
              <div className="mb-4">
                <label className="map-hud-label">Target technologies</label>
                <div className="flex flex-wrap gap-1.5 mb-2 min-h-[28px]">
                  {targetStack.map((tech) => (
                    <span key={tech} className="flex items-center gap-1 rounded-md bg-gold/10 border border-gold/20 px-2 py-1 text-xs font-medium text-gold">
                      {tech}
                      <button onClick={() => setTargetStack(targetStack.filter((t) => t !== tech))} className="hover:text-gold-hover">
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={stackInput}
                    onChange={(e) => setStackInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && stackInput.trim()) {
                        e.preventDefault();
                        if (!targetStack.includes(stackInput.trim())) {
                          setTargetStack([...targetStack, stackInput.trim()]);
                        }
                        setStackInput("");
                      }
                    }}
                    placeholder="Type a technology and press Enter"
                    className={MAP_FIELD_FLEX}
                  />
                  <button
                    onClick={() => {
                      if (stackInput.trim() && !targetStack.includes(stackInput.trim())) {
                        setTargetStack([...targetStack, stackInput.trim()]);
                        setStackInput("");
                      }
                    }}
                    className="rounded-lg border border-cyan-500/20 bg-cyan-500/5 px-3 py-2 text-xs font-medium text-neutral-600 transition-colors hover:border-gold/40 hover:text-gold dark:border-cyan-400/25 dark:text-neutral-400 dark:hover:text-cyan-200"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
                <p className="text-[10px] text-neutral-400 mt-1.5">Scout will verify each company&apos;s stack via job boards + GitHub repos</p>
              </div>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <label className="map-hud-label">Role context (optional)</label>
                  <input type="text" value={roleTitle} onChange={(e) => setRoleTitle(e.target.value)} placeholder="e.g. Frontend Engineer"
                    className={MAP_FIELD} />
                </div>
                <div>
                  <label className="map-hud-label">Geography (optional)</label>
                  <input type="text" value={geography} onChange={(e) => setGeography(e.target.value)} placeholder="San Francisco"
                    className={MAP_FIELD} />
                </div>
              </div>
              <button onClick={generateMap} disabled={generating || targetStack.length === 0}
                className="map-hud-btn-primary flex items-center gap-2 bg-gold px-5 py-2.5 text-sm text-neutral-900 hover:bg-gold-hover dark:text-white disabled:opacity-50">
                {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                {generating ? "Finding companies..." : "Find companies using this stack"}
              </button>
            </>
          )}

          {/* Company mode form */}
          {sourcingMode === "company" && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                <div>
                  <label className="map-hud-label">Location</label>
                  <input type="text" value={companyLocation} onChange={(e) => setCompanyLocation(e.target.value)} placeholder="San Francisco, NYC"
                    className={MAP_FIELD} />
                </div>
                <div>
                  <label className="map-hud-label">Min headcount</label>
                  <input type="number" value={companyMinSize} onChange={(e) => setCompanyMinSize(e.target.value)} placeholder="50"
                    className={MAP_FIELD} />
                </div>
                <div>
                  <label className="map-hud-label">Max headcount</label>
                  <input type="number" value={companyMaxSize} onChange={(e) => setCompanyMaxSize(e.target.value)} placeholder="500"
                    className={MAP_FIELD} />
                </div>
                <div>
                  <label className="map-hud-label">Funding stage</label>
                  <div className="flex flex-wrap gap-1">
                    {["Seed", "Series A", "Series B", "Series C", "Series D+", "IPO"].map((stage) => (
                      <button
                        key={stage}
                        onClick={() => setCompanyFunding(
                          companyFunding.includes(stage) ? companyFunding.filter((s) => s !== stage) : [...companyFunding, stage]
                        )}
                        className={`rounded px-2 py-1 text-[10px] font-medium transition-colors ${
                          companyFunding.includes(stage)
                            ? "bg-gold/10 text-gold border border-gold/20"
                            : "bg-neutral-100/50 dark:bg-neutral-800/50 text-neutral-500 border border-neutral-200/50 dark:border-neutral-700/50 hover:border-gold/30"
                        }`}
                      >
                        {stage}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <button onClick={searchCompanies} disabled={companySearching}
                className="map-hud-btn-primary flex items-center gap-2 bg-gold px-5 py-2.5 text-sm text-neutral-900 hover:bg-gold-hover dark:text-white disabled:opacity-50">
                {companySearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                {companySearching ? "Searching..." : "Search companies"}
              </button>

              {/* Company search results */}
              {companySearchResults.length > 0 && (
                <div className="mt-4 space-y-2">
                  <p className="map-hud-label opacity-80">{companySearchResults.length} matches detected</p>
                  <div className="max-h-64 space-y-1.5 overflow-y-auto">
                    {companySearchResults.map((co) => (
                      <div key={co.domain} className="flex items-center justify-between rounded-lg border border-cyan-500/15 bg-white/40 px-3 py-2.5 dark:bg-black/25">
                        <div>
                          <p className="text-sm font-medium text-neutral-900 dark:text-white">{co.name}</p>
                          <p className="text-[11px] text-neutral-500">
                            {[co.city, co.headcount ? `${co.headcount} people` : null, co.funding].filter(Boolean).join(" · ")}
                          </p>
                          {co.techStack.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {co.techStack.slice(0, 5).map((t) => (
                                <span key={t} className="text-[9px] px-1 py-0.5 rounded bg-neutral-100/50 dark:bg-neutral-800/50 text-neutral-500">{t}</span>
                              ))}
                            </div>
                          )}
                        </div>
                        <button className="text-[10px] px-2.5 py-1 rounded bg-gold/10 text-gold font-medium hover:bg-gold/20 border border-gold/20 transition-colors shrink-0">
                          + Add
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
          </div>
        </div>
      )}

      {/* Recent maps */}
      {!mapData && !loading && recentMaps.length > 0 && (
        <div className="mb-8">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="font-mono text-sm font-bold uppercase tracking-wide text-neutral-900 dark:text-cyan-100/90">Resume session</h2>
              <p className="mt-0.5 text-xs text-neutral-500 dark:text-cyan-200/40">Recent meshes in this workspace</p>
            </div>
            <Link href="/map/templates" className="font-mono text-[10px] font-semibold uppercase tracking-wider text-cyan-600 transition-colors hover:text-gold dark:text-cyan-400/80">
              Templates →
            </Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {recentMaps.slice(0, 6).map((m) => (
              <Link
                key={m.id}
                href={`/map?id=${m.id}`}
                className="glow-hover rounded-xl border border-cyan-500/15 bg-white/60 p-4 transition-all backdrop-blur-sm dark:border-cyan-500/20 dark:bg-black/35 dark:hover:border-cyan-400/35 dark:hover:shadow-[0_0_28px_rgba(34,211,238,0.08)]"
              >
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-semibold text-neutral-900 dark:text-white truncate">{m.name}</p>
                  {m.status === "stale" && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 font-medium shrink-0 ml-2">Stale</span>
                  )}
                </div>
                <p className="text-[11px] text-neutral-500">{m.roleTitle}</p>
                <div className="flex items-center gap-3 mt-2 text-[11px] text-neutral-600">
                  <span className="flex items-center gap-1"><Building2 className="h-3 w-3" />{m.companyCount} cos</span>
                  <span className="flex items-center gap-1"><Users className="h-3 w-3" />{m.candidateCount} people</span>
                  <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{new Date(m.createdAt).toLocaleDateString()}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-xl border border-red-500/35 bg-gradient-to-r from-red-950/80 to-red-950/40 px-4 py-3 font-mono text-sm text-red-200 shadow-[0_0_32px_rgba(239,68,68,0.12)] backdrop-blur-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              {error === "MAP_NOT_FOUND" ? (
                <>
                  <p className="font-medium">Map not found</p>
                  <p className="mt-1 text-red-400/80">This map may have been deleted or the link is invalid.</p>
                </>
              ) : error === "Please sign in to generate market maps" ? (
                <p>{error}</p>
              ) : (
                <>
                  <p className="font-medium">Something went wrong</p>
                  <p className="mt-1 text-red-400/80">{error}</p>
                </>
              )}
            </div>
            {error && error !== "Please sign in to generate market maps" && (
              <button
                onClick={() => { setError(null); setMapData(null); router.push("/map"); }}
                className="shrink-0 rounded-lg bg-gold/90 px-3 py-1.5 text-xs font-semibold text-black hover:bg-gold transition-colors"
              >
                <Plus className="mr-1 inline-block h-3 w-3" />
                Create a new map
              </button>
            )}
          </div>
        </div>
      )}

      {loading && (
        <div className="flex flex-col items-center justify-center gap-4 py-24">
          <div className="relative">
            <div className="absolute inset-0 animate-ping rounded-full bg-cyan-400/20" />
            <Loader2 className="relative h-10 w-10 animate-spin text-cyan-400" />
          </div>
          <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-cyan-600/80 dark:text-cyan-400/60">Syncing mesh…</p>
        </div>
      )}

      {/* Map content */}
      {mapData && !loading && (
        <>
          {/* Map header */}
          <div className="map-hud-card mb-6 p-4 sm:p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <p className="font-mono text-[9px] font-medium uppercase tracking-[0.2em] text-cyan-600/80 dark:text-cyan-400/50">Active projection</p>
                <h2 className="mt-0.5 text-xl font-bold tracking-tight text-neutral-900 dark:text-white sm:text-2xl">{mapData.name}</h2>
                <p className="mt-1 text-sm text-neutral-500 dark:text-cyan-100/35">
                  <span className="text-neutral-700 dark:text-neutral-300">{mapData.roleTitle}</span>
                  {mapData.roleLevel ? <span className="text-neutral-400"> · {mapData.roleLevel}</span> : null}
                  {mapData.geography.length > 0 ? (
                    <span className="text-neutral-400"> · {mapData.geography.join(", ")}</span>
                  ) : null}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={`/map/present?id=${mapData.id}`}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-500/25 bg-cyan-500/5 px-3 py-2 font-mono text-[11px] font-semibold uppercase tracking-wide text-neutral-800 transition-all hover:border-gold/40 hover:shadow-[0_0_20px_rgba(34,211,238,0.12)] dark:text-cyan-100/90 dark:hover:shadow-[0_0_24px_rgba(34,211,238,0.15)]"
                >
                  <Presentation className="h-3.5 w-3.5 text-gold" />
                  Present
                </Link>
                <button
                  type="button"
                  onClick={() => { setMapData(null); router.push("/map"); }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-transparent px-3 py-2 font-mono text-[11px] font-medium uppercase tracking-wide text-neutral-500 transition-colors hover:bg-cyan-500/5 hover:text-neutral-900 dark:hover:text-cyan-100"
                >
                  ← New map
                </button>
              </div>
            </div>

            {/* Lens + filter toolbar */}
            <div className="mt-5 flex flex-col gap-3 border-t border-cyan-500/10 pt-4 dark:border-cyan-500/15 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                <span className="font-mono text-[9px] font-bold uppercase tracking-[0.18em] text-cyan-700/70 dark:text-cyan-400/45">Lens</span>
                <div className="map-hud-chip grid grid-cols-3 gap-1 sm:inline-grid sm:w-auto">
                  {([
                    { id: "role" as const, label: "Role" },
                    { id: "stack" as const, label: "Stack" },
                    { id: "company" as const, label: "Company" },
                  ]).map((mode) => (
                    <button
                      key={mode.id}
                      type="button"
                      onClick={() => {
                        setSourcingMode(mode.id);
                        trackEvent("sourcing_mode_changed", { mode: mode.id });
                        if (mode.id === "stack") verifyAllStacks();
                      }}
                      className={`rounded-lg px-3 py-2 text-center font-mono text-[10px] font-bold uppercase tracking-wide transition-all sm:min-w-[4.5rem] ${
                        sourcingMode === mode.id
                          ? "bg-gradient-to-br from-gold to-amber-600 text-white shadow-[0_0_16px_rgba(200,165,90,0.25)] ring-1 ring-cyan-400/25 dark:to-amber-700"
                          : "text-neutral-600 hover:text-neutral-900 dark:text-cyan-200/50 dark:hover:text-cyan-100"
                      }`}
                    >
                      {mode.label}
                    </button>
                  ))}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setFlightRiskFilter(!flightRiskFilter)}
                className={`inline-flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-2 font-mono text-[10px] font-semibold uppercase tracking-wide transition-all sm:w-auto ${
                  flightRiskFilter
                    ? "border border-red-400/30 bg-red-500/10 text-red-400 shadow-[0_0_20px_rgba(239,68,68,0.12)]"
                    : "border border-cyan-500/20 text-neutral-600 hover:border-gold/35 hover:text-neutral-900 dark:text-cyan-200/45 dark:hover:text-cyan-100"
                }`}
              >
                <Filter className="h-3.5 w-3.5 shrink-0" />
                {flightRiskFilter ? "High flight risk only" : "Filter: high flight risk"}
              </button>
            </div>
          </div>

          {/* Stats */}
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "Companies", val: mapData.stats.totalCompanies, icon: Building2 },
              { label: "Candidates", val: totalCandidates, icon: Users },
              { label: "Avg fit", val: mapData.stats.avgFitScore || "—", icon: TrendingUp },
              { label: "High risk", val: allCompanies.reduce((s, c) => s + c.candidates.filter((p) => p.flightRisk === "high").length, 0), icon: AlertTriangle },
            ].map((m) => (
              <div
                key={m.label}
                className="rounded-xl border border-cyan-500/15 bg-white/65 p-4 backdrop-blur-sm dark:border-cyan-500/20 dark:bg-black/40 dark:shadow-[inset_0_1px_0_rgba(34,211,238,0.06)]"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-cyan-400/25 bg-gradient-to-br from-gold-bg to-cyan-500/10 shadow-[0_0_16px_rgba(34,211,238,0.08)]">
                    <m.icon className="h-4 w-4 text-gold dark:text-cyan-200" aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <p className="map-hud-label !mb-0 text-[9px] opacity-80">{m.label}</p>
                    <p className="text-xl font-bold tabular-nums text-neutral-900 dark:text-white sm:text-2xl">{m.val}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Pipeline summary */}
          {mapData.stats.statusCounts && Object.keys(mapData.stats.statusCounts).length > 0 && (
            <div className="mb-4 flex flex-wrap gap-2">
              {Object.entries(mapData.stats.statusCounts).map(([status, count]) => {
                const cfg = STATUS_CONFIG[status];
                if (!cfg || count === 0) return null;
                return (
                  <span key={status} className={`rounded-md px-2.5 py-1 text-[11px] font-medium ${cfg.color}`}>
                    {count} {cfg.label.toLowerCase()}
                  </span>
                );
              })}
            </div>
          )}

          {/* Tiers + detail panel */}
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-5">
            <div className="min-w-0 flex-1 space-y-8">
              {(["A", "B", "C"] as Tier[]).map((tier) => (
                <TierSection
                  key={tier}
                  tier={tier}
                  companies={flightRiskFilter
                    ? ((mapData.tiers[tier] || []) as Company[]).map(co => ({
                        ...co,
                        candidates: co.candidates.filter(c => c.flightRisk === "high"),
                      })).filter(co => co.candidates.length > 0)
                    : (mapData.tiers[tier] || []) as Company[]
                  }
                  mapId={mapData.id}
                  expandedCo={expandedCo}
                  onToggleCo={(id) => setExpandedCo((prev) => prev === id ? null : id)}
                  selectedIds={selectedIds}
                  onSelectCandidate={toggleSelectCandidate}
                  onSelectPerson={setActivePerson}
                  activePerson={activePerson}
                  onRemoveCompany={removeCompany}
                  onAddCompany={(t) => setAddCompanyTier(t)}
                  connectionCounts={connectionCounts}
                  mapRoleStack={mapData.roleStack}
                  sourcingMode={sourcingMode}
                  onCandidateStatusUpdated={() => loadMap(mapData.id)}
                />
              ))}

              {/* Hidden companies */}
              {mapData.hiddenCompanies.length > 0 && (
                <div className="mt-6 rounded-xl border border-cyan-500/10 bg-black/20 p-4 dark:bg-cyan-950/20">
                  <p className="map-hud-label mb-2 opacity-70">
                    Removed companies ({mapData.hiddenCompanies.length})
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {mapData.hiddenCompanies.map((co) => (
                      <button
                        key={co.id}
                        onClick={async () => {
                          await fetch(`/api/market-map/${mapData.id}/company/${co.id}`, {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ hidden: false }),
                          });
                          loadMap(mapData.id);
                        }}
                        className="flex items-center gap-1.5 rounded-md border border-neutral-700/30 px-2.5 py-1 text-xs text-neutral-500 hover:text-neutral-900 dark:text-white hover:border-neutral-600 transition-colors"
                      >
                        <Plus className="h-3 w-3" /> {co.companyName}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {activePerson && (
              <div className="w-full shrink-0 lg:sticky lg:top-20 lg:w-80">
                <CandidateDetail person={activePerson} onClose={() => setActivePerson(null)} mapId={mapIdParam || ""} />
              </div>
            )}
          </div>
          </DndContext>

          {/* Add company modal */}
          {addCompanyTier && (
            <>
              <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" onClick={() => { setAddCompanyTier(null); setAddCompanyQuery(""); }} />
              <div className="fixed top-1/3 left-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-cyan-500/25 bg-neutral-950/95 p-5 shadow-[0_0_60px_rgba(34,211,238,0.15)] backdrop-blur-xl">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">Add company to {TIER_CONFIG[addCompanyTier].label}</h3>
                  <button onClick={() => { setAddCompanyTier(null); setAddCompanyQuery(""); }}
                    className="text-neutral-500 hover:text-neutral-900 dark:text-white"><X className="h-4 w-4" /></button>
                </div>
                <div className="relative mb-3">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
                  <input
                    type="text"
                    value={addCompanyQuery}
                    onChange={(e) => setAddCompanyQuery(e.target.value)}
                    placeholder="Search companies..."
                    autoFocus
                    className={`${MAP_FIELD} py-2.5 pl-10 pr-4`}
                  />
                  {addCompanyLoading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-neutral-500" />}
                </div>
                {addCompanyResults.length > 0 && (
                  <div className="space-y-1 max-h-60 overflow-y-auto">
                    {addCompanyResults.map((co) => (
                      <button
                        key={co.company_domain}
                        onClick={() => addCompany(co)}
                        className="w-full text-left rounded-lg px-3 py-2.5 hover:bg-neutral-100/50 dark:bg-neutral-800/50 transition-colors"
                      >
                        <p className="text-sm font-medium text-neutral-900 dark:text-white">{co.company_name}</p>
                        <p className="text-[11px] text-neutral-500">{co.company_domain}{co.headcount ? ` · ${co.headcount} employees` : ""}{co.hq_city ? ` · ${co.hq_city}` : ""}</p>
                      </button>
                    ))}
                  </div>
                )}
                {addCompanyQuery.length >= 2 && addCompanyResults.length === 0 && !addCompanyLoading && (
                  <p className="text-xs text-neutral-500 text-center py-4">No companies found</p>
                )}
              </div>
            </>
          )}

          {/* Bulk action bar */}
          {selectedIds.size > 0 && (
            <div className="fixed bottom-4 left-1/2 z-50 flex max-w-[calc(100vw-1.5rem)] -translate-x-1/2 flex-wrap items-center justify-center gap-2 rounded-xl border border-cyan-500/30 bg-neutral-950/92 px-4 py-3 shadow-[0_0_48px_rgba(34,211,238,0.12),0_8px_32px_rgba(0,0,0,0.6)] backdrop-blur-md sm:bottom-6 sm:max-w-none sm:flex-nowrap sm:gap-3 sm:px-6">
              <span className="text-sm font-semibold text-neutral-900 dark:text-white">{selectedIds.size} selected</span>
              <div className="h-5 w-px bg-neutral-700" />
              <button onClick={() => bulkUpdateStatus("shortlisted")}
                className="map-hud-btn-primary rounded-lg bg-gold px-3 py-1.5 text-xs font-semibold text-neutral-900 hover:bg-gold-hover dark:text-white">
                <span>Shortlist</span>
              </button>
              <button onClick={() => bulkUpdateStatus("contacted")}
                className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-neutral-900 dark:text-white hover:bg-amber-500 transition-colors">
                Mark contacted
              </button>
              <button
                onClick={bulkRevealContacts}
                disabled={revealLoading || allSelectedHaveEmail}
                className="rounded-lg border border-neutral-200/50 dark:border-neutral-700/50 px-3 py-1.5 text-xs font-medium text-neutral-300 hover:text-gold hover:border-gold/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                {revealLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Mail className="h-3 w-3" />}
                {revealLoading ? "Revealing..." : allSelectedHaveEmail ? "Contacts revealed" : "Reveal contacts"}
              </button>
              <button
                onClick={handleDraftInStudio}
                className="rounded-lg border border-neutral-200/50 dark:border-neutral-700/50 px-3 py-1.5 text-xs font-medium text-neutral-300 hover:text-gold hover:border-gold/30 transition-colors flex items-center gap-1.5"
              >
                <Pencil className="h-3 w-3" />
                Draft in Studio
              </button>
              <button onClick={() => bulkUpdateStatus("rejected")}
                className="rounded-lg border border-neutral-200/50 dark:border-neutral-700/50 px-3 py-1.5 text-xs font-medium text-neutral-400 hover:text-red-400 hover:border-red-500/30 transition-colors">
                Remove
              </button>
              <button onClick={() => setSelectedIds(new Set())}
                className="text-xs text-neutral-500 hover:text-neutral-900 dark:text-white transition-colors">
                Clear
              </button>
            </div>
          )}

          {/* Footer actions */}
          <div className="map-hud-card mt-6 flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="flex flex-wrap gap-2">
              <button
                onClick={async () => {
                  const name = prompt("Template name:", mapData.roleTitle);
                  if (!name) return;
                  const res = await fetch("/api/market-map/templates", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ map_id: mapData.id, name }),
                  });
                  if (res.ok) alert("Template saved!");
                }}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-neutral-200/50 dark:border-neutral-700/50 text-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100/50 dark:bg-neutral-800/50 transition-colors"
              >
                <Save className="h-3.5 w-3.5" /> Save as template
              </button>
              <Link
                href="/map/templates"
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-neutral-200/50 dark:border-neutral-700/50 text-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100/50 dark:bg-neutral-800/50 transition-colors"
              >
                <Copy className="h-3.5 w-3.5" /> Templates
              </Link>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => {
                  if (!mapData) return;
                  const rows: string[] = ["Company,Tier,Candidate,Title,Seniority,LinkedIn,Fit Score"];
                  for (const [tier, companies] of Object.entries(mapData.tiers)) {
                    for (const co of companies) {
                      if (co.candidates.length === 0) {
                        rows.push(`"${co.companyName.replace(/"/g, '""')}","${tier}",,,,`);
                      } else {
                        for (const c of co.candidates) {
                          rows.push(
                            `"${co.companyName.replace(/"/g, '""')}","${tier}","${(c.name || '').replace(/"/g, '""')}","${(c.title || '').replace(/"/g, '""')}","${c.seniority || ''}","${c.linkedinUrl || ''}","${c.fitScore ?? ''}"`
                          );
                        }
                      }
                    }
                  }
                  const blob = new Blob([rows.join("\n")], { type: "text/csv" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `${mapData.name || "market-map"}.csv`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-neutral-200/50 dark:border-neutral-700/50 text-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100/50 dark:bg-neutral-800/50 transition-colors"
              >
                <Download className="h-3.5 w-3.5" /> Export CSV
              </button>
              <button
                onClick={async () => {
                  if (!mapData) return;
                  try {
                    const res = await fetch(`/api/market-map/${mapData.id}/share`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ permission_level: "overview" }),
                    });
                    if (!res.ok) throw new Error("Failed to create share link");
                    const data = await res.json();
                    await navigator.clipboard.writeText(data.share_url);
                    showSuccess("Share link copied to clipboard!");
                  } catch (err) {
                    showError(err instanceof Error ? err.message : "Failed to share");
                  }
                }}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-neutral-200/50 dark:border-neutral-700/50 text-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100/50 dark:bg-neutral-800/50 transition-colors"
              >
                <Share2 className="h-3.5 w-3.5" /> Share with HM
              </button>
              <button
                onClick={() => {
                  alert("Push to Ashby: select a candidate from the map first, then use the candidate actions menu to push to Ashby.");
                }}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gold text-sm font-semibold text-neutral-900 dark:text-white hover:bg-gold-hover transition-colors"
              >
                <Send className="h-3.5 w-3.5" /> Push to Ashby
              </button>
            </div>
          </div>
        </>
      )}
      </div>
    </div>
  );
}

export default function MarketMapPage() {
  return (
    <Suspense>
      <MarketMapInner />
    </Suspense>
  );
}
