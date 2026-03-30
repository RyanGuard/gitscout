"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  Bell,
  TrendingDown,
  TrendingUp,
  Shuffle,
  GitMerge,
  UserMinus,
  Building2,
  Users,
  Plus,
  Loader2,
  Search,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  X,
  Clock,
  ArrowRight,
  List,
  Send,
  Eye,
  EyeOff,
} from "lucide-react";
import { DraftInStudioButton } from "@/components/outreach/DraftInStudioButton";
import { fromSurfacedCandidate } from "@/lib/outreach/candidateNormalizer";

// ═══════════════════════════════════════════════════════════
//  LINKEDIN ICON — lucide-react does not export one
// ═══════════════════════════════════════════════════════════

function LinkedinIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
      <rect width="4" height="12" x="2" y="9" />
      <circle cx="4" cy="4" r="2" />
    </svg>
  );
}

// ═══════════════════════════════════════════════════════════
//  TYPES
// ═══════════════════════════════════════════════════════════

interface Signal {
  id: string;
  watchedCompanyId: string;
  companyName: string;
  companyDomain: string;
  eventType: string;
  severity: string;
  summary: string;
  sourceUrl: string | null;
  sourceType: string;
  eventDate: string | null;
  isRead: boolean;
  isDismissed: boolean;
  candidateCount: number;
  createdAt: string;
}

interface SurfacedCandidate {
  id: string;
  apolloPersonId: string | null;
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
  departments: string[];
  tenureMonths: number | null;
  email: string | null;
  phone: string | null;
  emailEnrichedAt: string | null;
  status: string;
  createdAt: string;
}

interface SignalWithCandidates extends Signal {
  surfacedCandidates: SurfacedCandidate[];
}

interface WatchedCompany {
  id: string;
  companyName: string;
  companyDomain: string;
  apolloOrgId: string | null;
  headcount: number | null;
  fundingStage: string | null;
  logoUrl: string | null;
  signalFilters: string[];
  titleFilters: string[];
  seniorityFilters: string[];
  isActive: boolean;
  lastScannedAt: string | null;
  signalCount: number;
  createdAt: string;
  updatedAt: string;
}

// ═══════════════════════════════════════════════════════════
//  CONSTANTS
// ═══════════════════════════════════════════════════════════

type EventType =
  | "LAYOFFS"
  | "FUNDING"
  | "REORG"
  | "ACQUISITION"
  | "LEADERSHIP_CHANGE";

const EVENT_TYPE_CONFIG: Record<
  EventType,
  { label: string; color: string; bg: string; border: string; icon: React.ComponentType<{ className?: string }> }
> = {
  LAYOFFS: {
    label: "Layoffs",
    color: "text-red-700 dark:text-red-400",
    bg: "bg-red-50 dark:bg-red-900/20",
    border: "border-red-200 dark:border-red-800/40",
    icon: TrendingDown,
  },
  FUNDING: {
    label: "Funding",
    color: "text-emerald-700 dark:text-emerald-400",
    bg: "bg-emerald-50 dark:bg-emerald-900/20",
    border: "border-emerald-200 dark:border-emerald-800/40",
    icon: TrendingUp,
  },
  REORG: {
    label: "Reorg",
    color: "text-amber-700 dark:text-amber-400",
    bg: "bg-amber-50 dark:bg-amber-900/20",
    border: "border-amber-200 dark:border-amber-800/40",
    icon: Shuffle,
  },
  ACQUISITION: {
    label: "Acquisition",
    color: "text-violet-700 dark:text-violet-400",
    bg: "bg-violet-50 dark:bg-violet-900/20",
    border: "border-violet-200 dark:border-violet-800/40",
    icon: GitMerge,
  },
  LEADERSHIP_CHANGE: {
    label: "Leadership Change",
    color: "text-orange-700 dark:text-orange-400",
    bg: "bg-orange-50 dark:bg-orange-900/20",
    border: "border-orange-200 dark:border-orange-800/40",
    icon: UserMinus,
  },
};

const SEVERITY_DOT: Record<string, string> = {
  high: "bg-red-500",
  medium: "bg-amber-500",
  low: "bg-emerald-500",
};

const ALL_EVENT_TYPES: EventType[] = [
  "LAYOFFS",
  "FUNDING",
  "REORG",
  "ACQUISITION",
  "LEADERSHIP_CHANGE",
];

// ═══════════════════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════════════════

function timeAgo(dateStr: string): string {
  const seconds = Math.floor(
    (Date.now() - new Date(dateStr).getTime()) / 1000
  );
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `${weeks}w ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

function formatLocation(
  city: string | null,
  state: string | null,
  country: string | null
): string {
  const parts: string[] = [];
  if (city) parts.push(city);
  if (state) parts.push(state);
  if (country && country !== "United States") parts.push(country);
  return parts.join(", ") || "Unknown";
}

// ═══════════════════════════════════════════════════════════
//  FILTER BAR
// ═══════════════════════════════════════════════════════════

interface FilterBarProps {
  eventTypeFilter: string | null;
  setEventTypeFilter: (v: string | null) => void;
  severityFilter: string | null;
  setSeverityFilter: (v: string | null) => void;
  unreadOnly: boolean;
  setUnreadOnly: (v: boolean) => void;
}

function FilterBar({
  eventTypeFilter,
  setEventTypeFilter,
  severityFilter,
  setSeverityFilter,
  unreadOnly,
  setUnreadOnly,
}: FilterBarProps) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-3">
      {/* Event type dropdown */}
      <div className="relative">
        <select
          value={eventTypeFilter || ""}
          onChange={(e) =>
            setEventTypeFilter(e.target.value || null)
          }
          className="appearance-none rounded-lg border border-neutral-200/50 bg-transparent py-1.5 pl-3 pr-8 text-sm text-text-secondary outline-none transition-colors hover:border-gold/30 focus:border-gold focus:ring-1 focus:ring-gold/20 dark:border-neutral-700/50"
        >
          <option value="">All event types</option>
          {ALL_EVENT_TYPES.map((et) => (
            <option key={et} value={et}>
              {EVENT_TYPE_CONFIG[et].label}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-dim" />
      </div>

      {/* Severity dropdown */}
      <div className="relative">
        <select
          value={severityFilter || ""}
          onChange={(e) =>
            setSeverityFilter(e.target.value || null)
          }
          className="appearance-none rounded-lg border border-neutral-200/50 bg-transparent py-1.5 pl-3 pr-8 text-sm text-text-secondary outline-none transition-colors hover:border-gold/30 focus:border-gold focus:ring-1 focus:ring-gold/20 dark:border-neutral-700/50"
        >
          <option value="">All severities</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-dim" />
      </div>

      {/* Unread toggle */}
      <button
        onClick={() => setUnreadOnly(!unreadOnly)}
        className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition-colors ${
          unreadOnly
            ? "border-gold/30 bg-gold-bg text-gold"
            : "border-neutral-200/50 text-text-secondary hover:border-gold/30 dark:border-neutral-700/50"
        }`}
      >
        {unreadOnly ? (
          <EyeOff className="h-3.5 w-3.5" />
        ) : (
          <Eye className="h-3.5 w-3.5" />
        )}
        Unread only
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
//  SURFACED CANDIDATE ROW
// ═══════════════════════════════════════════════════════════

interface SurfacedCandidateRowProps {
  candidate: SurfacedCandidate;
  onSaveToList: (candidateId: string) => void;
  onAddToSequence: (candidateId: string) => void;
  onDismiss: (candidateId: string) => void;
}

function SurfacedCandidateRow({
  candidate,
  onSaveToList,
  onAddToSequence,
  onDismiss,
}: SurfacedCandidateRowProps) {
  const location = formatLocation(
    candidate.city,
    candidate.state,
    candidate.country
  );

  return (
    <div className="group flex items-center gap-4 rounded-lg border border-neutral-100 bg-neutral-50/50 px-4 py-3 transition-colors hover:bg-neutral-50 dark:border-neutral-800/50 dark:bg-neutral-900/30 dark:hover:bg-neutral-800/30">
      {/* Avatar placeholder */}
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gold-bg text-xs font-semibold text-gold">
        {(candidate.firstName?.[0] || candidate.name[0] || "?").toUpperCase()}
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium text-foreground">
            {candidate.name}
          </p>
          {candidate.seniority && (
            <span className="shrink-0 rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-medium text-text-muted dark:bg-neutral-800">
              {candidate.seniority}
            </span>
          )}
          {candidate.linkedinUrl && (
            <a
              href={candidate.linkedinUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 text-text-dim transition-colors hover:text-[#0A66C2]"
              title="View LinkedIn profile"
            >
              <LinkedinIcon className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
        <p className="mt-0.5 truncate text-xs text-text-muted">
          {candidate.title || "No title"} &middot; {location}
        </p>
      </div>

      {/* Actions */}
      <div className="flex shrink-0 items-center gap-1.5 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          onClick={() => onSaveToList(candidate.id)}
          className="inline-flex items-center gap-1 rounded-md border border-neutral-200/50 bg-surface px-2.5 py-1.5 text-[11px] font-medium text-text-secondary transition-colors hover:border-gold/30 hover:text-gold dark:border-neutral-700/50"
          title="Save to list"
        >
          <List className="h-3 w-3" />
          Save
        </button>
        <button
          onClick={() => onAddToSequence(candidate.id)}
          className="inline-flex items-center gap-1 rounded-md border border-neutral-200/50 bg-surface px-2.5 py-1.5 text-[11px] font-medium text-text-secondary transition-colors hover:border-gold/30 hover:text-gold dark:border-neutral-700/50"
          title="Add to sequence"
        >
          <Send className="h-3 w-3" />
          Sequence
        </button>
        <DraftInStudioButton
          variant="compact"
          candidate={fromSurfacedCandidate(candidate)}
        />
        <button
          onClick={() => onDismiss(candidate.id)}
          className="inline-flex items-center justify-center rounded-md border border-neutral-200/50 bg-surface p-1.5 text-text-dim transition-colors hover:border-red-300 hover:text-red-500 dark:border-neutral-700/50"
          title="Dismiss"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
//  SIGNAL CARD
// ═══════════════════════════════════════════════════════════

interface SignalCardProps {
  signal: Signal;
  isExpanded: boolean;
  onToggle: () => void;
  onMarkRead: (id: string) => void;
  candidates: SurfacedCandidate[] | null;
  loadingCandidates: boolean;
  onSaveToList: (candidateId: string) => void;
  onAddToSequence: (candidateId: string) => void;
  onDismissCandidate: (candidateId: string) => void;
}

function SignalCard({
  signal,
  isExpanded,
  onToggle,
  onMarkRead,
  candidates,
  loadingCandidates,
  onSaveToList,
  onAddToSequence,
  onDismissCandidate,
}: SignalCardProps) {
  const config =
    EVENT_TYPE_CONFIG[signal.eventType as EventType] || EVENT_TYPE_CONFIG.REORG;
  const EventIcon = config.icon;
  const severityDot = SEVERITY_DOT[signal.severity] || SEVERITY_DOT.low;

  const handleClick = () => {
    if (!signal.isRead) {
      onMarkRead(signal.id);
    }
    onToggle();
  };

  return (
    <div
      className={`rounded-xl border transition-all ${
        signal.isRead
          ? "border-neutral-200/50 bg-surface dark:border-neutral-800/80"
          : "border-gold/20 bg-surface shadow-sm dark:border-gold/15"
      }`}
    >
      {/* Header — clickable */}
      <button
        onClick={handleClick}
        className="flex w-full items-start gap-3 p-4 text-left"
      >
        {/* Event type badge */}
        <div
          className={`mt-0.5 flex shrink-0 items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-semibold ${config.bg} ${config.color} ${config.border}`}
        >
          <EventIcon className="h-3 w-3" />
          {config.label}
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className={`h-2 w-2 shrink-0 rounded-full ${severityDot}`}
              title={`${signal.severity} severity`}
            />
            <h3
              className={`truncate text-sm ${
                signal.isRead
                  ? "font-medium text-text-secondary"
                  : "font-semibold text-foreground"
              }`}
            >
              {signal.companyName}
            </h3>
          </div>
          <p className="mt-1 line-clamp-2 text-xs text-text-muted">
            {signal.summary}
          </p>
          <div className="mt-2 flex items-center gap-3">
            {signal.candidateCount > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-gold-bg px-2 py-0.5 text-[10px] font-medium text-gold">
                <Users className="h-3 w-3" />
                {signal.candidateCount} candidate
                {signal.candidateCount !== 1 ? "s" : ""}
              </span>
            )}
            <span className="flex items-center gap-1 text-[11px] text-text-dim">
              <Clock className="h-3 w-3" />
              {timeAgo(signal.createdAt)}
            </span>
            {signal.sourceUrl && (
              <a
                href={signal.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-1 text-[11px] text-text-dim transition-colors hover:text-gold"
              >
                <ExternalLink className="h-3 w-3" />
                Source
              </a>
            )}
          </div>
        </div>

        {/* Expand/collapse indicator */}
        <div className="mt-1 shrink-0">
          {isExpanded ? (
            <ChevronUp className="h-4 w-4 text-text-dim" />
          ) : (
            <ChevronDown className="h-4 w-4 text-text-dim" />
          )}
        </div>
      </button>

      {/* Expanded: surfaced candidates */}
      {isExpanded && (
        <div className="border-t border-neutral-100 px-4 pb-4 pt-3 dark:border-neutral-800/50">
          {loadingCandidates ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-text-dim" />
            </div>
          ) : candidates && candidates.length > 0 ? (
            <div className="space-y-2">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-text-dim">
                Surfaced candidates
              </p>
              {candidates.map((c) => (
                <SurfacedCandidateRow
                  key={c.id}
                  candidate={c}
                  onSaveToList={onSaveToList}
                  onAddToSequence={onAddToSequence}
                  onDismiss={onDismissCandidate}
                />
              ))}
            </div>
          ) : (
            <p className="py-4 text-center text-xs text-text-dim">
              No candidates surfaced for this signal yet.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
//  WATCHLIST PANEL
// ═══════════════════════════════════════════════════════════

interface WatchlistPanelProps {
  companies: WatchedCompany[];
  loading: boolean;
  onAdd: (domain: string) => void;
  adding: boolean;
  onToggleActive: (id: string, isActive: boolean) => void;
  onRemove: (id: string) => void;
  onScan: (id: string) => void;
  scanningId: string | null;
}

function WatchlistPanel({
  companies,
  loading,
  onAdd,
  adding,
  onToggleActive,
  onRemove,
  onScan,
  scanningId,
}: WatchlistPanelProps) {
  const [newDomain, setNewDomain] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDomain.trim()) return;
    onAdd(newDomain.trim());
    setNewDomain("");
  };

  return (
    <div className="rounded-xl border border-neutral-200/50 bg-surface dark:border-neutral-800/80">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-3 dark:border-neutral-800/50">
        <h2 className="text-sm font-semibold text-foreground">
          Watched Companies
        </h2>
        <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-medium tabular-nums text-text-muted dark:bg-neutral-800">
          {companies.length}
        </span>
      </div>

      {/* Company list */}
      <div className="max-h-[420px] overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-text-dim" />
          </div>
        ) : companies.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <Building2 className="mx-auto h-8 w-8 text-text-dim/40" />
            <p className="mt-2 text-xs text-text-dim">
              No companies watched yet.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-neutral-100 dark:divide-neutral-800/50">
            {companies.map((company) => (
              <div
                key={company.id}
                className="flex items-start gap-3 px-4 py-3"
              >
                {/* Company icon */}
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-xs font-semibold text-text-muted dark:bg-neutral-800">
                  {company.companyName[0]?.toUpperCase() || "?"}
                </div>

                {/* Info */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium text-foreground">
                      {company.companyName}
                    </p>
                    {!company.isActive && (
                      <span className="shrink-0 rounded-full bg-neutral-100 px-1.5 py-0.5 text-[9px] font-medium text-text-dim dark:bg-neutral-800">
                        PAUSED
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 truncate text-[11px] text-text-dim">
                    {company.companyDomain}
                  </p>
                  <div className="mt-1.5 flex items-center gap-3">
                    {company.signalCount > 0 && (
                      <span className="text-[10px] tabular-nums text-text-muted">
                        {company.signalCount} signal
                        {company.signalCount !== 1 ? "s" : ""}
                      </span>
                    )}
                    {company.lastScannedAt && (
                      <span className="flex items-center gap-1 text-[10px] text-text-dim">
                        <Clock className="h-2.5 w-2.5" />
                        {timeAgo(company.lastScannedAt)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <button
                    onClick={() => onScan(company.id)}
                    disabled={scanningId === company.id}
                    className="inline-flex items-center gap-1 rounded-md bg-gold-bg px-2 py-1 text-[10px] font-medium text-gold transition-colors hover:bg-gold-bg-strong disabled:opacity-50"
                  >
                    {scanningId === company.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Search className="h-3 w-3" />
                    )}
                    Scan
                  </button>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() =>
                        onToggleActive(company.id, !company.isActive)
                      }
                      className="rounded p-0.5 text-text-dim transition-colors hover:text-text-secondary"
                      title={
                        company.isActive ? "Pause watching" : "Resume watching"
                      }
                    >
                      {company.isActive ? (
                        <Eye className="h-3 w-3" />
                      ) : (
                        <EyeOff className="h-3 w-3" />
                      )}
                    </button>
                    <button
                      onClick={() => onRemove(company.id)}
                      className="rounded p-0.5 text-text-dim transition-colors hover:text-red-500"
                      title="Remove from watchlist"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add company form */}
      <div className="border-t border-neutral-100 px-4 py-3 dark:border-neutral-800/50">
        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <input
            id="watchlist-add-input"
            type="text"
            value={newDomain}
            onChange={(e) => setNewDomain(e.target.value)}
            placeholder="company.com"
            className="min-w-0 flex-1 rounded-lg border border-neutral-200/50 bg-transparent px-3 py-1.5 text-sm text-foreground placeholder:text-text-dim outline-none transition-colors focus:border-gold focus:ring-1 focus:ring-gold/20 dark:border-neutral-700/50"
          />
          <button
            type="submit"
            disabled={adding || !newDomain.trim()}
            className="inline-flex items-center gap-1 rounded-lg bg-gold px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-gold-hover disabled:opacity-50"
          >
            {adding ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Plus className="h-3.5 w-3.5" />
            )}
            Add
          </button>
        </form>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
//  EMPTY STATE
// ═══════════════════════════════════════════════════════════

function EmptyState({ onScrollToAdd }: { onScrollToAdd: () => void }) {
  return (
    <div className="rounded-xl border border-dashed border-neutral-200/50 bg-neutral-50/50 p-12 text-center dark:border-neutral-700/30 dark:bg-neutral-900/30">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-gold-border bg-gold-bg">
        <Bell className="h-6 w-6 text-gold" />
      </div>
      <h2 className="mt-5 text-lg font-semibold text-foreground">
        Market Intelligence
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-text-muted">
        Watch companies to get alerts when they have layoffs, raise funding, or
        lose leadership. Scout automatically finds matching engineers you can
        reach out to.
      </p>
      <button
        onClick={onScrollToAdd}
        className="mt-6 inline-flex items-center gap-2 rounded-lg bg-gold px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-gold-hover"
      >
        <Plus className="h-4 w-4" />
        Watch your first company
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
//  MAIN PAGE
// ═══════════════════════════════════════════════════════════

export default function AlertsPage() {
  const { status: authStatus } = useSession();
  const router = useRouter();

  // Signals state
  const [signals, setSignals] = useState<Signal[]>([]);
  const [signalsTotal, setSignalsTotal] = useState(0);
  const [signalsLoading, setSignalsLoading] = useState(true);
  const [expandedSignalId, setExpandedSignalId] = useState<string | null>(null);
  const [signalCandidates, setSignalCandidates] = useState<
    Record<string, SurfacedCandidate[]>
  >({});
  const [loadingCandidatesFor, setLoadingCandidatesFor] = useState<
    string | null
  >(null);

  // Watchlist state
  const [companies, setCompanies] = useState<WatchedCompany[]>([]);
  const [companiesLoading, setCompaniesLoading] = useState(true);
  const [addingCompany, setAddingCompany] = useState(false);
  const [scanningId, setScanningId] = useState<string | null>(null);

  // Filter state
  const [eventTypeFilter, setEventTypeFilter] = useState<string | null>(null);
  const [severityFilter, setSeverityFilter] = useState<string | null>(null);
  const [unreadOnly, setUnreadOnly] = useState(false);

  // Auth redirect
  useEffect(() => {
    if (authStatus === "unauthenticated") {
      router.push("/api/auth/signin?callbackUrl=/alerts");
    }
  }, [authStatus, router]);

  // Fetch signals
  const fetchSignals = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (eventTypeFilter) params.set("event_type", eventTypeFilter);
      if (severityFilter) params.set("severity", severityFilter);
      if (unreadOnly) params.set("unread_only", "true");
      params.set("limit", "50");

      const res = await fetch(`/api/alerts/signals?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch signals");
      const data = await res.json();
      setSignals(data.signals || []);
      setSignalsTotal(data.total || 0);
    } catch {
      // Silent fail — UI shows empty state
    } finally {
      setSignalsLoading(false);
    }
  }, [eventTypeFilter, severityFilter, unreadOnly]);

  // Fetch watchlist
  const fetchWatchlist = useCallback(async () => {
    try {
      const res = await fetch("/api/alerts/watchlist");
      if (!res.ok) throw new Error("Failed to fetch watchlist");
      const data = await res.json();
      setCompanies(data.companies || []);
    } catch {
      // Silent fail
    } finally {
      setCompaniesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authStatus !== "authenticated") return;
    fetchSignals();
    fetchWatchlist();
  }, [authStatus, fetchSignals, fetchWatchlist]);

  // Expand signal — fetch candidates
  const handleToggleSignal = useCallback(
    async (signalId: string) => {
      if (expandedSignalId === signalId) {
        setExpandedSignalId(null);
        return;
      }

      setExpandedSignalId(signalId);

      // Check if we already fetched candidates for this signal
      if (signalCandidates[signalId]) return;

      setLoadingCandidatesFor(signalId);
      try {
        const res = await fetch(`/api/alerts/signals/${signalId}`);
        if (!res.ok) throw new Error("Failed to fetch signal details");
        const data: SignalWithCandidates = await res.json();
        setSignalCandidates((prev) => ({
          ...prev,
          [signalId]: data.surfacedCandidates || [],
        }));
      } catch {
        setSignalCandidates((prev) => ({
          ...prev,
          [signalId]: [],
        }));
      } finally {
        setLoadingCandidatesFor(null);
      }
    },
    [expandedSignalId, signalCandidates]
  );

  // Mark signal as read
  const handleMarkRead = useCallback(async (signalId: string) => {
    // Optimistic update
    setSignals((prev) =>
      prev.map((s) => (s.id === signalId ? { ...s, isRead: true } : s))
    );
    try {
      await fetch(`/api/alerts/signals/${signalId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isRead: true }),
      });
    } catch {
      // Revert on failure
      setSignals((prev) =>
        prev.map((s) => (s.id === signalId ? { ...s, isRead: false } : s))
      );
    }
  }, []);

  // Add company to watchlist
  const handleAddCompany = useCallback(
    async (domain: string) => {
      setAddingCompany(true);
      try {
        const res = await fetch("/api/alerts/watchlist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ companyDomain: domain }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          if (res.status === 409) {
            // Already exists — just refresh
            await fetchWatchlist();
            return;
          }
          throw new Error(err.error || "Failed to add company");
        }
        const newCompany = await res.json();
        await fetchWatchlist();

        // Auto-scan immediately so user sees results right away
        if (newCompany.id) {
          setScanningId(newCompany.id);
          try {
            await fetch("/api/alerts/scan", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ watchedCompanyId: newCompany.id }),
            });
            await Promise.all([fetchSignals(), fetchWatchlist()]);
          } catch {
            // Scan failed silently — company still added
          } finally {
            setScanningId(null);
          }
        }
      } catch {
        // Could show a toast here
      } finally {
        setAddingCompany(false);
      }
    },
    [fetchWatchlist, fetchSignals]
  );

  // Toggle company active/inactive
  const handleToggleActive = useCallback(
    async (id: string, isActive: boolean) => {
      // Optimistic update
      setCompanies((prev) =>
        prev.map((c) => (c.id === id ? { ...c, isActive } : c))
      );
      try {
        await fetch(`/api/alerts/watchlist/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isActive }),
        });
      } catch {
        setCompanies((prev) =>
          prev.map((c) => (c.id === id ? { ...c, isActive: !isActive } : c))
        );
      }
    },
    []
  );

  // Remove company
  const handleRemoveCompany = useCallback(
    async (id: string) => {
      const prev = companies;
      setCompanies((c) => c.filter((co) => co.id !== id));
      try {
        const res = await fetch(`/api/alerts/watchlist/${id}`, {
          method: "DELETE",
        });
        if (!res.ok) throw new Error("Failed to remove");
      } catch {
        setCompanies(prev);
      }
    },
    [companies]
  );

  // Scan company
  const handleScan = useCallback(
    async (id: string) => {
      setScanningId(id);
      try {
        const res = await fetch("/api/alerts/scan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ watchedCompanyId: id }),
        });
        if (!res.ok) throw new Error("Scan failed");
        // Refresh both signals and watchlist after scan
        await Promise.all([fetchSignals(), fetchWatchlist()]);
      } catch {
        // Silent fail
      } finally {
        setScanningId(null);
      }
    },
    [fetchSignals, fetchWatchlist]
  );

  // Candidate actions (stubs for now — wire to real API later)
  const handleSaveToList = useCallback((candidateId: string) => {
    // TODO: open list picker modal
    console.log("Save to list:", candidateId);
  }, []);

  const handleAddToSequence = useCallback((candidateId: string) => {
    // TODO: open sequence picker modal
    console.log("Add to sequence:", candidateId);
  }, []);

  const handleDismissCandidate = useCallback((candidateId: string) => {
    // Optimistic: remove from expanded signal
    setSignalCandidates((prev) => {
      const updated = { ...prev };
      for (const signalId in updated) {
        updated[signalId] = updated[signalId].filter(
          (c) => c.id !== candidateId
        );
      }
      return updated;
    });
  }, []);

  // Focus the add input (for empty state CTA)
  const handleScrollToAdd = useCallback(() => {
    const el = document.getElementById("watchlist-panel");
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
    // Focus the input field
    setTimeout(() => {
      const input = document.getElementById("watchlist-add-input");
      input?.focus();
    }, 400);
  }, []);

  // Computed stats
  const activeCompanies = companies.filter((c) => c.isActive).length;
  const unreadCount = signals.filter((s) => !s.isRead).length;
  const totalCandidatesSurfaced = signals.reduce(
    (sum, s) => sum + s.candidateCount,
    0
  );

  // Loading state
  if (authStatus === "loading" || (signalsLoading && companiesLoading)) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-text-dim" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">
          Market Intelligence
        </h1>
        <p className="mt-1 text-sm text-text-muted">
          Track company events and surface candidates automatically.
        </p>
      </div>

      {/* Stats bar */}
      <div className="mb-6 grid grid-cols-3 gap-3">
        {[
          {
            label: "Watching",
            value: activeCompanies,
            suffix: activeCompanies === 1 ? " company" : " companies",
            icon: Building2,
          },
          {
            label: "Active signals",
            value: unreadCount,
            suffix: "",
            icon: Bell,
          },
          {
            label: "Candidates surfaced",
            value: totalCandidatesSurfaced,
            suffix: "",
            icon: Users,
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border border-neutral-200/50 bg-surface p-4 dark:border-neutral-800/80"
          >
            <div className="flex items-center gap-2">
              <stat.icon className="h-4 w-4 text-gold" />
              <p className="text-[10px] font-medium uppercase tracking-wide text-text-muted">
                {stat.label}
              </p>
            </div>
            <p className="mt-1 text-xl font-bold tabular-nums text-foreground">
              {stat.value}
              <span className="text-sm font-normal text-text-dim">
                {stat.suffix}
              </span>
            </p>
          </div>
        ))}
      </div>

      {/* Two-column layout */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left column — Signal feed */}
        <div className="lg:col-span-8">
          <FilterBar
            eventTypeFilter={eventTypeFilter}
            setEventTypeFilter={setEventTypeFilter}
            severityFilter={severityFilter}
            setSeverityFilter={setSeverityFilter}
            unreadOnly={unreadOnly}
            setUnreadOnly={setUnreadOnly}
          />

          {signalsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-text-dim" />
            </div>
          ) : signals.length === 0 && !eventTypeFilter && !severityFilter && !unreadOnly ? (
            <EmptyState onScrollToAdd={handleScrollToAdd} />
          ) : signals.length === 0 ? (
            <div className="rounded-xl border border-neutral-200/50 bg-surface px-6 py-12 text-center dark:border-neutral-800/80">
              <Search className="mx-auto h-8 w-8 text-text-dim/40" />
              <p className="mt-3 text-sm text-text-muted">
                No signals match your current filters.
              </p>
              <button
                onClick={() => {
                  setEventTypeFilter(null);
                  setSeverityFilter(null);
                  setUnreadOnly(false);
                }}
                className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-gold transition-colors hover:text-gold-hover"
              >
                <X className="h-3.5 w-3.5" />
                Clear filters
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {signals.map((signal) => (
                <SignalCard
                  key={signal.id}
                  signal={signal}
                  isExpanded={expandedSignalId === signal.id}
                  onToggle={() => handleToggleSignal(signal.id)}
                  onMarkRead={handleMarkRead}
                  candidates={signalCandidates[signal.id] ?? null}
                  loadingCandidates={loadingCandidatesFor === signal.id}
                  onSaveToList={handleSaveToList}
                  onAddToSequence={handleAddToSequence}
                  onDismissCandidate={handleDismissCandidate}
                />
              ))}

              {/* Load more hint */}
              {signals.length < signalsTotal && (
                <div className="pt-2 text-center">
                  <button
                    onClick={() => {
                      // Could implement pagination here
                    }}
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-gold transition-colors hover:text-gold-hover"
                  >
                    <ArrowRight className="h-3.5 w-3.5" />
                    View {signalsTotal - signals.length} more signal
                    {signalsTotal - signals.length !== 1 ? "s" : ""}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right column — Watchlist */}
        <div className="lg:col-span-4" id="watchlist-panel">
          <WatchlistPanel
            companies={companies}
            loading={companiesLoading}
            onAdd={handleAddCompany}
            adding={addingCompany}
            onToggleActive={handleToggleActive}
            onRemove={handleRemoveCompany}
            onScan={handleScan}
            scanningId={scanningId}
          />
        </div>
      </div>
    </div>
  );
}
