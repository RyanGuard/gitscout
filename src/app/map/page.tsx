"use client";

import { useState } from "react";
import { ChevronDown, X, Users, Building2, TrendingUp, MapPin, Download, Share2, Send, Map } from "lucide-react";

// ═══════════════════════════════════════════════════════════
//  TYPES & DATA
// ═══════════════════════════════════════════════════════════

interface Person {
  name: string;
  title: string;
  yoe: number;
  score: number;
  status: "open" | "passive";
  tenure: string;
}

interface Company {
  name: string;
  domain: string;
  headcount: number;
  engSize: number;
  hqCity: string;
  growth: string;
  people: Person[];
}

type Tier = "A" | "B" | "C";

const MOCK_COMPANIES: Record<Tier, Company[]> = {
  A: [
    { name: "FluidStack", domain: "GPU Cloud", headcount: 85, engSize: 34, hqCity: "San Francisco", growth: "+42%",
      people: [
        { name: "Sarah Chen", title: "Sr. Platform Engineer", yoe: 8, score: 91, status: "passive", tenure: "2.1y" },
        { name: "Marcus Webb", title: "Staff Infrastructure Eng", yoe: 12, score: 87, status: "passive", tenure: "0.8y" },
        { name: "Priya Nair", title: "Sr. Backend Engineer", yoe: 6, score: 84, status: "open", tenure: "1.4y" },
        { name: "James Liu", title: "Platform Engineer", yoe: 5, score: 79, status: "passive", tenure: "3.2y" },
      ],
    },
    { name: "CoreWeave", domain: "GPU Cloud", headcount: 320, engSize: 140, hqCity: "New York", growth: "+67%",
      people: [
        { name: "Alex Rivera", title: "Staff Platform Engineer", yoe: 10, score: 93, status: "passive", tenure: "1.2y" },
        { name: "Dana Kim", title: "Sr. Infrastructure Eng", yoe: 7, score: 88, status: "passive", tenure: "2.5y" },
        { name: "Raj Patel", title: "Sr. SRE", yoe: 9, score: 85, status: "open", tenure: "0.6y" },
      ],
    },
    { name: "Lambda", domain: "GPU Cloud / ML Infra", headcount: 200, engSize: 90, hqCity: "San Francisco", growth: "+38%",
      people: [
        { name: "Emily Zhao", title: "Staff Engineer", yoe: 11, score: 90, status: "passive", tenure: "3.1y" },
        { name: "Tom Okafor", title: "Sr. Platform Engineer", yoe: 7, score: 82, status: "passive", tenure: "1.8y" },
      ],
    },
  ],
  B: [
    { name: "Anyscale", domain: "ML Infrastructure", headcount: 150, engSize: 75, hqCity: "San Francisco", growth: "+25%",
      people: [
        { name: "Nina Volkov", title: "Sr. Distributed Systems", yoe: 8, score: 86, status: "passive", tenure: "2.4y" },
        { name: "Chris Park", title: "Platform Engineer", yoe: 5, score: 78, status: "open", tenure: "1.1y" },
        { name: "Mei Zhang", title: "Sr. Backend Engineer", yoe: 6, score: 81, status: "passive", tenure: "0.9y" },
      ],
    },
    { name: "Modal", domain: "Serverless GPU", headcount: 45, engSize: 28, hqCity: "San Francisco", growth: "+55%",
      people: [
        { name: "Luca Moretti", title: "Staff Engineer", yoe: 9, score: 89, status: "passive", tenure: "1.6y" },
        { name: "Ava Thompson", title: "Sr. Platform Engineer", yoe: 6, score: 83, status: "passive", tenure: "2.0y" },
      ],
    },
    { name: "Replicate", domain: "ML Deployment", headcount: 60, engSize: 35, hqCity: "San Francisco", growth: "+30%",
      people: [
        { name: "Oscar Reyes", title: "Sr. Infrastructure Eng", yoe: 7, score: 80, status: "open", tenure: "1.3y" },
        { name: "Yuki Tanaka", title: "Platform Engineer", yoe: 4, score: 76, status: "passive", tenure: "0.7y" },
      ],
    },
  ],
  C: [
    { name: "Cloudflare", domain: "Edge / CDN / Compute", headcount: 3800, engSize: 1600, hqCity: "San Francisco", growth: "+18%",
      people: [
        { name: "Jordan Ellis", title: "Staff Platform Engineer", yoe: 13, score: 94, status: "passive", tenure: "4.2y" },
        { name: "Sasha Popov", title: "Principal Engineer", yoe: 15, score: 96, status: "passive", tenure: "5.1y" },
        { name: "Kenji Sato", title: "Sr. SRE", yoe: 8, score: 85, status: "passive", tenure: "2.8y" },
      ],
    },
    { name: "Vercel", domain: "Developer Platform", headcount: 500, engSize: 220, hqCity: "San Francisco", growth: "+22%",
      people: [
        { name: "Isla Murray", title: "Staff Infrastructure", yoe: 10, score: 91, status: "passive", tenure: "2.3y" },
        { name: "Ben Nakamura", title: "Sr. Platform Engineer", yoe: 7, score: 84, status: "passive", tenure: "1.5y" },
      ],
    },
    { name: "Datadog", domain: "Observability", headcount: 5500, engSize: 2200, hqCity: "New York", growth: "+15%",
      people: [
        { name: "Clara Nguyen", title: "Staff SRE", yoe: 11, score: 92, status: "passive", tenure: "3.7y" },
        { name: "Dmitri Volkov", title: "Sr. Platform Engineer", yoe: 9, score: 87, status: "open", tenure: "1.0y" },
        { name: "Fatima Al-Rashid", title: "Sr. Backend Engineer", yoe: 7, score: 83, status: "passive", tenure: "2.2y" },
      ],
    },
  ],
};

const TIER_CONFIG: Record<Tier, { label: string; sub: string; dot: string; badge: string; badgeText: string; accent: string }> = {
  A: { label: "Tier A", sub: "Direct competitors", dot: "bg-emerald-500", badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20", badgeText: "text-emerald-400", accent: "border-l-emerald-500" },
  B: { label: "Tier B", sub: "Adjacent space", dot: "bg-indigo-500", badge: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20", badgeText: "text-indigo-400", accent: "border-l-indigo-500" },
  C: { label: "Tier C", sub: "Upmarket talent", dot: "bg-blue-500", badge: "bg-blue-500/10 text-blue-400 border-blue-500/20", badgeText: "text-blue-400", accent: "border-l-blue-500" },
};

function scoreColor(s: number) {
  if (s >= 90) return "text-emerald-400 bg-emerald-500/10";
  if (s >= 80) return "text-blue-400 bg-blue-500/10";
  if (s >= 70) return "text-amber-400 bg-amber-500/10";
  return "text-red-400 bg-red-500/10";
}

// ═══════════════════════════════════════════════════════════
//  COMPONENTS
// ═══════════════════════════════════════════════════════════

function PersonRow({ person, onSelect, isSelected }: { person: Person; onSelect: (p: Person) => void; isSelected: boolean }) {
  return (
    <div
      onClick={() => onSelect(person)}
      className={`grid grid-cols-[1fr_auto_auto_auto] items-center gap-3 px-4 py-2.5 cursor-pointer transition-all text-sm
        ${isSelected ? "bg-indigo-500/5 border-l-2 border-l-indigo-500" : "border-l-2 border-l-transparent hover:bg-neutral-800/30"}`}
    >
      <div>
        <p className="font-medium text-white text-[13px]">{person.name}</p>
        <p className="text-[11px] text-neutral-500 mt-0.5">{person.title}</p>
      </div>
      <span className="text-[11px] text-neutral-500">{person.yoe}y</span>
      <span className={`inline-flex items-center gap-1.5 text-[11px] ${person.status === "open" ? "text-emerald-400" : "text-neutral-500"}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${person.status === "open" ? "bg-emerald-400" : "bg-neutral-600"}`} />
        {person.status === "open" ? "Open" : "Passive"}
      </span>
      <span className={`text-xs font-semibold px-2 py-0.5 rounded-md ${scoreColor(person.score)}`}>
        {person.score}
      </span>
    </div>
  );
}

function CompanyCard({ company, tier, expanded, onToggle, onSelectPerson, selectedPerson }: {
  company: Company; tier: Tier; expanded: boolean; onToggle: () => void;
  onSelectPerson: (p: Person) => void; selectedPerson: Person | null;
}) {
  const cfg = TIER_CONFIG[tier];
  const openCount = company.people.filter((p) => p.status === "open").length;

  return (
    <div className={`rounded-xl border border-neutral-800/80 bg-neutral-900/60 overflow-hidden transition-all hover:border-neutral-700/80 ${expanded ? "ring-1 ring-indigo-500/20" : ""}`}>
      <div onClick={onToggle} className="flex items-center gap-3 px-4 py-3.5 cursor-pointer">
        <div className={`w-9 h-9 rounded-lg ${cfg.badge} border flex items-center justify-center text-sm font-bold shrink-0`}>
          {company.name.charAt(0)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white">{company.name}</p>
          <p className="text-[11px] text-neutral-500 mt-0.5">{company.domain}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-[11px] text-neutral-500">{company.engSize} eng · {company.hqCity}</p>
          <div className="flex gap-1.5 justify-end mt-1">
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-medium">{company.growth} YoY</span>
            {openCount > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 font-medium">{openCount} open</span>
            )}
          </div>
        </div>
        <ChevronDown className={`h-4 w-4 text-neutral-600 transition-transform shrink-0 ${expanded ? "rotate-180" : ""}`} />
      </div>
      {expanded && (
        <div className="border-t border-neutral-800/50">
          <p className="px-4 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-neutral-600">
            {company.people.length} candidates mapped
          </p>
          {company.people.map((p, i) => (
            <PersonRow key={i} person={p} onSelect={onSelectPerson} isSelected={selectedPerson?.name === p.name} />
          ))}
        </div>
      )}
    </div>
  );
}

function CandidateDetail({ person, onClose }: { person: Person; onClose: () => void }) {
  const pillars = [
    { label: "Impact", val: Math.min(100, person.score + Math.floor(Math.random() * 8 - 3)) },
    { label: "Contributions", val: Math.min(100, person.score + Math.floor(Math.random() * 10 - 5)) },
    { label: "Consistency", val: Math.min(100, person.score + Math.floor(Math.random() * 6 - 2)) },
    { label: "Tech depth", val: Math.min(100, person.score + Math.floor(Math.random() * 7 - 4)) },
    { label: "Reputation", val: Math.min(100, person.score + Math.floor(Math.random() * 12 - 6)) },
  ];

  return (
    <div className="rounded-xl border border-neutral-800/80 bg-neutral-900/60 p-5 relative">
      <button onClick={onClose} className="absolute top-3 right-3 text-neutral-600 hover:text-white transition-colors">
        <X className="h-4 w-4" />
      </button>

      <div className="flex items-center gap-3 mb-5">
        <div className={`w-12 h-12 rounded-full flex items-center justify-center text-base font-bold ${scoreColor(person.score)}`}>
          {person.name.split(" ").map(n => n[0]).join("")}
        </div>
        <div>
          <p className="text-base font-semibold text-white">{person.name}</p>
          <p className="text-xs text-neutral-500 mt-0.5">{person.title}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-5">
        {[
          { label: "GitScout score", val: String(person.score) },
          { label: "Experience", val: `${person.yoe} years` },
          { label: "Tenure", val: person.tenure },
          { label: "Status", val: person.status === "open" ? "Open" : "Passive" },
        ].map((m) => (
          <div key={m.label} className="rounded-lg bg-neutral-800/40 p-3">
            <p className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1">{m.label}</p>
            <p className="text-sm font-semibold text-white">{m.val}</p>
          </div>
        ))}
      </div>

      <div className="mb-5">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500 mb-3">Score breakdown</p>
        {pillars.map((s) => (
          <div key={s.label} className="flex items-center gap-3 mb-2">
            <span className="text-xs text-neutral-400 w-24">{s.label}</span>
            <div className="flex-1 h-1.5 rounded-full bg-neutral-800">
              <div
                className="h-full rounded-full bg-indigo-500/70 transition-all duration-500"
                style={{ width: `${s.val}%` }}
              />
            </div>
            <span className="text-[11px] font-medium text-neutral-400 w-7 text-right">{s.val}</span>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <button className="flex-1 py-2 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-500 transition-colors">
          Add to outreach
        </button>
        <button className="flex-1 py-2 rounded-lg border border-neutral-700/50 text-neutral-300 text-xs font-medium hover:bg-neutral-800/50 transition-colors">
          Save to list
        </button>
      </div>
    </div>
  );
}

function TierSection({ tier, companies, expandedCo, onToggleCo, onSelectPerson, selectedPerson }: {
  tier: Tier; companies: Company[]; expandedCo: string | null;
  onToggleCo: (name: string) => void; onSelectPerson: (p: Person) => void; selectedPerson: Person | null;
}) {
  const cfg = TIER_CONFIG[tier];
  const totalPeople = companies.reduce((a, c) => a + c.people.length, 0);
  const avgScore = Math.round(companies.reduce((a, c) => a + c.people.reduce((s, p) => s + p.score, 0), 0) / totalPeople);

  return (
    <div>
      <div className="flex items-center gap-2.5 mb-3">
        <div className={`w-2.5 h-2.5 rounded ${cfg.dot}`} />
        <span className="text-sm font-semibold text-white">{cfg.label}</span>
        <span className="text-xs text-neutral-500">{cfg.sub}</span>
      </div>
      <div className="flex gap-2 mb-3">
        {[
          { val: companies.length, label: "cos" },
          { val: totalPeople, label: "people" },
          { val: avgScore, label: "avg score" },
        ].map((b) => (
          <div key={b.label} className={`rounded-md border px-2.5 py-1 text-[11px] ${cfg.badge}`}>
            <span className="font-semibold">{b.val}</span>
            <span className="opacity-70"> {b.label}</span>
          </div>
        ))}
      </div>
      <div className="space-y-2">
        {companies.map((co) => (
          <CompanyCard
            key={co.name}
            company={co}
            tier={tier}
            expanded={expandedCo === co.name}
            onToggle={() => onToggleCo(co.name)}
            onSelectPerson={onSelectPerson}
            selectedPerson={selectedPerson}
          />
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
//  MAIN PAGE
// ═══════════════════════════════════════════════════════════

export default function MarketMapPage() {
  const [expandedCo, setExpandedCo] = useState<string | null>(null);
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const [searchInput, setSearchInput] = useState("Sr. Platform Engineer");
  const [roleLevel, setRoleLevel] = useState("Senior");
  const [filterStatus, setFilterStatus] = useState("all");

  const handleToggleCo = (name: string) => setExpandedCo((prev) => (prev === name ? null : name));

  const allCompanies = Object.values(MOCK_COMPANIES).flat();
  const totalCandidates = allCompanies.reduce((a, c) => a + c.people.length, 0);
  const openCandidates = allCompanies.reduce((a, c) => a + c.people.filter((p) => p.status === "open").length, 0);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2.5 mb-1">
          <Map className="h-5 w-5 text-indigo-400" />
          <h1 className="text-xl font-bold text-white tracking-tight">Market Map</h1>
          <span className="text-[10px] px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-semibold">
            GitScout
          </span>
        </div>
        <p className="text-sm text-neutral-500">Interactive talent landscape for targeted recruiting searches</p>
      </div>

      {/* Search bar */}
      <div className="rounded-xl border border-neutral-800/80 bg-neutral-900/60 p-4 mb-5 flex flex-wrap gap-3 items-end">
        <div className="flex-[2] min-w-[180px]">
          <label className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500 block mb-1.5">Role / title</label>
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-full rounded-lg border border-neutral-700/50 bg-neutral-900/40 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500/50"
          />
        </div>
        <div className="min-w-[120px]">
          <label className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500 block mb-1.5">Level</label>
          <select
            value={roleLevel}
            onChange={(e) => setRoleLevel(e.target.value)}
            className="w-full rounded-lg border border-neutral-700/50 bg-neutral-900/40 px-3 py-2 text-sm text-white outline-none"
          >
            <option>Mid</option>
            <option>Senior</option>
            <option>Staff</option>
            <option>Principal</option>
          </select>
        </div>
        <div className="min-w-[120px]">
          <label className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500 block mb-1.5">Status</label>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="w-full rounded-lg border border-neutral-700/50 bg-neutral-900/40 px-3 py-2 text-sm text-white outline-none"
          >
            <option value="all">All candidates</option>
            <option value="open">Open to work</option>
            <option value="passive">Passive only</option>
          </select>
        </div>
        <button className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-500 transition-colors whitespace-nowrap">
          Generate map
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-6">
        {[
          { label: "Companies mapped", val: allCompanies.length, icon: Building2 },
          { label: "Candidates identified", val: totalCandidates, icon: Users },
          { label: "Open to work", val: openCandidates, icon: TrendingUp },
          { label: "Avg GitScout score", val: 86, icon: MapPin },
        ].map((m) => (
          <div key={m.label} className="rounded-xl bg-neutral-800/30 border border-neutral-800/50 p-4">
            <div className="flex items-center gap-2 mb-2">
              <m.icon className="h-3.5 w-3.5 text-neutral-500" />
              <p className="text-[10px] uppercase tracking-wider text-neutral-500">{m.label}</p>
            </div>
            <p className="text-2xl font-bold text-white tabular-nums">{m.val}</p>
          </div>
        ))}
      </div>

      {/* Main content: tiers + detail panel */}
      <div className="flex gap-5 items-start">
        <div className="flex-1 min-w-0 space-y-8">
          {(["A", "B", "C"] as Tier[]).map((tier) => (
            <TierSection
              key={tier}
              tier={tier}
              companies={MOCK_COMPANIES[tier]}
              expandedCo={expandedCo}
              onToggleCo={handleToggleCo}
              onSelectPerson={setSelectedPerson}
              selectedPerson={selectedPerson}
            />
          ))}
        </div>

        {selectedPerson && (
          <div className="w-80 shrink-0 sticky top-20">
            <CandidateDetail person={selectedPerson} onClose={() => setSelectedPerson(null)} />
          </div>
        )}
      </div>

      {/* Footer actions */}
      <div className="mt-6 rounded-xl bg-neutral-800/30 border border-neutral-800/50 p-4 flex gap-2 justify-end flex-wrap">
        <button className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-neutral-700/50 text-sm text-neutral-300 hover:bg-neutral-800/50 transition-colors">
          <Download className="h-3.5 w-3.5" /> Export PDF
        </button>
        <button className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-neutral-700/50 text-sm text-neutral-300 hover:bg-neutral-800/50 transition-colors">
          <Share2 className="h-3.5 w-3.5" /> Share with HM
        </button>
        <button className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 text-sm font-semibold text-white hover:bg-indigo-500 transition-colors">
          <Send className="h-3.5 w-3.5" /> Push all to outreach
        </button>
      </div>
    </div>
  );
}
