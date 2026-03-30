"use client";

import { useState } from "react";
import { X } from "lucide-react";
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
