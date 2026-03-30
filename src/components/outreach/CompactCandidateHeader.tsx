"use client";

import { Mail, Phone } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CandidateData } from "@/lib/outreach/candidateNormalizer";

// ─── Inline Icons ───

function GithubIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
    </svg>
  );
}

function LinkedinIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
      <rect width="4" height="12" x="2" y="9" />
      <circle cx="4" cy="4" r="2" />
    </svg>
  );
}

// ─── Helpers ───

interface Ctx {
  score?: number;
  phone?: string;
  photoUrl?: string;
  enriched?: boolean;
}

function ctx(candidate: CandidateData): Ctx {
  return (candidate.context as Ctx) || {};
}

// ─── Component ───

export function CompactCandidateHeader({ candidate }: { candidate: CandidateData }) {
  const c = ctx(candidate);
  const initials = candidate.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const titleCompany = [candidate.title, candidate.company].filter(Boolean).join(" at ");

  return (
    <div className="shrink-0 flex items-center gap-3 border-b border-border bg-surface px-5 py-2.5">
      {/* ── Left group ── */}
      <div className="flex items-center gap-2.5 min-w-0">
        {/* Avatar */}
        {c.photoUrl ? (
          <img
            src={c.photoUrl}
            alt={candidate.name}
            className="h-8 w-8 shrink-0 rounded-full object-cover"
          />
        ) : (
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gold-bg text-gold text-[11px] font-bold">
            {initials}
          </div>
        )}

        {/* Name + title */}
        <div className="min-w-0">
          <p className="text-sm font-semibold text-text truncate">{candidate.name}</p>
          {titleCompany && (
            <p className="text-xs text-text-secondary truncate">{titleCompany}</p>
          )}
        </div>
      </div>

      {/* ── Center: score badge ── */}
      {c.score != null && (
        <span className="inline-flex items-center gap-0.5 rounded bg-gold-bg px-1.5 py-0.5 text-[10px] font-bold text-gold">
          ☆ {c.score}
        </span>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* ── Right group: icon links ── */}
      <div className="flex items-center gap-2.5">
        {candidate.linkedinUrl && (
          <a
            href={candidate.linkedinUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-text-muted hover:text-gold transition-colors"
          >
            <LinkedinIcon className="h-3.5 w-3.5" />
          </a>
        )}

        {candidate.githubUrl && (
          <a
            href={candidate.githubUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-text-muted hover:text-gold transition-colors"
          >
            <GithubIcon className="h-3.5 w-3.5" />
          </a>
        )}

        {candidate.email && (
          <a
            href={`mailto:${candidate.email}`}
            className="text-text-muted hover:text-gold transition-colors"
          >
            <Mail className="h-3.5 w-3.5" />
          </a>
        )}

        {c.phone && (
          <span className="text-text-muted">
            <Phone className="h-3.5 w-3.5" />
          </span>
        )}

        {/* Enrichment dot */}
        <span
          className={cn(
            "h-2 w-2 shrink-0 rounded-full",
            c.enriched ? "bg-success" : "bg-text-dim"
          )}
        />
      </div>
    </div>
  );
}
