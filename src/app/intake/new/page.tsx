"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  FileText, Sparkles, ArrowRight, ArrowLeft, Target, AlertTriangle,
  CheckCircle, Loader2, Map, X, Star, Shield, DollarSign,
  Briefcase, Code2,
} from "lucide-react";
import { githubSignInUrl } from "@/lib/auth-signin";

// ═══════════════════════════════════════════════════════════
//  TAG INPUT
// ═══════════════════════════════════════════════════════════

function TagInput({ tags, onAdd, onRemove, placeholder, variant = "gold" }: {
  tags: string[];
  onAdd: (tag: string) => void;
  onRemove: (tag: string) => void;
  placeholder?: string;
  variant?: "gold" | "red";
}) {
  const [input, setInput] = useState("");
  const tagStyle = variant === "red"
    ? "bg-red-500/10 border border-red-500/20 text-red-500 dark:text-red-400"
    : "bg-gold/10 border border-gold/20 text-gold";

  function handleKeyDown(e: React.KeyboardEvent) {
    if ((e.key === "Enter" || e.key === ",") && input.trim()) {
      e.preventDefault();
      onAdd(input.trim().replace(/,$/,""));
      setInput("");
    }
  }

  return (
    <div>
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {tags.map((tag) => (
            <span key={tag} className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium ${tagStyle}`}>
              {tag}
              <button onClick={() => onRemove(tag)} className="hover:opacity-70"><X className="h-3 w-3" /></button>
            </span>
          ))}
        </div>
      )}
      <input type="text" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown}
        placeholder={placeholder || "Type and press Enter"}
        className="w-full rounded-lg border border-neutral-200/50 bg-transparent px-3 py-2 text-sm outline-none focus:border-gold/50 dark:border-neutral-700/50" />
    </div>
  );
}

function addToArray(arr: string[], item: string) { return arr.includes(item) ? arr : [...arr, item]; }
function removeFromArray(arr: string[], item: string) { return arr.filter(i => i !== item); }

// ═══════════════════════════════════════════════════════════
//  SECTION CARD
// ═══════════════════════════════════════════════════════════

function SectionCard({ title, icon: Icon, children }: { title: string; icon: React.ComponentType<{className?: string}>; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-neutral-200/50 bg-surface p-4 shadow-sm dark:border-neutral-800/80 dark:bg-neutral-900/60">
      <div className="flex items-center gap-2 mb-3">
        <Icon className="h-4 w-4 text-gold" />
        <h3 className="text-xs font-semibold uppercase tracking-wider text-gold">{title}</h3>
      </div>
      {children}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
//  REALITY CHECK DISPLAY
// ═══════════════════════════════════════════════════════════

interface RealityCheckData {
  marketSize: string;
  compAnalysis: string;
  conflicts: string[];
  difficultyScore: number;
  suggestions: Array<{ suggestion: string; impact: string }>;
  timelineEstimate: string;
  overallAssessment: string;
}

function RealityCheckDisplay({ data }: { data: RealityCheckData }) {
  return (
    <div className="space-y-4">
      {/* Difficulty stars */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-neutral-500">Difficulty:</span>
        <div className="flex gap-0.5">
          {[1,2,3,4,5].map(i => (
            <Star key={i} className={`h-4 w-4 ${i <= data.difficultyScore ? "fill-gold text-gold" : "text-neutral-300 dark:text-neutral-600"}`} />
          ))}
        </div>
        <span className="text-xs text-neutral-400">{data.difficultyScore}/5</span>
      </div>

      {/* Info rows */}
      <div className="space-y-2 text-sm">
        <p><span className="font-medium text-neutral-700 dark:text-neutral-300">Market size:</span> <span className="text-neutral-500">{data.marketSize}</span></p>
        <p><span className="font-medium text-neutral-700 dark:text-neutral-300">Compensation:</span> <span className="text-neutral-500">{data.compAnalysis}</span></p>
        <p><span className="font-medium text-neutral-700 dark:text-neutral-300">Timeline:</span> <span className="text-neutral-500">{data.timelineEstimate}</span></p>
      </div>

      {/* Conflicts */}
      {data.conflicts.length > 0 && (
        <div>
          <p className="text-xs font-medium text-amber-600 dark:text-amber-400 mb-1.5">Concerns</p>
          {data.conflicts.map((c, i) => (
            <div key={i} className="flex items-start gap-2 mb-1.5 text-xs text-amber-700 dark:text-amber-300">
              <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
              <span>{c}</span>
            </div>
          ))}
        </div>
      )}

      {/* Suggestions */}
      <div>
        <p className="text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">Suggestions</p>
        <div className="space-y-2">
          {data.suggestions.map((s, i) => (
            <div key={i} className="rounded-lg border border-neutral-200/50 bg-surface-secondary p-3 dark:border-neutral-700/50">
              <p className="text-xs text-neutral-700 dark:text-neutral-300">{s.suggestion}</p>
              <span className="mt-1 inline-block rounded-md bg-gold/10 px-2 py-0.5 text-[10px] font-medium text-gold">{s.impact}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Overall */}
      <div className="rounded-lg bg-gold/5 border border-gold/10 p-3">
        <p className="text-xs font-semibold text-gold mb-1">Bottom Line</p>
        <p className="text-sm text-neutral-700 dark:text-neutral-300">{data.overallAssessment}</p>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
//  MAIN PAGE
// ═══════════════════════════════════════════════════════════

export default function IntakeNewPage() {
  const { status: authStatus } = useSession();
  const router = useRouter();

  const [mode, setMode] = useState<"notes" | "guided">("notes");
  const [intakeId, setIntakeId] = useState<string | null>(null);
  const [rawNotes, setRawNotes] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [extracted, setExtracted] = useState(false);
  const [guidedStep, setGuidedStep] = useState(1);

  // All structured data
  const [roleBasics, setRoleBasics] = useState({ title: "", level: "senior", department: "", teamSize: "", reportingTo: "", isBackfill: false, backfillReason: "", responsibilities: "" });
  const [candidateProfile, setCandidateProfile] = useState({ mustHaves: [] as string[], niceToHaves: [] as string[], yearsExperience: "", personality: "" });
  const [technicalReqs, setTechnicalReqs] = useState({ languages: [] as string[], frameworks: [] as string[], tools: [] as string[], systemDesign: "" });
  const [compensation, setCompensation] = useState({ min: "", max: "", equity: false, bonus: "" });
  const [logistics, setLogistics] = useState({ remote: false, hybrid: false, onsite: false, location: "", visaSponsorship: false, startDate: "" });
  const [interviewProcess, setInterviewProcess] = useState({ stages: [] as string[], timeline: "", takeHome: false });
  const [sellingPoints, setSellingPoints] = useState({ points: [] as string[], teamCulture: "", growthPath: "", techAppeal: "" });
  const [sourcingStrategy, setSourcingStrategy] = useState({ targetCompanies: [] as string[], avoidCompanies: [] as string[], notes: "" });
  const [redFlags, setRedFlags] = useState({ disqualifiers: [] as string[], nonNegotiables: [] as string[], pastBadHires: "" });

  const [realityCheck, setRealityCheck] = useState<RealityCheckData | null>(null);
  const [checkingReality, setCheckingReality] = useState(false);
  const [generatingMap, setGeneratingMap] = useState(false);

  if (authStatus === "unauthenticated") {
    router.push(githubSignInUrl("/intake/new"));
    return null;
  }

  async function createIntake() {
    const res = await fetch("/api/intake", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode }) });
    if (res.ok) { const data = await res.json(); setIntakeId(data.id); return data.id; }
    return null;
  }

  async function extractNotes() {
    setExtracting(true);
    let id = intakeId;
    if (!id) id = await createIntake();
    if (!id) { setExtracting(false); return; }

    await fetch(`/api/intake/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rawNotes, mode: "notes" }) });

    const res = await fetch(`/api/intake/${id}/extract`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
    if (res.ok) {
      const d = await res.json();
      if (d.roleBasics) setRoleBasics(p => ({ ...p, ...d.roleBasics, teamSize: String(d.roleBasics.teamSize || ""), isBackfill: d.roleBasics.isBackfill || false }));
      if (d.candidateProfile) setCandidateProfile(p => ({ ...p, ...d.candidateProfile, yearsExperience: String(d.candidateProfile.yearsExperience || "") }));
      if (d.technicalReqs) setTechnicalReqs(p => ({ ...p, ...d.technicalReqs }));
      if (d.compensation) setCompensation(p => ({ ...p, ...d.compensation, min: String(d.compensation.min || ""), max: String(d.compensation.max || "") }));
      if (d.logistics) setLogistics(p => ({ ...p, ...d.logistics }));
      if (d.interviewProcess) setInterviewProcess(p => ({ ...p, ...d.interviewProcess }));
      if (d.sellingPoints) setSellingPoints(p => ({ ...p, ...d.sellingPoints }));
      if (d.sourcingStrategy) setSourcingStrategy(p => ({ ...p, ...d.sourcingStrategy }));
      if (d.redFlags) setRedFlags(p => ({ ...p, ...d.redFlags }));
      setExtracted(true);
    }
    setExtracting(false);
  }

  async function saveIntake() {
    let id = intakeId;
    if (!id) id = await createIntake();
    if (!id) return id;
    await fetch(`/api/intake/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roleBasics, candidateProfile, technicalReqs, compensation, logistics, interviewProcess, sellingPoints, sourcingStrategy, redFlags, status: "complete" }),
    });
    return id;
  }

  async function runRealityCheck() {
    setCheckingReality(true);
    const id = await saveIntake();
    if (!id) { setCheckingReality(false); return; }
    const res = await fetch(`/api/intake/${id}/reality-check`, { method: "POST" });
    if (res.ok) setRealityCheck(await res.json());
    setCheckingReality(false);
  }

  async function generateMap() {
    setGeneratingMap(true);
    const id = await saveIntake();
    if (!id) { setGeneratingMap(false); return; }
    const res = await fetch(`/api/intake/${id}/generate-map`, { method: "POST" });
    if (res.ok) {
      const data = await res.json();
      router.push(`/map?id=${data.mapId}`);
    }
    setGeneratingMap(false);
  }

  const label = "text-xs font-medium uppercase tracking-wide text-neutral-500 block mb-1.5";
  const input = "w-full rounded-lg border border-neutral-200/50 bg-transparent px-3 py-2 text-sm outline-none focus:border-gold/50 dark:border-neutral-700/50";

  // ── Rendered sections (reusable between modes) ──

  const renderRoleSection = () => (
      <SectionCard title="The Role" icon={Briefcase}>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><label className={label}>Role title *</label><input type="text" value={roleBasics.title} onChange={e => setRoleBasics(p => ({...p, title: e.target.value}))} placeholder="Sr. Platform Engineer" className={input} /></div>
            <div><label className={label}>Level</label>
              <select value={roleBasics.level} onChange={e => setRoleBasics(p => ({...p, level: e.target.value}))} className={input}>
                <option value="junior">Junior</option><option value="mid">Mid</option><option value="senior">Senior</option><option value="staff">Staff</option><option value="principal">Principal</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={label}>Department</label><input type="text" value={roleBasics.department} onChange={e => setRoleBasics(p => ({...p, department: e.target.value}))} className={input} /></div>
            <div><label className={label}>Team size</label><input type="text" value={roleBasics.teamSize} onChange={e => setRoleBasics(p => ({...p, teamSize: e.target.value}))} className={input} /></div>
          </div>
          <div><label className={label}>Reports to</label><input type="text" value={roleBasics.reportingTo} onChange={e => setRoleBasics(p => ({...p, reportingTo: e.target.value}))} className={input} /></div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-400 cursor-pointer">
              <input type="checkbox" checked={roleBasics.isBackfill} onChange={e => setRoleBasics(p => ({...p, isBackfill: e.target.checked}))} className="accent-gold" /> Backfill
            </label>
            {roleBasics.isBackfill && <input type="text" value={roleBasics.backfillReason} onChange={e => setRoleBasics(p => ({...p, backfillReason: e.target.value}))} placeholder="Why did they leave?" className={`flex-1 ${input}`} />}
          </div>
          <div><label className={label}>Responsibilities</label><textarea value={roleBasics.responsibilities} onChange={e => setRoleBasics(p => ({...p, responsibilities: e.target.value}))} rows={2} className={input} /></div>
        </div>
      </SectionCard>
  );

  const renderRequirementsSection = () => (
      <SectionCard title="Requirements" icon={Target}>
        <div className="space-y-3">
          <div><label className={label}>Must-haves</label><TagInput tags={candidateProfile.mustHaves} onAdd={t => setCandidateProfile(p => ({...p, mustHaves: addToArray(p.mustHaves, t)}))} onRemove={t => setCandidateProfile(p => ({...p, mustHaves: removeFromArray(p.mustHaves, t)}))} placeholder="Required skills — press Enter" /></div>
          <div><label className={label}>Nice-to-haves</label><TagInput tags={candidateProfile.niceToHaves} onAdd={t => setCandidateProfile(p => ({...p, niceToHaves: addToArray(p.niceToHaves, t)}))} onRemove={t => setCandidateProfile(p => ({...p, niceToHaves: removeFromArray(p.niceToHaves, t)}))} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={label}>Years experience</label><input type="text" value={candidateProfile.yearsExperience} onChange={e => setCandidateProfile(p => ({...p, yearsExperience: e.target.value}))} className={input} /></div>
          </div>
          <div><label className={label}>Personality / culture</label><textarea value={candidateProfile.personality} onChange={e => setCandidateProfile(p => ({...p, personality: e.target.value}))} rows={2} className={input} /></div>
        </div>
      </SectionCard>
  );

  const renderTechSection = () => (
      <SectionCard title="Technical" icon={Code2}>
        <div className="space-y-3">
          <div><label className={label}>Languages</label><TagInput tags={technicalReqs.languages} onAdd={t => setTechnicalReqs(p => ({...p, languages: addToArray(p.languages, t)}))} onRemove={t => setTechnicalReqs(p => ({...p, languages: removeFromArray(p.languages, t)}))} /></div>
          <div><label className={label}>Frameworks</label><TagInput tags={technicalReqs.frameworks} onAdd={t => setTechnicalReqs(p => ({...p, frameworks: addToArray(p.frameworks, t)}))} onRemove={t => setTechnicalReqs(p => ({...p, frameworks: removeFromArray(p.frameworks, t)}))} /></div>
          <div><label className={label}>Tools</label><TagInput tags={technicalReqs.tools} onAdd={t => setTechnicalReqs(p => ({...p, tools: addToArray(p.tools, t)}))} onRemove={t => setTechnicalReqs(p => ({...p, tools: removeFromArray(p.tools, t)}))} /></div>
          <div><label className={label}>System design</label><textarea value={technicalReqs.systemDesign} onChange={e => setTechnicalReqs(p => ({...p, systemDesign: e.target.value}))} rows={2} className={input} /></div>
        </div>
      </SectionCard>
  );

  const renderPackageSection = () => (
      <SectionCard title="Package" icon={DollarSign}>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><label className={label}>Comp min ($)</label><input type="number" value={compensation.min} onChange={e => setCompensation(p => ({...p, min: e.target.value}))} placeholder="150000" className={input} /></div>
            <div><label className={label}>Comp max ($)</label><input type="number" value={compensation.max} onChange={e => setCompensation(p => ({...p, max: e.target.value}))} placeholder="220000" className={input} /></div>
          </div>
          <label className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-400 cursor-pointer">
            <input type="checkbox" checked={compensation.equity} onChange={e => setCompensation(p => ({...p, equity: e.target.checked}))} className="accent-gold" /> Equity included
          </label>
          <div className="flex gap-3">
            {(["remote","hybrid","onsite"] as const).map(t => (
              <label key={t} className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-400 cursor-pointer">
                <input type="checkbox" checked={logistics[t]} onChange={e => setLogistics(p => ({...p, [t]: e.target.checked}))} className="accent-gold" /> {t.charAt(0).toUpperCase()+t.slice(1)}
              </label>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={label}>Location</label><input type="text" value={logistics.location} onChange={e => setLogistics(p => ({...p, location: e.target.value}))} className={input} /></div>
            <div><label className={label}>Start date</label><input type="text" value={logistics.startDate} onChange={e => setLogistics(p => ({...p, startDate: e.target.value}))} placeholder="ASAP, Q2, etc." className={input} /></div>
          </div>
          <label className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-400 cursor-pointer">
            <input type="checkbox" checked={logistics.visaSponsorship} onChange={e => setLogistics(p => ({...p, visaSponsorship: e.target.checked}))} className="accent-gold" /> Visa sponsorship
          </label>
        </div>
      </SectionCard>
  );

  const renderSellingSection = () => (
      <SectionCard title="Selling Points" icon={Star}>
        <div className="space-y-3">
          <div><label className={label}>Why join?</label><TagInput tags={sellingPoints.points} onAdd={t => setSellingPoints(p => ({...p, points: addToArray(p.points, t)}))} onRemove={t => setSellingPoints(p => ({...p, points: removeFromArray(p.points, t)}))} placeholder="Add a selling point" /></div>
          <div><label className={label}>Team culture</label><textarea value={sellingPoints.teamCulture} onChange={e => setSellingPoints(p => ({...p, teamCulture: e.target.value}))} rows={2} className={input} /></div>
          <div><label className={label}>Growth path</label><textarea value={sellingPoints.growthPath} onChange={e => setSellingPoints(p => ({...p, growthPath: e.target.value}))} rows={2} className={input} /></div>
          <div><label className={label}>Tech appeal</label><textarea value={sellingPoints.techAppeal} onChange={e => setSellingPoints(p => ({...p, techAppeal: e.target.value}))} rows={2} className={input} /></div>
        </div>
      </SectionCard>
  );

  const renderStrategySection = () => (
      <SectionCard title="Strategy & Red Flags" icon={Shield}>
        <div className="space-y-3">
          <div><label className={label}>Target companies</label><TagInput tags={sourcingStrategy.targetCompanies} onAdd={t => setSourcingStrategy(p => ({...p, targetCompanies: addToArray(p.targetCompanies, t)}))} onRemove={t => setSourcingStrategy(p => ({...p, targetCompanies: removeFromArray(p.targetCompanies, t)}))} placeholder="Companies to source from" /></div>
          <div><label className={label}>Avoid companies</label><TagInput tags={sourcingStrategy.avoidCompanies} onAdd={t => setSourcingStrategy(p => ({...p, avoidCompanies: addToArray(p.avoidCompanies, t)}))} onRemove={t => setSourcingStrategy(p => ({...p, avoidCompanies: removeFromArray(p.avoidCompanies, t)}))} variant="red" placeholder="Companies to avoid" /></div>
          <div><label className={label}>Disqualifiers</label><TagInput tags={redFlags.disqualifiers} onAdd={t => setRedFlags(p => ({...p, disqualifiers: addToArray(p.disqualifiers, t)}))} onRemove={t => setRedFlags(p => ({...p, disqualifiers: removeFromArray(p.disqualifiers, t)}))} variant="red" placeholder="Instant no's" /></div>
          <div><label className={label}>Non-negotiables</label><TagInput tags={redFlags.nonNegotiables} onAdd={t => setRedFlags(p => ({...p, nonNegotiables: addToArray(p.nonNegotiables, t)}))} onRemove={t => setRedFlags(p => ({...p, nonNegotiables: removeFromArray(p.nonNegotiables, t)}))} /></div>
          <div><label className={label}>Sourcing notes</label><textarea value={sourcingStrategy.notes} onChange={e => setSourcingStrategy(p => ({...p, notes: e.target.value}))} rows={2} className={input} /></div>
        </div>
      </SectionCard>
  );

  const renderActionsBar = () => (
      <div className="mt-6 space-y-4">
        {/* Reality check */}
        <div className="rounded-xl border border-neutral-200/50 bg-surface p-5 shadow-sm dark:border-neutral-800/80">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">Market Reality Check</h3>
            <button onClick={runRealityCheck} disabled={checkingReality || !roleBasics.title}
              className="flex items-center gap-2 rounded-lg border border-neutral-200/50 px-4 py-2 text-xs font-medium text-neutral-600 hover:text-gold hover:border-gold/30 transition-all disabled:opacity-50 dark:border-neutral-700/50 dark:text-neutral-400">
              {checkingReality ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Analyzing...</> : <><Target className="h-3.5 w-3.5" /> Run Reality Check</>}
            </button>
          </div>
          {realityCheck && <RealityCheckDisplay data={realityCheck} />}
          {!realityCheck && !checkingReality && <p className="text-xs text-neutral-400">Optional — get an honest assessment of this search before generating your map.</p>}
        </div>

        {/* Generate map CTA */}
        <button onClick={generateMap} disabled={generatingMap || !roleBasics.title}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-gold py-3 text-sm font-semibold text-white transition-colors hover:bg-gold-hover disabled:opacity-50">
          {generatingMap ? <><Loader2 className="h-4 w-4 animate-spin" /> Generating market map...</> : <><Map className="h-4 w-4" /> Generate Market Map</>}
        </button>
      </div>
  );

  // ── Page render ──

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <Link href="/map" className="mb-3 inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-gold transition-colors">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Map
        </Link>
        <div className="flex items-center gap-2.5">
          <FileText className="h-5 w-5 text-gold" />
          <h1 className="text-xl font-bold text-neutral-900 dark:text-white">Intake Call</h1>
          <span className="text-[10px] px-2 py-0.5 rounded-md font-semibold bg-gold-bg text-gold border border-gold-border">Scout</span>
        </div>
        <p className="mt-1 text-sm text-neutral-500">Capture your hiring manager conversation and auto-generate a sourcing strategy</p>
      </div>

      {/* Mode tabs */}
      <div className="flex gap-1 mb-6 rounded-lg bg-neutral-100/50 p-1 dark:bg-neutral-800/50 w-fit">
        {([["notes", "From Notes"], ["guided", "Guided"]] as const).map(([m, label]) => (
          <button key={m} onClick={() => setMode(m)}
            className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${mode === m ? "bg-gold text-white shadow-sm" : "text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"}`}>
            {label}
          </button>
        ))}
      </div>

      {/* ── NOTES MODE ── */}
      {mode === "notes" && !extracted && (
        <div>
          <textarea value={rawNotes} onChange={e => setRawNotes(e.target.value)} rows={10}
            placeholder="Paste your intake call notes, meeting transcript, or raw notes from your conversation with the hiring manager..."
            className="w-full rounded-xl border border-neutral-200/50 bg-surface p-4 text-sm outline-none focus:border-gold/50 dark:border-neutral-800/80 dark:bg-neutral-900/60 min-h-[200px]" />
          <button onClick={extractNotes} disabled={extracting || rawNotes.length < 50}
            className="mt-4 flex items-center gap-2 rounded-lg bg-gold px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-gold-hover disabled:opacity-50">
            {extracting ? <><Loader2 className="h-4 w-4 animate-spin" /> Extracting requirements...</> : <><Sparkles className="h-4 w-4" /> Extract with AI</>}
          </button>
          <p className="mt-2 text-xs text-neutral-400">Scout will identify the role, requirements, compensation, target companies, and more.</p>
        </div>
      )}

      {/* ── NOTES MODE — EXTRACTED ── */}
      {mode === "notes" && extracted && (
        <div>
          <div className="grid gap-4 lg:grid-cols-2">
            {renderRoleSection()}
            {renderRequirementsSection()}
            {renderTechSection()}
            {renderPackageSection()}
            {renderSellingSection()}
            {renderStrategySection()}
          </div>
          {renderActionsBar()}
        </div>
      )}

      {/* ── GUIDED MODE ── */}
      {mode === "guided" && (
        <div>
          {/* Step indicator */}
          <div className="flex items-center gap-2 mb-6">
            {[1,2,3,4].map(s => (
              <div key={s} className="flex items-center gap-2">
                <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                  s < guidedStep ? "bg-gold text-white" : s === guidedStep ? "bg-gold text-white" : "bg-neutral-200 text-neutral-400 dark:bg-neutral-700"
                }`}>
                  {s < guidedStep ? <CheckCircle className="h-4 w-4" /> : s}
                </div>
                {s < 4 && <div className={`h-px w-8 ${s < guidedStep ? "bg-gold" : "bg-neutral-200 dark:bg-neutral-700"}`} />}
              </div>
            ))}
          </div>

          {guidedStep === 1 && (
            <div className="space-y-4">
              {renderRoleSection()}
              {renderTechSection()}
              <div className="flex justify-end">
                <button onClick={() => setGuidedStep(2)} className="flex items-center gap-2 rounded-lg bg-gold px-5 py-2.5 text-sm font-semibold text-white hover:bg-gold-hover">
                  Next: Requirements <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {guidedStep === 2 && (
            <div className="space-y-4">
              {renderRequirementsSection()}
              <div className="flex justify-between">
                <button onClick={() => setGuidedStep(1)} className="flex items-center gap-2 text-sm text-neutral-500 hover:text-gold"><ArrowLeft className="h-4 w-4" /> Back</button>
                <button onClick={() => setGuidedStep(3)} className="flex items-center gap-2 rounded-lg bg-gold px-5 py-2.5 text-sm font-semibold text-white hover:bg-gold-hover">
                  Next: Package <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {guidedStep === 3 && (
            <div className="space-y-4">
              {renderPackageSection()}
              <div className="flex justify-between">
                <button onClick={() => setGuidedStep(2)} className="flex items-center gap-2 text-sm text-neutral-500 hover:text-gold"><ArrowLeft className="h-4 w-4" /> Back</button>
                <button onClick={() => setGuidedStep(4)} className="flex items-center gap-2 rounded-lg bg-gold px-5 py-2.5 text-sm font-semibold text-white hover:bg-gold-hover">
                  Next: Strategy <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {guidedStep === 4 && (
            <div className="space-y-4">
              {renderSellingSection()}
              {renderStrategySection()}
              <div className="flex justify-between items-start">
                <button onClick={() => setGuidedStep(3)} className="flex items-center gap-2 text-sm text-neutral-500 hover:text-gold"><ArrowLeft className="h-4 w-4" /> Back</button>
              </div>
              {renderActionsBar()}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
