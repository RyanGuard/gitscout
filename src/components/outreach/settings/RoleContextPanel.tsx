"use client";

import { useState, useEffect } from "react";
import { X, ChevronDown, Loader2, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ───

export interface RoleContext {
  roleTitle: string;
  company: string;
  payRange: { min: string; max: string; showToCandidate: boolean } | null;
  workModel: "remote" | "hybrid" | "onsite" | null;
  techStack: string[];
  teamSize: string;
  companyStage: string;
  recentNews: string;
}

// ─── Constants ───

const WORK_MODELS: { value: "remote" | "hybrid" | "onsite"; label: string }[] = [
  { value: "remote", label: "Remote" },
  { value: "hybrid", label: "Hybrid" },
  { value: "onsite", label: "Onsite" },
];

const COMPANY_STAGES = [
  { value: "", label: "Select stage..." },
  { value: "seed", label: "Seed" },
  { value: "series_a", label: "Series A" },
  { value: "series_b", label: "Series B" },
  { value: "series_c", label: "Series C" },
  { value: "growth", label: "Growth" },
  { value: "public", label: "Public" },
];

// ─── Props ───

interface RoleContextPanelProps {
  value: RoleContext;
  onChange: (ctx: RoleContext) => void;
}

// ─── Component ───

export function RoleContextPanel({ value, onChange }: RoleContextPanelProps) {
  const [techInput, setTechInput] = useState("");
  const [atsJobs, setAtsJobs] = useState<Array<{ id: string; title: string }>>([]);
  const [atsConnected, setAtsConnected] = useState(false);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [showJobPicker, setShowJobPicker] = useState(false);
  const [loadingJobDetails, setLoadingJobDetails] = useState(false);

  // Check if ATS is connected and load jobs
  useEffect(() => {
    fetch("/api/ashby/connect")
      .then((r) => r.json())
      .then((data) => {
        if (data.connected) {
          setAtsConnected(true);
          setLoadingJobs(true);
          fetch("/api/ashby/jobs")
            .then((r) => r.json())
            .then((d) => setAtsJobs(d.jobs || []))
            .catch(() => {})
            .finally(() => setLoadingJobs(false));
        }
      })
      .catch(() => {});
  }, []);

  async function handleSelectJob(jobId: string) {
    setShowJobPicker(false);
    setLoadingJobDetails(true);
    try {
      const res = await fetch(`/api/ashby/jobs/${jobId}`);
      const { job } = await res.json();
      if (job) {
        onChange({
          ...value,
          roleTitle: job.title || value.roleTitle,
          company: value.company, // Keep existing company
          payRange: job.compensationMin ? {
            min: String(job.compensationMin),
            max: String(job.compensationMax || job.compensationMin),
            showToCandidate: false,
          } : value.payRange,
          workModel: inferWorkModel(job.location, job.customFields) || value.workModel,
          teamSize: value.teamSize,
          companyStage: value.companyStage,
          recentNews: value.recentNews,
          techStack: value.techStack,
        });
      }
    } catch {}
    setLoadingJobDetails(false);
  }

  function inferWorkModel(
    location: string | null,
    customFields: Array<{ title: string; value: string | string[] | null }> | undefined
  ): "remote" | "hybrid" | "onsite" | null {
    // Check custom fields for work model
    const workField = customFields?.find((f) =>
      f.title.toLowerCase().includes("remote") ||
      f.title.toLowerCase().includes("work model") ||
      f.title.toLowerCase().includes("workplace")
    );
    if (workField?.value) {
      const v = String(workField.value).toLowerCase();
      if (v.includes("remote")) return "remote";
      if (v.includes("hybrid")) return "hybrid";
      if (v.includes("onsite") || v.includes("office")) return "onsite";
    }
    // Infer from location name
    if (location?.toLowerCase().includes("remote")) return "remote";
    return null;
  }

  function update(patch: Partial<RoleContext>) {
    onChange({ ...value, ...patch });
  }

  function updatePayRange(patch: Partial<NonNullable<RoleContext["payRange"]>>) {
    const current = value.payRange ?? { min: "", max: "", showToCandidate: false };
    onChange({ ...value, payRange: { ...current, ...patch } });
  }

  function handleTechKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      const tag = techInput.trim().replace(/,$/g, "");
      if (tag && !value.techStack.includes(tag)) {
        update({ techStack: [...value.techStack, tag] });
      }
      setTechInput("");
    }
  }

  function handleTechBlur() {
    const tag = techInput.trim().replace(/,$/g, "");
    if (tag && !value.techStack.includes(tag)) {
      update({ techStack: [...value.techStack, tag] });
    }
    setTechInput("");
  }

  function removeTag(tag: string) {
    update({ techStack: value.techStack.filter((t) => t !== tag) });
  }

  return (
    <div>
      {/* ATS Role Picker */}
      {atsConnected && (
        <div className="mb-3">
          <label className="mb-1 block text-xs font-medium text-text-secondary">Import from ATS</label>
          <div className="relative">
            <button
              onClick={() => setShowJobPicker(!showJobPicker)}
              disabled={loadingJobs || loadingJobDetails}
              className="w-full flex items-center justify-between rounded-lg border border-dashed border-gold/40 bg-gold-bg px-3 py-1.5 text-xs font-medium text-gold transition-colors hover:border-gold/60 disabled:opacity-50"
            >
              <span className="flex items-center gap-1.5">
                {loadingJobDetails ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Building2 className="h-3 w-3" />
                )}
                {loadingJobDetails ? "Loading job details..." : "Select role from Ashby"}
              </span>
              <ChevronDown className={cn("h-3 w-3 transition-transform", showJobPicker && "rotate-180")} />
            </button>
            {showJobPicker && atsJobs.length > 0 && (
              <div className="absolute z-20 top-full mt-1 w-full rounded-lg border border-border bg-surface shadow-lg max-h-48 overflow-y-auto">
                {atsJobs.map((job) => (
                  <button
                    key={job.id}
                    onClick={() => handleSelectJob(job.id)}
                    className="w-full px-3 py-2 text-left text-xs hover:bg-surface-secondary border-b border-border last:border-0 text-text"
                  >
                    {job.title}
                  </button>
                ))}
              </div>
            )}
            {showJobPicker && atsJobs.length === 0 && !loadingJobs && (
              <div className="absolute z-20 top-full mt-1 w-full rounded-lg border border-border bg-surface p-3 text-xs text-text-muted">
                No open jobs found in Ashby
              </div>
            )}
          </div>
        </div>
      )}

      {/* Role title */}
      <div className="mb-3">
        <label className="mb-1 block text-xs font-medium text-text-secondary">Role title</label>
        <input
          type="text"
          value={value.roleTitle}
          onChange={(e) => update({ roleTitle: e.target.value })}
          placeholder="e.g. Sr. Frontend Engineer"
          className="w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-xs outline-none focus:border-gold"
        />
      </div>

      {/* Company */}
      <div className="mb-3">
        <label className="mb-1 block text-xs font-medium text-text-secondary">Company</label>
        <input
          type="text"
          value={value.company}
          onChange={(e) => update({ company: e.target.value })}
          placeholder="Your company name"
          className="w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-xs outline-none focus:border-gold"
        />
      </div>

      {/* Pay range */}
      <div className="mb-3">
        <label className="mb-1 block text-xs font-medium text-text-secondary">Pay range</label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={value.payRange?.min ?? ""}
            onChange={(e) => updatePayRange({ min: e.target.value })}
            placeholder="Min"
            className="w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-xs outline-none focus:border-gold"
          />
          <span className="shrink-0 text-[10px] text-text-dim">&ndash;</span>
          <input
            type="number"
            value={value.payRange?.max ?? ""}
            onChange={(e) => updatePayRange({ max: e.target.value })}
            placeholder="Max"
            className="w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-xs outline-none focus:border-gold"
          />
        </div>
        <label className="mt-1.5 flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={value.payRange?.showToCandidate ?? false}
            onChange={(e) => updatePayRange({ showToCandidate: e.target.checked })}
            className="h-3 w-3 rounded border-border accent-gold"
          />
          <span className="text-[10px] text-text-dim">Show in message</span>
        </label>
      </div>

      {/* Work model */}
      <div className="mb-3">
        <label className="mb-1 block text-xs font-medium text-text-secondary">Work model</label>
        <div className="grid grid-cols-3 gap-1 rounded-lg border border-border bg-surface p-0.5">
          {WORK_MODELS.map((wm) => (
            <button
              key={wm.value}
              onClick={() => update({ workModel: value.workModel === wm.value ? null : wm.value })}
              className={cn(
                "rounded-md py-1.5 text-[11px] font-medium transition-colors",
                value.workModel === wm.value
                  ? "border-gold bg-gold-bg text-gold"
                  : "text-text-muted hover:text-text"
              )}
            >
              {wm.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tech stack */}
      <div className="mb-3">
        <label className="mb-1 block text-xs font-medium text-text-secondary">Tech stack</label>
        {value.techStack.length > 0 && (
          <div className="mb-1.5 flex flex-wrap gap-1">
            {value.techStack.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 rounded-full border border-gold-border bg-gold-bg px-2 py-0.5 text-[10px] font-medium text-gold"
              >
                {tag}
                <button onClick={() => removeTag(tag)} className="hover:text-gold-hover">
                  <X className="h-2.5 w-2.5" />
                </button>
              </span>
            ))}
          </div>
        )}
        <input
          type="text"
          value={techInput}
          onChange={(e) => setTechInput(e.target.value)}
          onKeyDown={handleTechKeyDown}
          onBlur={handleTechBlur}
          placeholder="Type and press Enter"
          className="w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-xs outline-none focus:border-gold"
        />
        <p className="mt-0.5 text-[10px] text-text-dim">Comma or Enter to add</p>
      </div>

      {/* Team size */}
      <div className="mb-3">
        <label className="mb-1 block text-xs font-medium text-text-secondary">Team size</label>
        <input
          type="text"
          value={value.teamSize}
          onChange={(e) => update({ teamSize: e.target.value })}
          placeholder="e.g. 8 engineers"
          className="w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-xs outline-none focus:border-gold"
        />
      </div>

      {/* Company stage */}
      <div className="mb-3">
        <label className="mb-1 block text-xs font-medium text-text-secondary">Company stage</label>
        <select
          value={value.companyStage}
          onChange={(e) => update({ companyStage: e.target.value })}
          className="w-full appearance-none rounded-lg border border-border bg-surface px-3 py-1.5 text-xs outline-none focus:border-gold"
        >
          {COMPANY_STAGES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      {/* Recent news */}
      <div className="mb-3">
        <label className="mb-1 block text-xs font-medium text-text-secondary">Recent news</label>
        <textarea
          value={value.recentNews}
          onChange={(e) => update({ recentNews: e.target.value })}
          placeholder="e.g. Just raised Series B, launched new product..."
          rows={2}
          className="w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-xs outline-none focus:border-gold resize-none"
        />
        <p className="mt-0.5 text-[10px] text-text-dim">Gives AI context for better personalization</p>
      </div>
    </div>
  );
}
