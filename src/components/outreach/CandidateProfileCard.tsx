"use client";

import { ExternalLink, MapPin, Building2, Mail, Star, Shield, AlertTriangle, Users, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { getLanguageColor } from "@/lib/utils";
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
  tier?: string;
  bio?: string;
  topRepos?: { name: string; stars: number; language: string | null }[];
  languages?: string[];
  fitScore?: number;
  fitReasoning?: string;
  flightRisk?: string;
  flightRiskSignals?: string[];
  seniority?: string;
  connections?: { name: string; type?: string }[];
  tags?: string[];
  lastNote?: string;
  signalContext?: string;
  // Enrichment data from Apollo
  phone?: string;
  headline?: string;
  employmentHistory?: Array<{ organization_name: string; title: string | null; current: boolean }>;
  photoUrl?: string;
  enriched?: boolean;
  enrichmentSource?: string;
  twitterUrl?: string;
  allEmails?: string[];
}

function ctx(candidate: CandidateData): Ctx {
  return (candidate.context as Ctx) || {};
}

// ─── Component ───

export function CandidateProfileCard({ candidate }: { candidate: CandidateData }) {
  const c = ctx(candidate);
  const hasLinks = candidate.linkedinUrl || candidate.githubUrl || candidate.email;
  const hasRepos = c.topRepos && c.topRepos.length > 0;
  const hasLanguages = c.languages && c.languages.length > 0;
  const hasFit = c.fitScore != null;
  const hasFlightRisk = !!c.flightRisk;
  const hasConnections = c.connections && c.connections.length > 0;
  const hasIntelligence = hasFit || hasFlightRisk || c.tier || c.seniority;

  return (
    <div className="flex flex-col gap-4 max-w-2xl mx-auto w-full">

      {/* ── Header ── */}
      <div className="rounded-xl border border-border bg-surface p-4">
        <div className="flex items-start gap-3">
          {/* Avatar */}
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gold-bg text-gold text-sm font-bold">
            {candidate.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-text truncate">{candidate.name}</h2>
              {c.score != null && (
                <span className="shrink-0 inline-flex items-center gap-1 rounded-md bg-gold-bg px-2 py-0.5 text-[11px] font-bold text-gold">
                  <Star className="h-3 w-3" />
                  {c.score}
                </span>
              )}
              {c.tier && (
                <span className="shrink-0 inline-flex items-center rounded-md bg-surface-secondary px-2 py-0.5 text-[11px] font-semibold text-text-secondary capitalize">
                  {c.tier}
                </span>
              )}
            </div>
            {(candidate.title || candidate.company) && (
              <p className="text-xs text-text-secondary mt-0.5 truncate">
                {candidate.title}{candidate.title && candidate.company ? " at " : ""}{candidate.company}
              </p>
            )}
            {candidate.location && (
              <div className="flex items-center gap-1 text-xs text-text-muted mt-1">
                <MapPin className="h-3 w-3" />
                <span>{candidate.location}</span>
              </div>
            )}
          </div>
        </div>

        {/* Bio */}
        {c.bio && (
          <p className="mt-3 text-xs text-text-secondary leading-relaxed border-t border-border pt-3">
            {String(c.bio)}
          </p>
        )}

        {/* Links row */}
        {hasLinks && (
          <div className="flex items-center gap-3 mt-3 border-t border-border pt-3">
            {candidate.githubUrl && (
              <a
                href={candidate.githubUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-[11px] font-medium text-text-secondary hover:text-gold transition-colors"
              >
                <GithubIcon className="h-3.5 w-3.5" />
                GitHub
                <ExternalLink className="h-2.5 w-2.5" />
              </a>
            )}
            {candidate.linkedinUrl && (
              <a
                href={candidate.linkedinUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-[11px] font-medium text-text-secondary hover:text-gold transition-colors"
              >
                <LinkedinIcon className="h-3.5 w-3.5" />
                LinkedIn
                <ExternalLink className="h-2.5 w-2.5" />
              </a>
            )}
            {candidate.email && (
              <a
                href={`mailto:${candidate.email}`}
                className="inline-flex items-center gap-1.5 text-[11px] font-medium text-text-secondary hover:text-gold transition-colors"
              >
                <Mail className="h-3.5 w-3.5" />
                {candidate.email}
              </a>
            )}
            {c.phone && (
              <span className="inline-flex items-center gap-1.5 text-[11px] text-text-secondary">
                📱 {c.phone}
              </span>
            )}
          </div>
        )}

        {/* Enrichment status + CTA */}
        {candidate.sourceDeveloperId && (
          <div className="mt-3 border-t border-border pt-3 flex items-center justify-between">
            {c.enriched ? (
              <span className="inline-flex items-center gap-1 text-[10px] text-success">
                <Shield className="h-3 w-3" />
                Enriched via {c.enrichmentSource || "Apollo"}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[10px] text-text-dim">
                Not enriched
              </span>
            )}
            {!c.enriched && (
              <button
                onClick={() => {
                  fetch(`/api/enrich/${candidate.sourceDeveloperId}`, { method: "POST" })
                    .then(() => window.location.reload())
                    .catch(() => {});
                }}
                className="text-[10px] font-medium text-gold hover:text-gold-hover transition-colors"
              >
                Enrich now
              </button>
            )}
            {c.enriched && !candidate.linkedinUrl && !candidate.email && (
              <span className="text-[10px] text-warning">LinkedIn & email missing — re-enrich?</span>
            )}
          </div>
        )}

        {/* Missing data warnings for outreach */}
        {!candidate.linkedinUrl && !candidate.email && (
          <div className="mt-2 rounded-lg bg-warning-bg border border-warning/20 px-3 py-2 text-[10px] text-warning flex items-center gap-1.5">
            <AlertTriangle className="h-3 w-3 shrink-0" />
            No LinkedIn URL or email found. Enrich this candidate before sending outreach.
          </div>
        )}
      </div>

      {/* ── GitHub Highlights ── */}
      {(hasRepos || hasLanguages) && (
        <div className="rounded-xl border border-border bg-surface p-4">
          <h3 className="text-[10px] font-semibold uppercase tracking-wide text-text-muted mb-3 flex items-center gap-1.5">
            <GithubIcon className="h-3 w-3" />
            GitHub Highlights
          </h3>

          {/* Top Repos */}
          {hasRepos && (
            <div className="grid gap-2 mb-3">
              {c.topRepos!.map((repo) => (
                <div
                  key={repo.name}
                  className="flex items-center justify-between rounded-lg border border-border bg-surface-secondary px-3 py-2"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {repo.language && (
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: getLanguageColor(repo.language) }}
                      />
                    )}
                    <span className="text-xs font-medium text-text truncate">{repo.name}</span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 text-[11px] text-text-muted">
                    <Star className="h-3 w-3" />
                    {repo.stars.toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Languages */}
          {hasLanguages && (
            <div className="flex flex-wrap gap-1.5">
              {c.languages!.map((lang) => (
                <span
                  key={lang}
                  className="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-medium text-text-secondary bg-surface-secondary"
                >
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: getLanguageColor(lang) }}
                  />
                  {lang}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Intelligence ── */}
      {hasIntelligence && (
        <div className="rounded-xl border border-border bg-surface p-4">
          <h3 className="text-[10px] font-semibold uppercase tracking-wide text-text-muted mb-3 flex items-center gap-1.5">
            <Zap className="h-3 w-3" />
            Intelligence
          </h3>

          <div className="space-y-2.5">
            {/* Fit Score */}
            {hasFit && (
              <div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-text-muted">Fit Score</span>
                  <span className="font-semibold text-gold">{c.fitScore}/100</span>
                </div>
                {/* Fit bar */}
                <div className="mt-1 h-1.5 w-full rounded-full bg-surface-secondary overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gold"
                    style={{ width: `${Math.min(c.fitScore!, 100)}%` }}
                  />
                </div>
                {c.fitReasoning && (
                  <p className="mt-1.5 text-[11px] text-text-muted leading-relaxed">{String(c.fitReasoning)}</p>
                )}
              </div>
            )}

            {/* Flight Risk */}
            {hasFlightRisk && (
              <div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-text-muted flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    Flight Risk
                  </span>
                  <span className={cn(
                    "font-semibold capitalize",
                    c.flightRisk === "high" ? "text-danger" :
                    c.flightRisk === "medium" ? "text-warning" : "text-success"
                  )}>
                    {c.flightRisk}
                  </span>
                </div>
                {c.flightRiskSignals && c.flightRiskSignals.length > 0 && (
                  <ul className="mt-1.5 space-y-0.5">
                    {c.flightRiskSignals.map((signal, i) => (
                      <li key={i} className="text-[11px] text-text-muted flex items-start gap-1.5">
                        <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-text-dim" />
                        {signal}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* Seniority / Tier */}
            {(c.seniority || c.tier) && (
              <div className="flex items-center gap-2 pt-1">
                {c.seniority && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-surface-secondary px-2 py-0.5 text-[11px] font-medium text-text-secondary capitalize">
                    <Shield className="h-3 w-3" />
                    {c.seniority}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Connections ── */}
      {hasConnections && (
        <div className="rounded-xl border border-border bg-surface p-4">
          <h3 className="text-[10px] font-semibold uppercase tracking-wide text-text-muted mb-3 flex items-center gap-1.5">
            <Users className="h-3 w-3" />
            Connections
          </h3>

          {/* Warm intro badge */}
          <div className="rounded-lg bg-gold-bg border border-gold-border px-3 py-2 mb-3">
            <p className="text-[11px] font-semibold text-gold">
              Warm intro available -- {c.connections!.length} mutual connection{c.connections!.length !== 1 ? "s" : ""}
            </p>
          </div>

          <div className="space-y-1.5">
            {c.connections!.map((conn, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <span className="font-medium text-text">{conn.name}</span>
                {conn.type && (
                  <span className="text-[10px] text-text-muted capitalize">{conn.type}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Tags / Notes ── */}
      {(c.tags && c.tags.length > 0 || c.lastNote || c.signalContext) && (
        <div className="rounded-xl border border-border bg-surface p-4">
          {c.tags && c.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {c.tags.map((tag) => (
                <span key={tag} className="rounded-md bg-surface-secondary px-2 py-0.5 text-[11px] font-medium text-text-secondary">
                  {tag}
                </span>
              ))}
            </div>
          )}
          {c.lastNote && (
            <p className="text-[11px] text-text-muted italic">&quot;{String(c.lastNote)}&quot;</p>
          )}
          {c.signalContext && (
            <p className="text-[11px] text-text-muted">{String(c.signalContext)}</p>
          )}
        </div>
      )}

      {/* CTA hint */}
      <p className="text-center text-xs text-text-dim pb-2">
        Click &quot;Generate sequence&quot; in the right panel to create personalized outreach.
      </p>
    </div>
  );
}
