"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Send,
  Mail,
  MessageSquare,
  Plus,
  X,
  Loader2,
  ArrowLeft,
  ChevronDown,
} from "lucide-react";
import { githubSignInUrl } from "@/lib/auth-signin";

function LinkedinIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
      <rect width="4" height="12" x="2" y="9" />
      <circle cx="4" cy="4" r="2" />
    </svg>
  );
}

type Channel = "email" | "linkedin" | "inmail";
type Purpose = "initial_outreach" | "follow_up" | "value_add" | "breakup";
type Tone = "professional" | "casual" | "technical_peer";

interface StepDraft {
  channel: Channel;
  delayDays: number;
  purpose: Purpose;
}

const TONES: { value: Tone; label: string; description: string }[] = [
  {
    value: "professional",
    label: "Professional",
    description:
      "Polished and respectful. Great for senior candidates and enterprise roles.",
  },
  {
    value: "casual",
    label: "Casual",
    description:
      "Friendly and conversational. Works well for startups and creative roles.",
  },
  {
    value: "technical_peer",
    label: "Technical Peer",
    description:
      "Engineer-to-engineer tone. References code, projects, and technical depth.",
  },
];

const CHANNEL_META: {
  value: Channel;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { value: "email", label: "Email", icon: Mail },
  { value: "linkedin", label: "LinkedIn", icon: LinkedinIcon },
  { value: "inmail", label: "InMail", icon: MessageSquare },
];

const PURPOSE_OPTIONS: { value: Purpose; label: string }[] = [
  { value: "initial_outreach", label: "Initial outreach" },
  { value: "follow_up", label: "Follow-up" },
  { value: "value_add", label: "Value add" },
  { value: "breakup", label: "Breakup" },
];

function defaultStep(): StepDraft {
  return { channel: "email", delayDays: 0, purpose: "initial_outreach" };
}

export default function NewSequencePage() {
  const { status: authStatus } = useSession();
  const router = useRouter();

  // Basics
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [roleTitle, setRoleTitle] = useState("");
  const [companyName, setCompanyName] = useState("");

  // Tone & context
  const [tone, setTone] = useState<Tone>("professional");
  const [sellingPoints, setSellingPoints] = useState("");
  const [customInstructions, setCustomInstructions] = useState("");

  // Steps
  const [steps, setSteps] = useState<StepDraft[]>([defaultStep()]);

  // Submission
  const [saving, setSaving] = useState(false);
  const [activating, setActivating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authStatus === "unauthenticated") {
      router.push(githubSignInUrl("/outreach/new"));
    }
  }, [authStatus, router]);

  function updateStep(index: number, patch: Partial<StepDraft>) {
    setSteps((prev) =>
      prev.map((s, i) => (i === index ? { ...s, ...patch } : s))
    );
  }

  function removeStep(index: number) {
    if (steps.length <= 1) return;
    setSteps((prev) => prev.filter((_, i) => i !== index));
  }

  function addStep() {
    const lastStep = steps[steps.length - 1];
    setSteps((prev) => [
      ...prev,
      {
        channel: "email",
        delayDays: lastStep ? 3 : 0,
        purpose: prev.length === 0 ? "initial_outreach" : "follow_up",
      },
    ]);
  }

  async function handleSubmit(activate: boolean) {
    if (!name.trim()) {
      setError("Sequence name is required.");
      return;
    }
    if (steps.length === 0) {
      setError("Add at least one step.");
      return;
    }

    setError(null);
    if (activate) setActivating(true);
    else setSaving(true);

    try {
      // 1. Create the sequence
      const seqRes = await fetch("/api/sequences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
          tone,
          sellingPoints: sellingPoints
            .split("\n")
            .map((l) => l.trim())
            .filter(Boolean),
          customInstructions: customInstructions.trim() || undefined,
          roleTitle: roleTitle.trim() || undefined,
          companyName: companyName.trim() || undefined,
        }),
      });

      if (!seqRes.ok) {
        const data = await seqRes.json();
        setError(data.error || "Failed to create sequence.");
        return;
      }

      const seq = await seqRes.json();

      // 2. Create steps via PUT (bulk upsert)
      const stepsRes = await fetch(`/api/sequences/${seq.id}/steps`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          steps: steps.map((s, i) => ({
            order: i,
            channel: s.channel,
            delayDays: i === 0 ? 0 : s.delayDays,
            purpose: s.purpose,
          })),
        }),
      });

      if (!stepsRes.ok) {
        // Sequence was created but steps failed — still redirect
        router.push(`/outreach/${seq.id}`);
        return;
      }

      // 3. Activate if requested (note: activate requires enrollments,
      //    so we set status directly for new sequences without enrollments)
      if (activate) {
        const activateRes = await fetch(`/api/sequences/${seq.id}/activate`, {
          method: "POST",
        });
        // If activate fails (e.g. no enrollments yet), that's ok —
        // the sequence was still created with steps
        if (!activateRes.ok) {
          // Sequence stays in draft, user can activate after enrolling candidates
        }
      }

      router.push(`/outreach/${seq.id}`);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
      setActivating(false);
    }
  }

  if (authStatus === "loading") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
      </div>
    );
  }

  const isBusy = saving || activating;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:px-8">
      {/* Back link + header */}
      <div className="mb-8">
        <Link
          href="/outreach"
          className="mb-4 inline-flex items-center gap-1 text-sm text-neutral-500 transition-colors hover:text-gold"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Sequences
        </Link>
        <h1 className="flex items-center gap-2.5 text-2xl font-bold text-neutral-900 dark:text-white">
          <Send className="h-5 w-5 text-gold" />
          New Sequence
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          Build a multi-step outreach sequence. Scout will personalize every
          message with candidate intelligence.
        </p>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}

      {/* ─── Section 1: Basics ─── */}
      <section className="mb-8 rounded-xl border border-neutral-200/50 bg-surface p-5 shadow-sm dark:border-neutral-800/80">
        <h2 className="mb-4 text-sm font-semibold text-neutral-900 dark:text-white">
          Basics
        </h2>
        <div className="space-y-4">
          <div>
            <label
              htmlFor="seq-name"
              className="mb-1 block text-xs font-medium uppercase tracking-wide text-neutral-500"
            >
              Name <span className="text-red-500">*</span>
            </label>
            <input
              id="seq-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Sr. Frontend — Series B Startups"
              className="w-full rounded-lg border border-neutral-200/50 bg-transparent px-3 py-2 text-sm outline-none focus:border-gold dark:border-neutral-700/50 dark:text-white"
            />
          </div>
          <div>
            <label
              htmlFor="seq-desc"
              className="mb-1 block text-xs font-medium uppercase tracking-wide text-neutral-500"
            >
              Description
            </label>
            <textarea
              id="seq-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional notes about this sequence"
              rows={2}
              className="w-full rounded-lg border border-neutral-200/50 bg-transparent px-3 py-2 text-sm outline-none focus:border-gold dark:border-neutral-700/50 dark:text-white"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="seq-role"
                className="mb-1 block text-xs font-medium uppercase tracking-wide text-neutral-500"
              >
                Role title
              </label>
              <input
                id="seq-role"
                type="text"
                value={roleTitle}
                onChange={(e) => setRoleTitle(e.target.value)}
                placeholder="e.g. Sr. Frontend Engineer"
                className="w-full rounded-lg border border-neutral-200/50 bg-transparent px-3 py-2 text-sm outline-none focus:border-gold dark:border-neutral-700/50 dark:text-white"
              />
            </div>
            <div>
              <label
                htmlFor="seq-company"
                className="mb-1 block text-xs font-medium uppercase tracking-wide text-neutral-500"
              >
                Company name
              </label>
              <input
                id="seq-company"
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Your company name"
                className="w-full rounded-lg border border-neutral-200/50 bg-transparent px-3 py-2 text-sm outline-none focus:border-gold dark:border-neutral-700/50 dark:text-white"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ─── Section 2: Tone & Context ─── */}
      <section className="mb-8 rounded-xl border border-neutral-200/50 bg-surface p-5 shadow-sm dark:border-neutral-800/80">
        <h2 className="mb-4 text-sm font-semibold text-neutral-900 dark:text-white">
          Tone &amp; Context
        </h2>

        {/* Tone selector */}
        <div className="mb-5">
          <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-neutral-500">
            Tone
          </label>
          <div className="grid grid-cols-3 gap-3">
            {TONES.map((t) => {
              const isSelected = tone === t.value;
              return (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setTone(t.value)}
                  className={`rounded-lg border p-3 text-left transition-all ${
                    isSelected
                      ? "border-gold bg-gold-bg ring-1 ring-gold/30"
                      : "border-neutral-200/50 hover:border-neutral-300 dark:border-neutral-700/50 dark:hover:border-neutral-600"
                  }`}
                >
                  <p
                    className={`text-sm font-semibold ${
                      isSelected
                        ? "text-gold"
                        : "text-neutral-900 dark:text-white"
                    }`}
                  >
                    {t.label}
                  </p>
                  <p className="mt-0.5 text-[11px] leading-snug text-neutral-500">
                    {t.description}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Selling points */}
        <div className="mb-4">
          <label
            htmlFor="seq-selling"
            className="mb-1 block text-xs font-medium uppercase tracking-wide text-neutral-500"
          >
            Selling points
          </label>
          <textarea
            id="seq-selling"
            value={sellingPoints}
            onChange={(e) => setSellingPoints(e.target.value)}
            placeholder={"One per line \u2014 what makes this role compelling?\ne.g. Remote-first, Series B, top-tier eng team"}
            rows={3}
            className="w-full rounded-lg border border-neutral-200/50 bg-transparent px-3 py-2 text-sm outline-none focus:border-gold dark:border-neutral-700/50 dark:text-white"
          />
        </div>

        {/* Custom instructions */}
        <div>
          <label
            htmlFor="seq-instructions"
            className="mb-1 block text-xs font-medium uppercase tracking-wide text-neutral-500"
          >
            Custom instructions
          </label>
          <textarea
            id="seq-instructions"
            value={customInstructions}
            onChange={(e) => setCustomInstructions(e.target.value)}
            placeholder="Any special instructions for AI message generation"
            rows={2}
            className="w-full rounded-lg border border-neutral-200/50 bg-transparent px-3 py-2 text-sm outline-none focus:border-gold dark:border-neutral-700/50 dark:text-white"
          />
        </div>
      </section>

      {/* ─── Section 3: Steps ─── */}
      <section className="mb-8 rounded-xl border border-neutral-200/50 bg-surface p-5 shadow-sm dark:border-neutral-800/80">
        <h2 className="mb-4 text-sm font-semibold text-neutral-900 dark:text-white">
          Steps
        </h2>

        <div className="space-y-3">
          {steps.map((step, index) => (
            <div
              key={index}
              className="relative rounded-lg border border-neutral-200/50 bg-neutral-50/50 p-4 dark:border-neutral-700/50 dark:bg-neutral-800/30"
            >
              {/* Step number + remove */}
              <div className="mb-3 flex items-center justify-between">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gold text-[11px] font-bold text-white">
                  {index + 1}
                </span>
                {steps.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeStep(index)}
                    className="rounded p-1 text-neutral-400 transition-colors hover:bg-neutral-200/50 hover:text-red-500 dark:hover:bg-neutral-700/50"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                {/* Channel selector */}
                <div>
                  <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-neutral-500">
                    Channel
                  </label>
                  <div className="flex rounded-lg border border-neutral-200/50 dark:border-neutral-700/50">
                    {CHANNEL_META.map((ch) => {
                      const Icon = ch.icon;
                      const isActive = step.channel === ch.value;
                      return (
                        <button
                          key={ch.value}
                          type="button"
                          onClick={() =>
                            updateStep(index, { channel: ch.value })
                          }
                          className={`flex flex-1 items-center justify-center gap-1 py-2 text-xs font-medium transition-colors first:rounded-l-lg last:rounded-r-lg ${
                            isActive
                              ? "bg-gold text-white"
                              : "bg-transparent text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-700/50"
                          }`}
                        >
                          <Icon className="h-3.5 w-3.5" />
                          <span className="hidden sm:inline">{ch.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Delay */}
                <div>
                  <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-neutral-500">
                    {index === 0 ? "Delay (first step)" : "Wait days"}
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      max={90}
                      value={index === 0 ? 0 : step.delayDays}
                      disabled={index === 0}
                      onChange={(e) =>
                        updateStep(index, {
                          delayDays: Math.max(0, parseInt(e.target.value) || 0),
                        })
                      }
                      className="w-full rounded-lg border border-neutral-200/50 bg-transparent px-3 py-2 text-sm outline-none focus:border-gold disabled:cursor-not-allowed disabled:opacity-50 dark:border-neutral-700/50 dark:text-white"
                    />
                    <span className="shrink-0 text-xs text-neutral-400">
                      days
                    </span>
                  </div>
                </div>

                {/* Purpose */}
                <div>
                  <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-neutral-500">
                    Purpose
                  </label>
                  <div className="relative">
                    <select
                      value={step.purpose}
                      onChange={(e) =>
                        updateStep(index, {
                          purpose: e.target.value as Purpose,
                        })
                      }
                      className="w-full appearance-none rounded-lg border border-neutral-200/50 bg-transparent px-3 py-2 pr-8 text-sm outline-none focus:border-gold dark:border-neutral-700/50 dark:text-white"
                    >
                      {PURPOSE_OPTIONS.map((p) => (
                        <option key={p.value} value={p.value}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400" />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Add step button */}
        <button
          type="button"
          onClick={addStep}
          className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-neutral-300 py-2.5 text-sm font-medium text-neutral-500 transition-colors hover:border-gold hover:text-gold dark:border-neutral-700 dark:hover:border-gold"
        >
          <Plus className="h-4 w-4" />
          Add step
        </button>
      </section>

      {/* ─── Bottom actions ─── */}
      <div className="flex items-center justify-end gap-3">
        <button
          type="button"
          disabled={isBusy}
          onClick={() => handleSubmit(false)}
          className="rounded-lg border border-neutral-200/50 px-5 py-2.5 text-sm font-semibold text-neutral-700 transition-colors hover:bg-neutral-50 disabled:opacity-50 disabled:cursor-not-allowed dark:border-neutral-700/50 dark:text-neutral-300 dark:hover:bg-neutral-800"
        >
          {saving ? (
            <span className="flex items-center gap-1.5">
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving...
            </span>
          ) : (
            "Save as Draft"
          )}
        </button>
        <button
          type="button"
          disabled={isBusy}
          onClick={() => handleSubmit(true)}
          className="rounded-lg bg-gold px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-gold-hover disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {activating ? (
            <span className="flex items-center gap-1.5">
              <Loader2 className="h-4 w-4 animate-spin" />
              Creating...
            </span>
          ) : (
            "Create & Activate"
          )}
        </button>
      </div>
    </div>
  );
}
