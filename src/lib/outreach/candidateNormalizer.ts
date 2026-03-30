// Normalizes candidate data from various sources into the unified CandidateData shape
// used by the Outreach Studio.

export interface CandidateData {
  name: string;
  title?: string;
  company?: string;
  location?: string;
  linkedinUrl?: string;
  email?: string;
  githubUrl?: string;
  context?: Record<string, unknown>;
  sourceType?: string;
  sourceDeveloperId?: string;
  sourceMapId?: string;
}

// From a GitHub developer profile (search results, saved lists)
export function fromDeveloperProfile(dev: {
  id: string;
  username: string;
  name?: string | null;
  email?: string | null;
  company?: string | null;
  location?: string | null;
  bio?: string | null;
  score?: number;
  languages?: { language: string; percentage: number }[];
  repositories?: { name: string; stars: number; language: string | null }[];
}, tier?: string): CandidateData {
  return {
    name: dev.name || dev.username,
    company: dev.company?.replace(/^@/, "") || undefined,
    location: dev.location || undefined,
    email: dev.email || undefined,
    githubUrl: `https://github.com/${dev.username}`,
    sourceType: "search",
    sourceDeveloperId: dev.id,
    context: {
      score: dev.score,
      tier,
      bio: dev.bio,
      topRepos: dev.repositories?.slice(0, 3).map((r) => ({
        name: r.name,
        stars: r.stars,
        language: r.language,
      })),
      languages: dev.languages?.slice(0, 5).map((l) => l.language),
    },
  };
}

// From a market map candidate
export function fromMapCandidate(candidate: {
  id: string;
  name: string;
  title?: string | null;
  seniority?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  linkedinUrl?: string | null;
  email?: string | null;
  fitScore?: number | null;
  fitReasoning?: string | null;
  flightRisk?: string | null;
  flightRiskSignals?: string[];
}, mapId: string, companyName?: string): CandidateData {
  const location = [candidate.city, candidate.state, candidate.country]
    .filter(Boolean)
    .join(", ");

  return {
    name: candidate.name,
    title: candidate.title || undefined,
    company: companyName || undefined,
    location: location || undefined,
    linkedinUrl: candidate.linkedinUrl || undefined,
    email: candidate.email || undefined,
    sourceType: "market_map",
    sourceMapId: mapId,
    context: {
      fitScore: candidate.fitScore,
      fitReasoning: candidate.fitReasoning,
      flightRisk: candidate.flightRisk,
      flightRiskSignals: candidate.flightRiskSignals,
      seniority: candidate.seniority,
    },
  };
}

// From a surfaced candidate (alerts/market intelligence)
export function fromSurfacedCandidate(candidate: {
  id: string;
  name: string;
  title?: string | null;
  seniority?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  linkedinUrl?: string | null;
  email?: string | null;
}, companyName?: string, signalContext?: string): CandidateData {
  const location = [candidate.city, candidate.state, candidate.country]
    .filter(Boolean)
    .join(", ");

  return {
    name: candidate.name,
    title: candidate.title || undefined,
    company: companyName || undefined,
    location: location || undefined,
    linkedinUrl: candidate.linkedinUrl || undefined,
    email: candidate.email || undefined,
    sourceType: "alert",
    context: {
      seniority: candidate.seniority,
      signalContext,
    },
  };
}

// From a saved list entry (includes Apollo enrichment data if available)
export function fromListEntry(entry: {
  id: string;
  developer: {
    id: string;
    username: string;
    name?: string | null;
    email?: string | null;
    company?: string | null;
    location?: string | null;
    bio?: string | null;
    score?: number;
    languages?: { language: string; percentage: number }[];
    repositories?: { name: string; stars: number; language: string | null }[];
    contactInfo?: {
      primaryEmail?: string | null;
      emails?: string[];
      phone?: string | null;
      linkedinUrl?: string | null;
      twitterUrl?: string | null;
      currentTitle?: string | null;
      headline?: string | null;
      normalizedCompany?: string | null;
      seniorityLevel?: string | null;
      employmentHistory?: unknown;
      photoUrl?: string | null;
      enrichedAt?: string | null;
      enrichmentSource?: string | null;
    } | null;
  };
  tags?: string[];
  lastNote?: string | null;
}): CandidateData {
  const dev = entry.developer;
  const contact = dev.contactInfo;

  return {
    name: dev.name || dev.username,
    title: contact?.currentTitle || undefined,
    company: contact?.normalizedCompany || dev.company?.replace(/^@/, "") || undefined,
    location: dev.location || undefined,
    linkedinUrl: contact?.linkedinUrl || undefined,
    email: contact?.primaryEmail || dev.email || undefined,
    githubUrl: `https://github.com/${dev.username}`,
    sourceType: "list",
    sourceDeveloperId: dev.id,
    context: {
      score: dev.score,
      bio: dev.bio,
      topRepos: dev.repositories?.slice(0, 3).map((r) => ({
        name: r.name,
        stars: r.stars,
        language: r.language,
      })),
      languages: dev.languages?.slice(0, 5).map((l) => l.language),
      tags: entry.tags,
      lastNote: entry.lastNote,
      // Enrichment data
      phone: contact?.phone,
      headline: contact?.headline,
      seniority: contact?.seniorityLevel,
      employmentHistory: contact?.employmentHistory,
      photoUrl: contact?.photoUrl,
      enriched: !!contact?.enrichedAt,
      enrichmentSource: contact?.enrichmentSource,
      twitterUrl: contact?.twitterUrl,
      allEmails: contact?.emails,
    },
  };
}

// Build outreach studio URL with candidate data encoded as search params
export function buildOutreachUrl(candidate: CandidateData): string {
  const params = new URLSearchParams();
  params.set("name", candidate.name);
  if (candidate.title) params.set("title", candidate.title);
  if (candidate.company) params.set("company", candidate.company);
  if (candidate.location) params.set("location", candidate.location);
  if (candidate.linkedinUrl) params.set("linkedin", candidate.linkedinUrl);
  if (candidate.email) params.set("email", candidate.email);
  if (candidate.githubUrl) params.set("github", candidate.githubUrl);
  if (candidate.sourceType) params.set("source", candidate.sourceType);
  if (candidate.sourceDeveloperId) params.set("devId", candidate.sourceDeveloperId);
  if (candidate.sourceMapId) params.set("mapId", candidate.sourceMapId);
  if (candidate.context) params.set("ctx", JSON.stringify(candidate.context));
  return `/outreach?${params.toString()}`;
}
