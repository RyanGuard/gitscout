"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { SpeakerDiscovery } from "@/components/intelligence/SpeakerDiscovery";
import { OpenToMoveWidget } from "@/components/profile/OpenToMoveWidget";
import {
  Building2,
  Search,
  Loader2,
  ChevronDown,
  ChevronRight,
  MapPin,
  Users,
  ExternalLink,
  Bookmark,
  ListPlus,
  X,
  SlidersHorizontal,
  DollarSign,
  Globe,
  Cpu,
} from "lucide-react";

// ═══════════════════════════════════════════════════════════
//  CUSTOM LINKEDIN ICON (lucide-react does not export one)
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
interface Person {
  id: string;
  name: string;
  title: string;
  seniority: string;
  city: string | null;
  state: string | null;
  linkedinUrl: string | null;
}

interface SeniorityBreakdown {
  label: string;
  count: number;
  color: string;
}

interface Department {
  name: string;
  count: number;
  seniorityBreakdown: SeniorityBreakdown[];
  people: Person[];
}

interface Company {
  name: string;
  domain: string;
  headcount: number | null;
  industry: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  fundingStage: string | null;
  fundingTotal: number | null;
  technologies: string[];
  description: string | null;
}

interface ExploreResult {
  company: Company;
  departments: Department[];
  totalPeople: number;
}

// ═══════════════════════════════════════════════════════════
//  CONSTANTS
// ═══════════════════════════════════════════════════════════
const SENIORITY_OPTIONS = [
  "Executive",
  "VP/Director",
  "Manager",
  "Senior",
  "Junior/Mid",
] as const;

const SENIORITY_COLORS: Record<string, string> = {
  Executive: "#C2413C",
  "VP/Director": "#C8A55A",
  Manager: "#2D6A4F",
  Senior: "#4A90D9",
  "Junior/Mid": "#8B8B8B",
};

const EXAMPLE_DOMAINS = [
  "stripe.com",
  "vercel.com",
  "datadog.com",
  "figma.com",
  "linear.app",
  "notion.so",
];

// ═══════════════════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════════════════
function formatFunding(amount: number | null): string {
  if (!amount) return "N/A";
  if (amount >= 1_000_000_000) return `$${(amount / 1_000_000_000).toFixed(1)}B`;
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(0)}M`;
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(0)}K`;
  return `$${amount}`;
}

function formatHeadcount(count: number | null): string {
  if (!count) return "N/A";
  if (count >= 10_000) return `${(count / 1_000).toFixed(0)}K+`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
  return String(count);
}

function getSeniorityColor(seniority: string): string {
  if (seniority.toLowerCase().includes("executive") || seniority.toLowerCase().includes("c_suite"))
    return SENIORITY_COLORS["Executive"];
  if (seniority.toLowerCase().includes("vp") || seniority.toLowerCase().includes("director"))
    return SENIORITY_COLORS["VP/Director"];
  if (seniority.toLowerCase().includes("manager"))
    return SENIORITY_COLORS["Manager"];
  if (seniority.toLowerCase().includes("senior"))
    return SENIORITY_COLORS["Senior"];
  return SENIORITY_COLORS["Junior/Mid"];
}

function normalizeSeniority(seniority: string): string {
  const s = seniority.toLowerCase();
  if (s.includes("executive") || s.includes("c_suite") || s.includes("owner") || s.includes("founder"))
    return "Executive";
  if (s.includes("vp") || s.includes("director"))
    return "VP/Director";
  if (s.includes("manager"))
    return "Manager";
  if (s.includes("senior"))
    return "Senior";
  return "Junior/Mid";
}

function companyLocation(company: Company): string {
  const parts: string[] = [];
  if (company.city) parts.push(company.city);
  if (company.state) parts.push(company.state);
  if (company.country && company.country !== "United States") parts.push(company.country);
  return parts.join(", ") || "Unknown";
}

// ═══════════════════════════════════════════════════════════
//  SENIORITY BREAKDOWN BAR
// ═══════════════════════════════════════════════════════════
function SeniorityBar({ breakdown, total }: { breakdown: SeniorityBreakdown[]; total: number }) {
  if (total === 0) return null;

  // Defensive: handle case where breakdown is an object (legacy cache) or nullish
  const items: SeniorityBreakdown[] = Array.isArray(breakdown)
    ? breakdown
    : breakdown && typeof breakdown === "object"
      ? Object.entries(breakdown as unknown as Record<string, number>).map(([label, count]) => ({
          label,
          count: typeof count === "number" ? count : 0,
          color: SENIORITY_COLORS[label] || "#8B8B8B",
        }))
      : [];

  return (
    <div className="mb-4">
      <div className="flex h-2 overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
        {items
          .filter((s) => s.count > 0)
          .map((s) => (
            <div
              key={s.label}
              className="transition-all duration-300"
              style={{
                width: `${(s.count / total) * 100}%`,
                backgroundColor: s.color,
                minWidth: s.count > 0 ? "4px" : "0",
              }}
              title={`${s.label}: ${s.count}`}
            />
          ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-3">
        {items
          .filter((s) => s.count > 0)
          .map((s) => (
            <div key={s.label} className="flex items-center gap-1.5 text-[11px] text-neutral-500">
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ backgroundColor: s.color }}
              />
              {s.label} ({s.count})
            </div>
          ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
//  PERSON ROW
// ═══════════════════════════════════════════════════════════
function PersonRow({ person }: { person: Person }) {
  const seniorityLabel = normalizeSeniority(person.seniority);
  const seniorityColor = getSeniorityColor(person.seniority);
  const location = [person.city, person.state].filter(Boolean).join(", ");

  return (
    <div className="group flex items-center gap-4 rounded-lg px-3 py-2.5 transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-800/40">
      {/* Name + Title */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-neutral-900 dark:text-white">
          {person.name}
        </p>
        <p className="truncate text-xs text-neutral-500">{person.title}</p>
      </div>

      {/* Seniority Badge */}
      <span
        className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold text-white"
        style={{ backgroundColor: seniorityColor }}
      >
        {seniorityLabel}
      </span>

      {/* Location */}
      {location && (
        <div className="hidden shrink-0 items-center gap-1 text-xs text-neutral-400 sm:flex">
          <MapPin className="h-3 w-3" />
          <span className="max-w-[140px] truncate">{location}</span>
        </div>
      )}

      {/* LinkedIn */}
      {person.linkedinUrl && (
        <a
          href={person.linkedinUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 rounded-md p-1.5 text-neutral-400 transition-colors hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-900/20"
          title="View LinkedIn profile"
        >
          <LinkedinIcon className="h-3.5 w-3.5" />
        </a>
      )}

      {/* Actions */}
      <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          className="flex items-center gap-1 rounded-md border border-neutral-200/50 px-2 py-1 text-[11px] font-medium text-neutral-600 transition-colors hover:border-gold-border hover:bg-gold-bg hover:text-gold dark:border-neutral-700/50 dark:text-neutral-400 dark:hover:border-gold-border dark:hover:text-gold"
          title="Save to list"
          onClick={() => {
            const params = new URLSearchParams();
            params.set('name', person.name);
            params.set('title', person.title);
            if (person.linkedinUrl) params.set('linkedin', person.linkedinUrl);
            if (person.city) params.set('location', [person.city, person.state].filter(Boolean).join(', '));
            params.set('source', 'company');
            window.location.href = `/outreach?${params.toString()}`;
          }}
        >
          <Bookmark className="h-3 w-3" />
          Save
        </button>
        <button
          className="flex items-center gap-1 rounded-md border border-neutral-200/50 px-2 py-1 text-[11px] font-medium text-neutral-600 transition-colors hover:border-gold-border hover:bg-gold-bg hover:text-gold dark:border-neutral-700/50 dark:text-neutral-400 dark:hover:border-gold-border dark:hover:text-gold"
          title="Add to sequence"
          onClick={() => {
            const params = new URLSearchParams();
            params.set('name', person.name);
            params.set('title', person.title);
            if (person.linkedinUrl) params.set('linkedin', person.linkedinUrl);
            if (person.city) params.set('location', [person.city, person.state].filter(Boolean).join(', '));
            params.set('source', 'company');
            params.set('channel', 'linkedin');
            window.location.href = `/outreach?${params.toString()}`;
          }}
        >
          <ListPlus className="h-3 w-3" />
          Sequence
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
//  DEPARTMENT ACCORDION SECTION
// ═══════════════════════════════════════════════════════════
function DepartmentSection({
  department,
  isExpanded,
  onToggle,
  filteredPeople,
}: {
  department: Department;
  isExpanded: boolean;
  onToggle: () => void;
  filteredPeople: Person[];
}) {
  return (
    <div className="rounded-xl border border-neutral-200/50 bg-surface shadow-sm dark:border-neutral-800/80">
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between px-5 py-4 text-left transition-colors hover:bg-neutral-50/50 dark:hover:bg-neutral-800/30"
      >
        <div className="flex items-center gap-3">
          <Users className="h-4 w-4 text-neutral-400" />
          <span className="text-sm font-semibold text-neutral-900 dark:text-white">
            {department.name}
          </span>
          <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-medium tabular-nums text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
            {filteredPeople.length}
            {filteredPeople.length !== department.count && (
              <span className="text-neutral-400"> / {department.count}</span>
            )}
          </span>
        </div>
        {isExpanded ? (
          <ChevronDown className="h-4 w-4 text-neutral-400 transition-transform" />
        ) : (
          <ChevronRight className="h-4 w-4 text-neutral-400 transition-transform" />
        )}
      </button>

      {isExpanded && (
        <div className="border-t border-neutral-100 px-5 py-4 dark:border-neutral-800/60">
          <SeniorityBar
            breakdown={department.seniorityBreakdown}
            total={department.count}
          />
          {filteredPeople.length === 0 ? (
            <p className="py-6 text-center text-sm text-neutral-400">
              No people match the current filters in this department.
            </p>
          ) : (
            <div className="divide-y divide-neutral-100 dark:divide-neutral-800/50">
              {filteredPeople.map((person) => (
                <PersonRow key={person.id} person={person} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
//  COMPANY HEADER CARD
// ═══════════════════════════════════════════════════════════
function CompanyHeader({ company }: { company: Company }) {
  const location = companyLocation(company);

  return (
    <div className="rounded-xl border border-neutral-200/50 bg-surface p-6 shadow-sm dark:border-neutral-800/80">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-bold text-neutral-900 dark:text-white">
            {company.name}
          </h2>
          <p className="mt-0.5 text-sm text-neutral-500">{company.domain}</p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          {company.headcount && (
            <span className="flex items-center gap-1.5 rounded-lg border border-neutral-200/50 bg-neutral-50 px-2.5 py-1.5 font-medium text-neutral-600 dark:border-neutral-700/50 dark:bg-neutral-800/50 dark:text-neutral-400">
              <Users className="h-3 w-3" />
              {formatHeadcount(company.headcount)} employees
            </span>
          )}
          {company.industry && (
            <span className="flex items-center gap-1.5 rounded-lg border border-neutral-200/50 bg-neutral-50 px-2.5 py-1.5 font-medium text-neutral-600 dark:border-neutral-700/50 dark:bg-neutral-800/50 dark:text-neutral-400">
              <Building2 className="h-3 w-3" />
              {company.industry}
            </span>
          )}
          {location !== "Unknown" && (
            <span className="flex items-center gap-1.5 rounded-lg border border-neutral-200/50 bg-neutral-50 px-2.5 py-1.5 font-medium text-neutral-600 dark:border-neutral-700/50 dark:bg-neutral-800/50 dark:text-neutral-400">
              <Globe className="h-3 w-3" />
              {location}
            </span>
          )}
          {company.fundingStage && (
            <span className="flex items-center gap-1.5 rounded-lg border border-gold-border bg-gold-bg px-2.5 py-1.5 font-medium text-gold">
              <DollarSign className="h-3 w-3" />
              {company.fundingStage}
              {company.fundingTotal ? ` (${formatFunding(company.fundingTotal)})` : ""}
            </span>
          )}
        </div>
      </div>

      {/* Technologies */}
      {Array.isArray(company.technologies) && company.technologies.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {company.technologies.map((tech) => (
            <span
              key={tech}
              className="flex items-center gap-1 rounded-md bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400"
            >
              <Cpu className="h-2.5 w-2.5" />
              {tech}
            </span>
          ))}
        </div>
      )}

      {/* Description */}
      {company.description && (
        <p className="mt-4 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
          {company.description}
        </p>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
//  FILTER BAR
// ═══════════════════════════════════════════════════════════
function FilterBar({
  departments,
  activeDepartments,
  onToggleDepartment,
  activeSeniorities,
  onToggleSeniority,
  titleSearch,
  onTitleSearchChange,
  totalFiltered,
  totalAll,
}: {
  departments: string[];
  activeDepartments: Set<string>;
  onToggleDepartment: (d: string) => void;
  activeSeniorities: Set<string>;
  onToggleSeniority: (s: string) => void;
  titleSearch: string;
  onTitleSearchChange: (v: string) => void;
  totalFiltered: number;
  totalAll: number;
}) {
  const hasFilters =
    activeDepartments.size > 0 || activeSeniorities.size > 0 || titleSearch.length > 0;

  return (
    <div className="sticky top-0 z-20 rounded-xl border border-neutral-200/50 bg-surface/95 p-4 shadow-sm backdrop-blur-sm dark:border-neutral-800/80 dark:bg-surface/95">
      <div className="flex items-center gap-2 mb-3">
        <SlidersHorizontal className="h-3.5 w-3.5 text-neutral-400" />
        <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
          Filters
        </span>
        {hasFilters && (
          <span className="rounded-full bg-gold-bg px-2 py-0.5 text-[10px] font-semibold text-gold">
            {totalFiltered} of {totalAll}
          </span>
        )}
      </div>

      {/* Department pills */}
      <div className="mb-3">
        <p className="mb-1.5 text-[11px] font-medium text-neutral-400">Departments</p>
        <div className="flex flex-wrap gap-1.5">
          {departments.map((dept) => {
            const isActive = activeDepartments.has(dept);
            return (
              <button
                key={dept}
                onClick={() => onToggleDepartment(dept)}
                className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-all ${
                  isActive
                    ? "bg-gold text-white shadow-sm"
                    : "border border-neutral-200/50 bg-neutral-50 text-neutral-600 hover:border-gold-border hover:text-gold dark:border-neutral-700/50 dark:bg-neutral-800/50 dark:text-neutral-400 dark:hover:border-gold-border dark:hover:text-gold"
                }`}
              >
                {dept}
              </button>
            );
          })}
        </div>
      </div>

      {/* Seniority checkboxes + title search */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="mb-1.5 text-[11px] font-medium text-neutral-400">Seniority</p>
          <div className="flex flex-wrap gap-2">
            {SENIORITY_OPTIONS.map((s) => {
              const isActive = activeSeniorities.has(s);
              return (
                <label
                  key={s}
                  className="flex cursor-pointer items-center gap-1.5 text-[11px] text-neutral-600 dark:text-neutral-400"
                >
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={() => onToggleSeniority(s)}
                    className="h-3 w-3 rounded border-neutral-300 text-gold accent-gold focus:ring-gold/30 dark:border-neutral-600"
                  />
                  <span
                    className="inline-block h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: SENIORITY_COLORS[s] }}
                  />
                  {s}
                </label>
              );
            })}
          </div>
        </div>

        <div className="w-full sm:w-56">
          <p className="mb-1.5 text-[11px] font-medium text-neutral-400">Title search</p>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              value={titleSearch}
              onChange={(e) => onTitleSearchChange(e.target.value)}
              placeholder="Filter by title..."
              className="w-full rounded-lg border border-neutral-200/50 bg-neutral-50 py-1.5 pl-7 pr-7 text-xs text-neutral-900 placeholder-neutral-400 outline-none transition-colors focus:border-gold/50 focus:ring-1 focus:ring-gold/10 dark:border-neutral-700/50 dark:bg-neutral-800/50 dark:text-white dark:placeholder-neutral-500"
            />
            {titleSearch && (
              <button
                onClick={() => onTitleSearchChange("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
//  EMPTY STATE
// ═══════════════════════════════════════════════════════════
function EmptyState({ onDomainClick }: { onDomainClick: (domain: string) => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gold-bg border border-gold-border">
        <Building2 className="h-7 w-7 text-gold" />
      </div>
      <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">
        Source from any company
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-neutral-500">
        Enter a company domain to explore their org. See every team, filter by seniority,
        and add people directly to your sequences.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
        {EXAMPLE_DOMAINS.map((domain) => (
          <button
            key={domain}
            onClick={() => onDomainClick(domain)}
            className="rounded-full border border-neutral-200/50 bg-neutral-50 px-3 py-1.5 text-xs font-medium text-neutral-600 transition-all hover:-translate-y-px hover:border-gold-border hover:text-gold dark:border-neutral-700/50 dark:bg-neutral-800/50 dark:text-neutral-400 dark:hover:border-gold-border dark:hover:text-gold"
          >
            {domain}
          </button>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
//  LOADING STATE
// ═══════════════════════════════════════════════════════════
function LoadingState({ domain }: { domain: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <Loader2 className="h-8 w-8 animate-spin text-gold" />
      <p className="mt-4 text-sm font-medium text-neutral-700 dark:text-neutral-300">
        Exploring {domain}...
      </p>
      <p className="mt-1 text-xs text-neutral-400">
        Pulling org data, mapping departments, and enriching people
      </p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
//  MAIN PAGE
// ═══════════════════════════════════════════════════════════
export default function CompanyPage() {
  const { data: session, status: authStatus } = useSession();

  // ── State ──
  const [domainInput, setDomainInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ExploreResult | null>(null);
  const [expandedDepts, setExpandedDepts] = useState<Set<string>>(new Set());
  const [recentLookups, setRecentLookups] = useState<string[]>([]);

  // Filters
  const [filterDepartments, setFilterDepartments] = useState<Set<string>>(new Set());
  const [filterSeniorities, setFilterSeniorities] = useState<Set<string>>(new Set());
  const [titleSearch, setTitleSearch] = useState("");

  const inputRef = useRef<HTMLInputElement>(null);

  // Load recent lookups from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem("scout_company_recent");
      if (stored) setRecentLookups(JSON.parse(stored));
    } catch {
      // Ignore
    }
  }, []);

  // ── Search handler ──
  const handleExplore = useCallback(
    async (domain?: string) => {
      const d = (domain || domainInput).trim().toLowerCase();
      if (!d) return;

      setLoading(true);
      setError(null);
      setResult(null);
      setFilterDepartments(new Set());
      setFilterSeniorities(new Set());
      setTitleSearch("");

      try {
        const res = await fetch("/api/company/explore", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ domain: d }),
        });
        const data = await res.json();

        if (!res.ok) {
          setError(data.error || "Failed to explore company");
          return;
        }

        const exploreResult = data as ExploreResult;
        // Ensure departments is always an array (API may return null/undefined from cache)
        if (!Array.isArray(exploreResult.departments)) {
          exploreResult.departments = [];
        }
        // Ensure company.technologies is always an array
        if (exploreResult.company && !Array.isArray(exploreResult.company.technologies)) {
          exploreResult.company.technologies = [];
        }
        setResult(exploreResult);

        // Auto-expand Engineering (or the largest department)
        const sorted = [...exploreResult.departments].sort((a, b) => b.count - a.count);
        const engineering = sorted.find(
          (d) => d.name.toLowerCase().includes("engineering") || d.name.toLowerCase().includes("technology")
        );
        setExpandedDepts(new Set([engineering?.name || sorted[0]?.name].filter(Boolean)));

        // Update recent lookups
        setRecentLookups((prev) => {
          const updated = [d, ...prev.filter((x) => x !== d)].slice(0, 8);
          try {
            localStorage.setItem("scout_company_recent", JSON.stringify(updated));
          } catch {
            // Ignore
          }
          return updated;
        });

        // Update input to show the searched domain
        setDomainInput(d);
      } catch {
        setError("Failed to connect to server. Please try again.");
      } finally {
        setLoading(false);
      }
    },
    [domainInput]
  );

  // ── Toggle helpers ──
  const toggleDept = useCallback((dept: string) => {
    setExpandedDepts((prev) => {
      const next = new Set(prev);
      if (next.has(dept)) next.delete(dept);
      else next.add(dept);
      return next;
    });
  }, []);

  const toggleFilterDepartment = useCallback((dept: string) => {
    setFilterDepartments((prev) => {
      const next = new Set(prev);
      if (next.has(dept)) next.delete(dept);
      else next.add(dept);
      return next;
    });
  }, []);

  const toggleFilterSeniority = useCallback((s: string) => {
    setFilterSeniorities((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  }, []);

  // ── Filter logic ──
  const filteredDepartments = useMemo(() => {
    if (!result) return [];
    const departments = Array.isArray(result.departments) ? result.departments : [];

    return departments
      .filter((dept) => {
        if (filterDepartments.size === 0) return true;
        return filterDepartments.has(dept.name);
      })
      .sort((a, b) => b.count - a.count);
  }, [result, filterDepartments]);

  const filterPeople = useCallback(
    (people: Person[]): Person[] => {
      if (!Array.isArray(people)) return [];
      return people.filter((p) => {
        // Seniority filter
        if (filterSeniorities.size > 0) {
          const normalized = normalizeSeniority(p.seniority);
          if (!filterSeniorities.has(normalized)) return false;
        }
        // Title search
        if (titleSearch.trim()) {
          if (!p.title.toLowerCase().includes(titleSearch.toLowerCase())) return false;
        }
        return true;
      });
    },
    [filterSeniorities, titleSearch]
  );

  const totalFilteredPeople = useMemo(() => {
    if (!result) return 0;
    return filteredDepartments.reduce(
      (sum, dept) => sum + filterPeople(dept.people).length,
      0
    );
  }, [result, filteredDepartments, filterPeople]);

  const allDepartmentNames = useMemo(() => {
    if (!result) return [];
    const departments = Array.isArray(result.departments) ? result.departments : [];
    return departments
      .sort((a, b) => b.count - a.count)
      .map((d) => d.name);
  }, [result]);

  // ── Auth loading ──
  if (authStatus === "loading") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      {/* ── Page header ── */}
      <div className="mb-8">
        <h1 className="flex items-center gap-2.5 text-2xl font-bold text-neutral-900 dark:text-white">
          <Building2 className="h-6 w-6 text-gold" />
          Company Sourcing
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          Explore any company&apos;s org structure and source directly
        </p>
      </div>

      {/* ── Domain input ── */}
      <div className="mb-6">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleExplore();
          }}
          className="relative mx-auto max-w-2xl"
        >
          <div className="relative flex items-center rounded-xl border border-neutral-200/50 bg-surface shadow-sm transition-all focus-within:border-gold/50 focus-within:shadow-lg focus-within:shadow-gold/5 dark:border-neutral-700/50">
            <Search className="ml-4 h-5 w-5 text-neutral-400" />
            <input
              ref={inputRef}
              type="text"
              value={domainInput}
              onChange={(e) => setDomainInput(e.target.value)}
              placeholder="Enter a company domain (e.g. stripe.com)"
              className="flex-1 bg-transparent px-4 py-3.5 text-sm text-neutral-900 outline-none placeholder:text-neutral-400 dark:text-white dark:placeholder:text-neutral-500"
            />
            <button
              type="submit"
              disabled={loading || !domainInput.trim()}
              className="mr-2 flex items-center gap-2 rounded-lg bg-gold px-5 py-2 text-sm font-semibold text-white transition-all hover:bg-gold-hover hover:shadow-lg hover:shadow-gold/25 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ExternalLink className="h-3.5 w-3.5" />
              )}
              Explore
            </button>
          </div>
        </form>

        {/* Recent lookups */}
        {recentLookups.length > 0 && !loading && !result && (
          <div className="mx-auto mt-3 flex max-w-2xl flex-wrap items-center gap-2">
            <span className="text-[11px] text-neutral-400">Recent:</span>
            {recentLookups.map((d) => (
              <button
                key={d}
                onClick={() => {
                  setDomainInput(d);
                  handleExplore(d);
                }}
                className="rounded-full border border-neutral-200/50 bg-neutral-50 px-2.5 py-1 text-[11px] font-medium text-neutral-600 transition-all hover:border-gold-border hover:text-gold dark:border-neutral-700/50 dark:bg-neutral-800/50 dark:text-neutral-400 dark:hover:border-gold-border dark:hover:text-gold"
              >
                {d}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Error state ── */}
      {error && (
        <div className="mb-6 rounded-xl border border-danger/20 bg-danger-bg p-4 text-sm text-danger">
          {error}
        </div>
      )}

      {/* ── Loading state ── */}
      {loading && <LoadingState domain={domainInput} />}

      {/* ── Empty state (no search yet) ── */}
      {!loading && !result && !error && (
        <EmptyState
          onDomainClick={(domain) => {
            setDomainInput(domain);
            handleExplore(domain);
          }}
        />
      )}

      {/* ── Results ── */}
      {!loading && result && (
        <div className="space-y-4">
          {/* Company header card */}
          <CompanyHeader company={result.company} />

          {/* Open to Move + Speaker Discovery */}
          <div className="grid gap-4 sm:grid-cols-2">
            <OpenToMoveWidget companyDomain={result.company.domain} />
            <SpeakerDiscovery technology={result.company.technologies?.[0] || result.company.industry || result.company.name} />
          </div>

          {/* Summary line */}
          <div className="flex items-center gap-2 text-sm text-neutral-500">
            <Users className="h-4 w-4" />
            <span>
              <strong className="font-semibold text-neutral-900 dark:text-white">
                {result.totalPeople}
              </strong>{" "}
              people across{" "}
              <strong className="font-semibold text-neutral-900 dark:text-white">
                {(Array.isArray(result.departments) ? result.departments : []).length}
              </strong>{" "}
              departments
            </span>
          </div>

          {/* Filter bar */}
          <FilterBar
            departments={allDepartmentNames}
            activeDepartments={filterDepartments}
            onToggleDepartment={toggleFilterDepartment}
            activeSeniorities={filterSeniorities}
            onToggleSeniority={toggleFilterSeniority}
            titleSearch={titleSearch}
            onTitleSearchChange={setTitleSearch}
            totalFiltered={totalFilteredPeople}
            totalAll={result.totalPeople}
          />

          {/* Department accordion */}
          <div className="space-y-3">
            {filteredDepartments.map((dept) => {
              const filtered = filterPeople(dept.people);
              return (
                <DepartmentSection
                  key={dept.name}
                  department={dept}
                  isExpanded={expandedDepts.has(dept.name)}
                  onToggle={() => toggleDept(dept.name)}
                  filteredPeople={filtered}
                />
              );
            })}

            {filteredDepartments.length === 0 && (
              <div className="rounded-xl border border-neutral-200/50 bg-surface py-12 text-center shadow-sm dark:border-neutral-800/80">
                <Users className="mx-auto h-8 w-8 text-neutral-300 dark:text-neutral-600" />
                <p className="mt-2 text-sm font-medium text-neutral-500">
                  No departments match the selected filters
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
