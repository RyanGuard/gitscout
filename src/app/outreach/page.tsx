"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Send,
  Plus,
  Mail,
  MessageSquare,
  Users,
  ArrowRight,
  Loader2,
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

interface Sequence {
  id: string;
  name: string;
  description: string | null;
  status: string;
  tone: string;
  roleTitle: string | null;
  companyName: string | null;
  stepCount: number;
  totalEnrolled: number;
  activeEnrollments: number;
  completedEnrollments: number;
  repliedEnrollments: number;
  totalCompleted: number;
  totalReplied: number;
  createdAt: string;
  updatedAt: string;
}

const STATUS_STYLES: Record<string, string> = {
  draft:
    "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400",
  active: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  paused: "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  completed: "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
};

const CHANNEL_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  email: Mail,
  linkedin: LinkedinIcon,
  inmail: MessageSquare,
};

export default function OutreachPage() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  const [sequences, setSequences] = useState<Sequence[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authStatus === "unauthenticated") {
      router.push("/api/auth/signin?callbackUrl=/outreach");
      return;
    }
    if (authStatus !== "authenticated") return;

    fetch("/api/sequences")
      .then((r) => r.json())
      .then((data) => setSequences(data.sequences || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [authStatus, router]);

  if (authStatus === "loading" || loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
      </div>
    );
  }

  const activeCount = sequences.filter((s) => s.status === "active").length;
  const totalEnrolled = sequences.reduce((sum, s) => sum + s.totalEnrolled, 0);
  const totalReplied = sequences.reduce((sum, s) => sum + s.repliedEnrollments, 0);
  const avgReplyRate =
    totalEnrolled > 0 ? Math.round((totalReplied / totalEnrolled) * 100) : 0;

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">
          Sequences
        </h1>
        <Link
          href="/outreach/new"
          className="inline-flex items-center gap-1.5 rounded-lg bg-gold px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-gold-hover"
        >
          <Plus className="h-4 w-4" />
          New Sequence
        </Link>
      </div>

      {/* Stats bar */}
      {sequences.length > 0 && (
        <div className="mb-6 grid grid-cols-3 gap-3">
          {[
            { label: "Active sequences", value: activeCount },
            { label: "Total enrolled", value: totalEnrolled },
            {
              label: "Avg reply rate",
              value: `${avgReplyRate}%`,
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-xl border border-neutral-200/50 bg-surface p-5 shadow-sm dark:border-neutral-800/80"
            >
              <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                {stat.label}
              </p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-neutral-900 dark:text-white">
                {stat.value}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Sequence cards or empty state */}
      {sequences.length === 0 ? (
        <div className="rounded-xl border border-dashed border-neutral-200/50 bg-neutral-50/50 p-12 text-center dark:border-neutral-700/30 dark:bg-neutral-900/30">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gold-bg border border-gold-border">
            <Send className="h-6 w-6 text-gold" />
          </div>
          <h2 className="mt-5 text-lg font-semibold text-neutral-900 dark:text-white">
            Your first sequence
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-neutral-500">
            Automate multi-step outreach that uses Scout&apos;s intelligence
            &mdash; scores, connections, and flight risk &mdash; to personalize
            every message.
          </p>
          <Link
            href="/outreach/new"
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-gold px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-gold-hover"
          >
            <Plus className="h-4 w-4" />
            Create a Sequence
          </Link>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {sequences.map((seq) => (
            <Link
              key={seq.id}
              href={`/outreach/${seq.id}`}
              className="group rounded-xl border border-neutral-200/50 bg-surface p-5 shadow-sm transition-all hover:border-gold/30 hover:shadow-md dark:border-neutral-800/80 dark:hover:border-gold/30"
            >
              {/* Name + status */}
              <div className="mb-3 flex items-start justify-between">
                <h3 className="text-sm font-semibold text-neutral-900 group-hover:text-gold dark:text-white dark:group-hover:text-gold transition-colors">
                  {seq.name}
                </h3>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${STATUS_STYLES[seq.status] || STATUS_STYLES.draft}`}
                >
                  {seq.status}
                </span>
              </div>

              {/* Step count with channel icons */}
              <div className="mb-3 flex items-center gap-2 text-xs text-neutral-500">
                <span>{seq.stepCount} step{seq.stepCount !== 1 ? "s" : ""}</span>
                <span className="text-neutral-300 dark:text-neutral-700">&middot;</span>
                <div className="flex items-center gap-1">
                  {Object.keys(CHANNEL_ICONS).map((channel) => {
                    const Icon = CHANNEL_ICONS[channel];
                    return (
                      <Icon
                        key={channel}
                        className="h-3.5 w-3.5 text-neutral-400 dark:text-neutral-600"
                      />
                    );
                  })}
                </div>
              </div>

              {/* Enrolled / replied */}
              <div className="mb-3 flex items-center gap-4 text-xs text-neutral-500">
                <span className="flex items-center gap-1">
                  <Users className="h-3.5 w-3.5" />
                  {seq.totalEnrolled} enrolled
                </span>
                <span className="flex items-center gap-1">
                  <MessageSquare className="h-3.5 w-3.5" />
                  {seq.repliedEnrollments} replied
                </span>
              </div>

              {/* Created date + arrow */}
              <div className="flex items-center justify-between">
                <p className="text-[11px] text-neutral-400">
                  Created{" "}
                  {new Date(seq.createdAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </p>
                <ArrowRight className="h-3.5 w-3.5 text-neutral-300 opacity-0 transition-all group-hover:opacity-100 group-hover:translate-x-0.5 dark:text-neutral-600" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
