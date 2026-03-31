"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import {
  Loader2,
  Users,
  Send,
  MessageSquare,
  ThumbsUp,
  Building2,
  XCircle,
  Mail,
  Smartphone,
  ExternalLink,
} from "lucide-react";

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

function GithubIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
    </svg>
  );
}

// ─── Types ───

interface PipelineCandidate {
  id: string;
  name: string;
  title: string | null;
  company: string | null;
  channel: string;
  linkedinUrl: string | null;
  sequenceId: string | null;
  daysInStage: number;
  stage: string;
}

interface PipelineStage {
  id: string;
  label: string;
  candidates: PipelineCandidate[];
}

// ─── Stage config ───

const STAGE_CONFIG: Record<
  string,
  { icon: React.ComponentType<{ className?: string }>; color: string }
> = {
  sourced: { icon: Users, color: "text-blue-400" },
  outreach_sent: { icon: Send, color: "text-amber-400" },
  responded: { icon: MessageSquare, color: "text-purple-400" },
  interested: { icon: ThumbsUp, color: "text-green-400" },
  in_ats: { icon: Building2, color: "text-cyan-400" },
  passed: { icon: XCircle, color: "text-zinc-500" },
};

function ChannelIcon({ channel, className }: { channel: string; className?: string }) {
  switch (channel) {
    case "email":
      return <Mail className={className} />;
    case "linkedin":
      return <LinkedinIcon className={className} />;
    case "text":
      return <Smartphone className={className} />;
    default:
      return <GithubIcon className={className} />;
  }
}

// ─── Candidate Card ───

function CandidateCard({ candidate }: { candidate: PipelineCandidate }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground truncate">
            {candidate.name}
          </p>
          {candidate.title && (
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              {candidate.title}
            </p>
          )}
          {candidate.company && (
            <p className="text-xs text-muted-foreground/70 truncate">
              {candidate.company}
            </p>
          )}
        </div>
        <ChannelIcon
          channel={candidate.channel}
          className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50 mt-0.5"
        />
      </div>

      <div className="flex items-center justify-between">
        <span className="text-[10px] text-muted-foreground/60">
          {candidate.daysInStage === 0
            ? "Today"
            : candidate.daysInStage === 1
              ? "1 day"
              : `${candidate.daysInStage} days`}
        </span>
        {candidate.sequenceId && (
          <a
            href={`/outreach/${candidate.sequenceId}`}
            className="text-[10px] font-medium text-gold hover:text-gold/80 flex items-center gap-1 transition-colors"
          >
            Open in Studio
            <ExternalLink className="h-2.5 w-2.5" />
          </a>
        )}
      </div>
    </div>
  );
}

// ─── Column ───

function PipelineColumn({ stage }: { stage: PipelineStage }) {
  const config = STAGE_CONFIG[stage.id] || { icon: Users, color: "text-zinc-400" };
  const StageIcon = config.icon;

  return (
    <div className="min-w-[250px] flex flex-col">
      {/* Column header */}
      <div className="flex items-center gap-2 px-1 pb-3">
        <StageIcon className={`h-4 w-4 ${config.color}`} />
        <h3 className="text-sm font-medium text-foreground">{stage.label}</h3>
        <span className="ml-auto rounded-full bg-surface px-2 py-0.5 text-[11px] font-medium text-muted-foreground border border-border">
          {stage.candidates.length}
        </span>
      </div>

      {/* Cards */}
      <div className="flex-1 space-y-2 overflow-y-auto max-h-[calc(100vh-200px)] pr-1">
        {stage.candidates.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-4 text-center">
            <p className="text-xs text-muted-foreground/50">No candidates</p>
          </div>
        ) : (
          stage.candidates.map((candidate) => (
            <CandidateCard key={candidate.id} candidate={candidate} />
          ))
        )}
      </div>
    </div>
  );
}

// ─── Page ───

export default function PipelinePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPipeline = useCallback(async () => {
    try {
      const res = await fetch("/api/pipeline/candidates");
      if (!res.ok) throw new Error("Failed to load pipeline");
      const data = await res.json();
      setStages(data.stages || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load pipeline");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/api/auth/signin?callbackUrl=/pipeline");
      return;
    }
    if (session?.user?.id) fetchPipeline();
  }, [session?.user?.id, status, router, fetchPipeline]);

  const totalCandidates = stages.reduce(
    (sum, s) => sum + s.candidates.length,
    0,
  );

  return (
    <div className="flex-1 min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border px-6 py-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Pipeline</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {loading
                ? "Loading..."
                : `${totalCandidates} candidate${totalCandidates !== 1 ? "s" : ""} across ${stages.length} stages`}
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="flex items-center justify-center py-24">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        ) : (
          <div className="flex gap-4 overflow-x-auto pb-4">
            {stages.map((stage) => (
              <PipelineColumn key={stage.id} stage={stage} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
