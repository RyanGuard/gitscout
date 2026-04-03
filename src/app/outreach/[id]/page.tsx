"use client";

import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  Mail, MessageSquare, ArrowLeft, Loader2,
  Play, Pause, Clock, Copy,
} from "lucide-react";

function LinkedinIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
      <rect width="4" height="12" x="2" y="9" />
      <circle cx="4" cy="4" r="2" />
    </svg>
  );
}

const CHANNEL_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  email: Mail,
  linkedin: LinkedinIcon,
  inmail: MessageSquare,
};

const STATUS_BADGE: Record<string, { label: string; classes: string }> = {
  draft: { label: "Draft", classes: "bg-neutral-500/10 text-neutral-500" },
  active: { label: "Active", classes: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
  paused: { label: "Paused", classes: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  completed: { label: "Completed", classes: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
  replied: { label: "Replied", classes: "bg-emerald-500/10 text-emerald-600" },
  bounced: { label: "Bounced", classes: "bg-red-500/10 text-red-500" },
  sent: { label: "Sent", classes: "bg-blue-500/10 text-blue-500" },
};

interface Step {
  id: string;
  order: number;
  channel: string;
  delayDays: number;
  purpose: string | null;
}

interface Message {
  id: string;
  stepOrder: number;
  channel: string;
  subjectLine: string | null;
  body: string;
  status: string;
  sentAt: string | null;
}

interface Enrollment {
  id: string;
  candidateEmail: string;
  candidateName: string;
  candidateTitle: string | null;
  candidateCompany: string | null;
  candidateLinkedinUrl: string | null;
  currentStep: number;
  status: string;
  nextSendAt: string | null;
  enrolledAt: string;
  messages: Message[];
}

interface SequenceDetail {
  id: string;
  name: string;
  description: string | null;
  status: string;
  tone: string;
  roleTitle: string | null;
  companyName: string | null;
  totalEnrolled: number;
  totalCompleted: number;
  totalReplied: number;
  createdAt: string;
  steps: Step[];
}

export default function SequenceDetailPage() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [sequence, setSequence] = useState<SequenceDetail | null>(null);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"overview" | "enrollments" | "messages">("overview");
  const [acting, setActing] = useState(false);

  const load = useCallback(async () => {
    const [seqRes, enrollRes] = await Promise.all([
      fetch(`/api/sequences/${id}`),
      fetch(`/api/sequences/${id}/enrollments`),
    ]);
    if (seqRes.ok) setSequence(await seqRes.json());
    if (enrollRes.ok) {
      const data = await enrollRes.json();
      setEnrollments(data.enrollments || []);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    if (authStatus === "unauthenticated") {
      router.push("/api/auth/signin?callbackUrl=/outreach");
      return;
    }
    if (session?.user?.id) queueMicrotask(() => void load());
  }, [session, authStatus, router, load]);

  async function toggleStatus() {
    if (!sequence) return;
    setActing(true);
    const endpoint =
      sequence.status === "active"
        ? `/api/sequences/${id}/pause`
        : `/api/sequences/${id}/activate`;
    await fetch(endpoint, { method: "POST" });
    await load();
    setActing(false);
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
      </div>
    );
  }

  if (!sequence) {
    return (
      <div className="py-16 text-center text-neutral-500">
        Sequence not found.
      </div>
    );
  }

  const badge = STATUS_BADGE[sequence.status] || STATUS_BADGE.draft;
  const allMessages = enrollments.flatMap((e) =>
    e.messages.map((m) => ({ ...m, candidateName: e.candidateName, candidateEmail: e.candidateEmail }))
  );

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      {/* Header */}
      <Link
        href="/outreach"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-gold transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Sequences
      </Link>

      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-neutral-900 dark:text-white">
              {sequence.name}
            </h1>
            <span className={`rounded-md px-2 py-0.5 text-[10px] font-semibold ${badge.classes}`}>
              {badge.label}
            </span>
          </div>
          {sequence.roleTitle && (
            <p className="mt-1 text-sm text-neutral-500">{sequence.roleTitle}</p>
          )}
        </div>
        <button
          onClick={toggleStatus}
          disabled={acting}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            sequence.status === "active"
              ? "border border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-400"
              : "bg-gold text-white hover:bg-gold-hover"
          }`}
        >
          {acting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : sequence.status === "active" ? (
            <Pause className="h-4 w-4" />
          ) : (
            <Play className="h-4 w-4" />
          )}
          {sequence.status === "active" ? "Pause" : "Activate"}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {[
          { label: "Steps", value: sequence.steps.length },
          { label: "Enrolled", value: sequence.totalEnrolled },
          { label: "Completed", value: sequence.totalCompleted },
          { label: "Replied", value: sequence.totalReplied },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-xl border border-neutral-200/50 bg-surface p-4 dark:border-neutral-800/80"
          >
            <p className="text-xs uppercase tracking-wide text-neutral-500">{s.label}</p>
            <p className="mt-1 text-2xl font-bold text-neutral-900 dark:text-white">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-neutral-200/50 dark:border-neutral-800/50">
        {(["overview", "enrollments", "messages"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize transition-colors border-b-2 ${
              tab === t
                ? "border-gold text-gold"
                : "border-transparent text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {tab === "overview" && (
        <div className="space-y-3">
          {sequence.steps.map((step, i) => {
            const Icon = CHANNEL_ICONS[step.channel] || Mail;
            const stepMessages = allMessages.filter((m) => m.stepOrder === step.order);
            const sent = stepMessages.filter((m) => m.status === "sent").length;
            const replied = stepMessages.filter((m) => m.status === "replied").length;

            return (
              <div key={step.id} className="flex items-start gap-4">
                {/* Timeline connector */}
                <div className="flex flex-col items-center">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gold text-white text-xs font-bold">
                    {i + 1}
                  </div>
                  {i < sequence.steps.length - 1 && (
                    <div className="h-10 w-px bg-neutral-200 dark:bg-neutral-700" />
                  )}
                </div>

                {/* Step card */}
                <div className="flex-1 rounded-lg border border-neutral-200/50 bg-surface p-4 dark:border-neutral-800/80">
                  <div className="flex items-center gap-2 mb-1">
                    <Icon className="h-4 w-4 text-gold" />
                    <span className="text-sm font-medium text-neutral-900 dark:text-white capitalize">
                      {step.channel}
                    </span>
                    {step.delayDays > 0 && (
                      <span className="flex items-center gap-1 text-xs text-neutral-500">
                        <Clock className="h-3 w-3" />
                        +{step.delayDays}d
                      </span>
                    )}
                    {step.purpose && (
                      <span className="text-xs text-neutral-400">
                        {step.purpose.replace(/_/g, " ")}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-3 text-xs text-neutral-500">
                    <span>{sent} sent</span>
                    <span>{replied} replied</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Enrollments Tab */}
      {tab === "enrollments" && (
        <div className="rounded-xl border border-neutral-200/50 bg-surface overflow-hidden dark:border-neutral-800/80">
          {enrollments.length === 0 ? (
            <div className="py-12 text-center text-sm text-neutral-500">
              No candidates enrolled yet. Add candidates from Search, Market Maps, or Saved Lists.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200/50 dark:border-neutral-800/50">
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-neutral-500">Candidate</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-neutral-500">Step</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-neutral-500">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-neutral-500">Next Send</th>
                </tr>
              </thead>
              <tbody>
                {enrollments.map((e) => {
                  const eBadge = STATUS_BADGE[e.status] || STATUS_BADGE.active;
                  return (
                    <tr
                      key={e.id}
                      className="border-b border-neutral-100/50 dark:border-neutral-800/30 hover:bg-neutral-50/50 dark:hover:bg-neutral-800/20"
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium text-neutral-900 dark:text-white">
                          {e.candidateName}
                        </p>
                        <p className="text-xs text-neutral-500">
                          {e.candidateTitle}{e.candidateCompany ? ` at ${e.candidateCompany}` : ""}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400">
                        {e.currentStep + 1} of {sequence.steps.length}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`rounded-md px-2 py-0.5 text-[10px] font-semibold ${eBadge.classes}`}>
                          {eBadge.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-neutral-500">
                        {e.nextSendAt
                          ? new Date(e.nextSendAt).toLocaleDateString()
                          : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Messages Tab */}
      {tab === "messages" && (
        <div className="space-y-3">
          {allMessages.length === 0 ? (
            <div className="py-12 text-center text-sm text-neutral-500">
              No messages generated yet.
            </div>
          ) : (
            allMessages.map((m) => {
              const mBadge = STATUS_BADGE[m.status] || STATUS_BADGE.draft;
              return (
                <div
                  key={m.id}
                  className="rounded-xl border border-neutral-200/50 bg-surface p-4 dark:border-neutral-800/80"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-neutral-900 dark:text-white">
                        {m.candidateName}
                      </span>
                      <span className="text-xs text-neutral-400">Step {m.stepOrder + 1}</span>
                      <span className={`rounded-md px-2 py-0.5 text-[10px] font-semibold ${mBadge.classes}`}>
                        {mBadge.label}
                      </span>
                    </div>
                    <button
                      onClick={() => navigator.clipboard.writeText(m.body)}
                      className="text-neutral-400 hover:text-gold transition-colors"
                      title="Copy message"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  {m.subjectLine && (
                    <p className="text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                      Subject: {m.subjectLine}
                    </p>
                  )}
                  <p className="text-sm text-neutral-600 dark:text-neutral-400 whitespace-pre-line">
                    {m.body}
                  </p>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
