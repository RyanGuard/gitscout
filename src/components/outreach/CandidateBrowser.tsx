"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { List, Map, Bell, User, ArrowLeft, Loader2, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { CompactCandidateRow } from "./CompactCandidateRow";
import {
  fromListEntry,
  fromMapCandidate,
  fromSurfacedCandidate,
  type CandidateData,
} from "@/lib/outreach/candidateNormalizer";

// ─── Types ───

interface ListSummary {
  id: string;
  name: string;
  entryCount: number;
}

interface ListEntry {
  id: string;
  stage: string;
  developer: {
    id: string;
    username: string;
    name: string | null;
    avatarUrl: string | null;
    email: string | null;
    company: string | null;
    location: string | null;
    bio: string | null;
    score: number;
    languages: { language: string; percentage: number }[];
    repositories: { name: string; stars: number; language: string | null }[];
  };
  tags: string[];
  lastNote: string | null;
}

interface MapSummary {
  id: string;
  name: string;
  roleTitle: string;
  candidateCount: number;
}

interface MapCompanyWithCandidates {
  id: string;
  companyName: string;
  candidates: {
    id: string;
    name: string;
    title: string | null;
    seniority: string | null;
    city: string | null;
    state: string | null;
    country: string | null;
    linkedinUrl: string | null;
    email: string | null;
    fitScore: number | null;
    fitReasoning: string | null;
    flightRisk: string | null;
    flightRiskSignals: string[];
  }[];
}

interface Signal {
  id: string;
  companyName: string;
  eventType: string;
  summary: string;
  candidateCount: number;
}

interface SurfacedCandidate {
  id: string;
  name: string;
  title: string | null;
  seniority: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  linkedinUrl: string | null;
  email: string | null;
}

type MapCandidateRow = {
  candidate: MapCompanyWithCandidates["candidates"][0];
  companyName: string;
};

// ─── Tabs ───

type Tab = "lists" | "maps" | "alerts" | "manual";

const TABS: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "lists", label: "Lists", icon: List },
  { id: "maps", label: "Maps", icon: Map },
  { id: "alerts", label: "Alerts", icon: Bell },
  { id: "manual", label: "Manual", icon: User },
];

async function fetchListsSummary(): Promise<ListSummary[]> {
  try {
    const res = await fetch("/api/lists");
    if (!res.ok) return [];
    const data = await res.json();
    return (data.lists || []).map((l: { id: string; name: string; entryCount: number }) => ({
      id: l.id,
      name: l.name,
      entryCount: l.entryCount,
    }));
  } catch (err) {
    console.warn("[candidate-browser] fetchLists failed:", err);
    return [];
  }
}

async function fetchListEntries(listId: string): Promise<ListEntry[]> {
  try {
    const res = await fetch(`/api/lists/${listId}`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.entries || [];
  } catch (err) {
    console.warn("[candidate-browser] fetchListEntries failed:", err);
    return [];
  }
}

async function fetchMapsSummary(): Promise<MapSummary[]> {
  try {
    const res = await fetch("/api/market-map/list");
    if (!res.ok) return [];
    const data = await res.json();
    return (data.maps || []).map(
      (m: { id: string; name: string; roleTitle: string; candidateCount: number }) => ({
        id: m.id,
        name: m.name,
        roleTitle: m.roleTitle,
        candidateCount: m.candidateCount,
      })
    );
  } catch (err) {
    console.warn("[candidate-browser] fetchMaps failed:", err);
    return [];
  }
}

async function fetchMapCandidatesFlat(mapId: string): Promise<MapCandidateRow[]> {
  try {
    const res = await fetch(`/api/market-map/${mapId}`);
    if (!res.ok) return [];
    const data = await res.json();
    const allCandidates: MapCandidateRow[] = [];
    const companies: MapCompanyWithCandidates[] = [
      ...(data.tiers?.A || []),
      ...(data.tiers?.B || []),
      ...(data.tiers?.C || []),
    ];
    if (data.companies) {
      for (const co of data.companies) {
        for (const c of co.candidates || []) {
          allCandidates.push({ candidate: c, companyName: co.companyName });
        }
      }
    } else {
      for (const co of companies) {
        for (const c of co.candidates || []) {
          allCandidates.push({ candidate: c, companyName: co.companyName });
        }
      }
    }
    allCandidates.sort((a, b) => (b.candidate.fitScore || 0) - (a.candidate.fitScore || 0));
    return allCandidates;
  } catch (err) {
    console.warn("[candidate-browser] fetchMapCandidates failed:", err);
    return [];
  }
}

async function fetchSignalsList(): Promise<Signal[]> {
  try {
    const res = await fetch("/api/alerts/signals?limit=20");
    if (!res.ok) return [];
    const data = await res.json();
    return (data.signals || []).filter((s: Signal) => s.candidateCount > 0);
  } catch (err) {
    console.warn("[candidate-browser] fetchSignals failed:", err);
    return [];
  }
}

async function fetchSurfacedForSignal(signalId: string): Promise<SurfacedCandidate[]> {
  try {
    const res = await fetch(`/api/alerts/signals/${signalId}/candidates`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.candidates || [];
  } catch (err) {
    console.warn("[candidate-browser] fetchSurfacedCandidates failed:", err);
    return [];
  }
}

// ─── Component ───

interface CandidateBrowserProps {
  onSelectCandidate: (candidate: CandidateData) => void;
  currentCandidate: CandidateData | null;
  manualCandidate: CandidateData;
  onManualChange: (candidate: CandidateData) => void;
}

export function CandidateBrowser({
  onSelectCandidate,
  currentCandidate,
  manualCandidate,
  onManualChange,
}: CandidateBrowserProps) {
  const [tab, setTab] = useState<Tab>("lists");
  const [filter, setFilter] = useState("");

  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [selectedMapId, setSelectedMapId] = useState<string | null>(null);
  const [selectedSignalId, setSelectedSignalId] = useState<string | null>(null);
  const [selectedSignalCompany, setSelectedSignalCompany] = useState("");

  const listsQuery = useQuery({
    queryKey: ["candidate-browser", "lists"],
    queryFn: fetchListsSummary,
    enabled: tab === "lists",
  });

  const listEntriesQuery = useQuery({
    queryKey: ["candidate-browser", "list-entries", selectedListId],
    queryFn: () => fetchListEntries(selectedListId!),
    enabled: tab === "lists" && Boolean(selectedListId),
  });

  const mapsQuery = useQuery({
    queryKey: ["candidate-browser", "maps"],
    queryFn: fetchMapsSummary,
    enabled: tab === "maps",
  });

  const mapCandidatesQuery = useQuery({
    queryKey: ["candidate-browser", "map-candidates", selectedMapId],
    queryFn: () => fetchMapCandidatesFlat(selectedMapId!),
    enabled: tab === "maps" && Boolean(selectedMapId),
  });

  const signalsQuery = useQuery({
    queryKey: ["candidate-browser", "signals"],
    queryFn: fetchSignalsList,
    enabled: tab === "alerts",
  });

  const surfacedQuery = useQuery({
    queryKey: ["candidate-browser", "surfaced", selectedSignalId],
    queryFn: () => fetchSurfacedForSignal(selectedSignalId!),
    enabled: tab === "alerts" && Boolean(selectedSignalId),
  });

  const lists = listsQuery.data ?? [];
  const listEntries = listEntriesQuery.data ?? [];
  const maps = mapsQuery.data ?? [];
  const mapCandidates = mapCandidatesQuery.data ?? [];
  const signals = signalsQuery.data ?? [];
  const surfacedCandidates = surfacedQuery.data ?? [];

  const loadingLists = listsQuery.isPending;
  const loadingEntries = listEntriesQuery.isPending;
  const loadingMaps = mapsQuery.isPending;
  const loadingMapCandidates = mapCandidatesQuery.isPending;
  const loadingSignals = signalsQuery.isPending;
  const loadingCandidates = surfacedQuery.isPending;

  function matchesFilter(text: string): boolean {
    if (!filter) return true;
    return text.toLowerCase().includes(filter.toLowerCase());
  }

  function getInitials(name: string): string {
    return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
  }

  function scoreColor(score: number): string {
    if (score >= 90) return "text-violet-500 bg-violet-500/10";
    if (score >= 75) return "text-amber-500 bg-amber-500/10";
    if (score >= 60) return "text-blue-500 bg-blue-500/10";
    return "text-neutral-500 bg-neutral-500/10";
  }

  function fitColor(score: number): string {
    if (score >= 80) return "text-emerald-600 bg-emerald-500/10";
    if (score >= 60) return "text-blue-500 bg-blue-500/10";
    return "text-neutral-500 bg-neutral-500/10";
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex border-b border-border px-2 pt-3 pb-0 gap-1">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => {
                setTab(t.id);
                setFilter("");
              }}
              className={cn(
                "flex-1 flex flex-col items-center gap-0.5 pb-2 border-b-2 transition-colors",
                tab === t.id
                  ? "border-gold text-gold"
                  : "border-transparent text-text-muted hover:text-text-secondary"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              <span className="text-[9px] font-medium">{t.label}</span>
            </button>
          );
        })}
      </div>

      {tab !== "manual" && (
        <div className="px-3 py-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-text-dim" />
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter by name..."
              className="w-full rounded-lg border border-border bg-surface pl-7 pr-3 py-1.5 text-[11px] outline-none focus:border-gold"
            />
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {tab === "lists" && !selectedListId && (
          <div className="px-3 py-1">
            {loadingLists ? (
              <div className="flex justify-center py-6">
                <Loader2 className="h-4 w-4 animate-spin text-text-dim" />
              </div>
            ) : lists.length === 0 ? (
              <p className="text-xs text-text-muted py-4 text-center">No saved lists yet</p>
            ) : (
              lists
                .filter((l) => matchesFilter(l.name))
                .map((l) => (
                  <button
                    key={l.id}
                    onClick={() => setSelectedListId(l.id)}
                    className="w-full flex items-center justify-between rounded-lg px-3 py-2.5 text-left text-xs transition-colors hover:bg-surface mb-1"
                  >
                    <div>
                      <p className="font-medium text-text">{l.name}</p>
                      <p className="text-[10px] text-text-muted">{l.entryCount} candidates</p>
                    </div>
                    <span className="text-text-dim">&rsaquo;</span>
                  </button>
                ))
            )}
          </div>
        )}

        {tab === "lists" && selectedListId && (
          <>
            <button
              onClick={() => setSelectedListId(null)}
              className="flex items-center gap-1 px-3 py-2 text-[10px] font-medium text-text-muted hover:text-gold transition-colors"
            >
              <ArrowLeft className="h-3 w-3" />
              Back to lists
            </button>
            {loadingEntries ? (
              <div className="flex justify-center py-6">
                <Loader2 className="h-4 w-4 animate-spin text-text-dim" />
              </div>
            ) : (
              listEntries
                .filter((e) => matchesFilter(e.developer.name || e.developer.username))
                .map((entry) => {
                  const dev = entry.developer;
                  const normalized = fromListEntry(entry);
                  return (
                    <CompactCandidateRow
                      key={entry.id}
                      name={dev.name || dev.username}
                      subtitle={
                        [dev.company?.replace(/^@/, ""), dev.location].filter(Boolean).join(" · ") ||
                        `@${dev.username}`
                      }
                      avatarUrl={dev.avatarUrl || `https://github.com/${dev.username}.png`}
                      initials={getInitials(dev.name || dev.username)}
                      badge={
                        dev.score > 0
                          ? { label: String(dev.score), color: scoreColor(dev.score) }
                          : undefined
                      }
                      isActive={
                        currentCandidate?.name === normalized.name &&
                        currentCandidate?.sourceDeveloperId === dev.id
                      }
                      onClick={() => onSelectCandidate(normalized)}
                    />
                  );
                })
            )}
          </>
        )}

        {tab === "maps" && !selectedMapId && (
          <div className="px-3 py-1">
            {loadingMaps ? (
              <div className="flex justify-center py-6">
                <Loader2 className="h-4 w-4 animate-spin text-text-dim" />
              </div>
            ) : maps.length === 0 ? (
              <p className="text-xs text-text-muted py-4 text-center">No market maps yet</p>
            ) : (
              maps
                .filter((m) => matchesFilter(m.name + m.roleTitle))
                .map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setSelectedMapId(m.id)}
                    className="w-full flex items-center justify-between rounded-lg px-3 py-2.5 text-left text-xs transition-colors hover:bg-surface mb-1"
                  >
                    <div>
                      <p className="font-medium text-text">{m.name}</p>
                      <p className="text-[10px] text-text-muted">
                        {m.roleTitle} · {m.candidateCount} candidates
                      </p>
                    </div>
                    <span className="text-text-dim">&rsaquo;</span>
                  </button>
                ))
            )}
          </div>
        )}

        {tab === "maps" && selectedMapId && (
          <>
            <button
              onClick={() => setSelectedMapId(null)}
              className="flex items-center gap-1 px-3 py-2 text-[10px] font-medium text-text-muted hover:text-gold transition-colors"
            >
              <ArrowLeft className="h-3 w-3" />
              Back to maps
            </button>
            {loadingMapCandidates ? (
              <div className="flex justify-center py-6">
                <Loader2 className="h-4 w-4 animate-spin text-text-dim" />
              </div>
            ) : (
              mapCandidates
                .filter((mc) =>
                  matchesFilter(mc.candidate.name + (mc.candidate.title || "") + mc.companyName)
                )
                .slice(0, 50)
                .map((mc) => {
                  const c = mc.candidate;
                  const normalized = fromMapCandidate(c, selectedMapId, mc.companyName);
                  return (
                    <CompactCandidateRow
                      key={c.id}
                      name={c.name}
                      subtitle={[c.title, mc.companyName].filter(Boolean).join(" @ ")}
                      initials={getInitials(c.name)}
                      badge={
                        c.fitScore
                          ? { label: String(c.fitScore), color: fitColor(c.fitScore) }
                          : undefined
                      }
                      isActive={
                        currentCandidate?.name === c.name &&
                        currentCandidate?.sourceMapId === selectedMapId
                      }
                      onClick={() => onSelectCandidate(normalized)}
                    />
                  );
                })
            )}
          </>
        )}

        {tab === "alerts" && !selectedSignalId && (
          <div className="px-3 py-1">
            {loadingSignals ? (
              <div className="flex justify-center py-6">
                <Loader2 className="h-4 w-4 animate-spin text-text-dim" />
              </div>
            ) : signals.length === 0 ? (
              <p className="text-xs text-text-muted py-4 text-center">No signals with candidates</p>
            ) : (
              signals
                .filter((s) => matchesFilter(s.companyName + s.eventType))
                .map((s) => (
                  <button
                    key={s.id}
                    onClick={() => {
                      setSelectedSignalId(s.id);
                      setSelectedSignalCompany(s.companyName);
                    }}
                    className="w-full flex items-center justify-between rounded-lg px-3 py-2.5 text-left text-xs transition-colors hover:bg-surface mb-1"
                  >
                    <div>
                      <p className="font-medium text-text">{s.companyName}</p>
                      <p className="text-[10px] text-text-muted capitalize">
                        {s.eventType.replace(/_/g, " ")} · {s.candidateCount} candidates
                      </p>
                    </div>
                    <span className="text-text-dim">&rsaquo;</span>
                  </button>
                ))
            )}
          </div>
        )}

        {tab === "alerts" && selectedSignalId && (
          <>
            <button
              onClick={() => setSelectedSignalId(null)}
              className="flex items-center gap-1 px-3 py-2 text-[10px] font-medium text-text-muted hover:text-gold transition-colors"
            >
              <ArrowLeft className="h-3 w-3" />
              Back to signals
            </button>
            {loadingCandidates ? (
              <div className="flex justify-center py-6">
                <Loader2 className="h-4 w-4 animate-spin text-text-dim" />
              </div>
            ) : (
              surfacedCandidates
                .filter((c) => matchesFilter(c.name + (c.title || "")))
                .map((c) => {
                  const normalized = fromSurfacedCandidate(c, selectedSignalCompany);
                  const location = [c.city, c.state].filter(Boolean).join(", ");
                  return (
                    <CompactCandidateRow
                      key={c.id}
                      name={c.name}
                      subtitle={
                        [c.title, location].filter(Boolean).join(" · ") || selectedSignalCompany
                      }
                      initials={getInitials(c.name)}
                      badge={
                        c.seniority
                          ? { label: c.seniority, color: "text-text-secondary bg-surface-secondary" }
                          : undefined
                      }
                      isActive={currentCandidate?.name === c.name}
                      onClick={() => onSelectCandidate(normalized)}
                    />
                  );
                })
            )}
          </>
        )}

        {tab === "manual" && (
          <div className="px-3 py-2 space-y-3">
            <div>
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-text-muted">
                Name *
              </label>
              <input
                value={manualCandidate.name}
                onChange={(e) => onManualChange({ ...manualCandidate, name: e.target.value })}
                placeholder="Full name"
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-gold"
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-text-muted">
                Title
              </label>
              <input
                value={manualCandidate.title || ""}
                onChange={(e) => onManualChange({ ...manualCandidate, title: e.target.value })}
                placeholder="e.g. Senior Engineer"
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-gold"
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-text-muted">
                Company
              </label>
              <input
                value={manualCandidate.company || ""}
                onChange={(e) => onManualChange({ ...manualCandidate, company: e.target.value })}
                placeholder="Current company"
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-gold"
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-text-muted">
                LinkedIn URL
              </label>
              <input
                value={manualCandidate.linkedinUrl || ""}
                onChange={(e) =>
                  onManualChange({ ...manualCandidate, linkedinUrl: e.target.value })
                }
                placeholder="linkedin.com/in/..."
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-gold"
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-text-muted">
                Notes
              </label>
              <textarea
                value={(manualCandidate.context as Record<string, string>)?.notes || ""}
                onChange={(e) =>
                  onManualChange({
                    ...manualCandidate,
                    context: { ...manualCandidate.context, notes: e.target.value },
                  })
                }
                placeholder="Anything relevant..."
                rows={2}
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-gold"
              />
            </div>
            {manualCandidate.name && (
              <button
                onClick={() => onSelectCandidate(manualCandidate)}
                className="w-full rounded-lg bg-gold px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-gold-hover"
              >
                Use this candidate
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
