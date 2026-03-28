/**
 * Builds a candidate context snapshot for sequence enrollment.
 * Aggregates data from Developer, MapCandidate, Connections, etc.
 */

import { prisma } from "@/lib/prisma";

interface CandidateSource {
  type: "map_candidate" | "developer" | "candidate_entry";
  id: string;
}

export interface CandidateContextSnapshot {
  name: string;
  email: string;
  title?: string;
  company?: string;
  city?: string;
  linkedinUrl?: string;
  fitScore?: number;
  fitReasoning?: string;
  flightRisk?: string;
  flightRiskSignals?: string[];
  scoutScore?: number;
  languages?: string[];
  topRepos?: Array<{ name: string; description?: string; stars?: number }>;
  connections?: Array<{ type: string; strength: string; detail: string }>;
}

export async function buildCandidateContext(
  source: CandidateSource,
  userId: string
): Promise<CandidateContextSnapshot | null> {
  if (source.type === "map_candidate") {
    return buildFromMapCandidate(source.id, userId);
  } else if (source.type === "developer") {
    return buildFromDeveloper(source.id, userId);
  } else if (source.type === "candidate_entry") {
    return buildFromCandidateEntry(source.id, userId);
  }
  return null;
}

async function buildFromMapCandidate(
  id: string,
  userId: string
): Promise<CandidateContextSnapshot | null> {
  const candidate = await prisma.mapCandidate.findUnique({
    where: { id },
    include: {
      company: {
        include: { map: true },
      },
    },
  });

  if (!candidate || candidate.company.map.userId !== userId) return null;
  if (!candidate.email && !candidate.linkedinUrl) return null;

  const ctx: CandidateContextSnapshot = {
    name: candidate.name,
    email: candidate.email || "",
    title: candidate.title || undefined,
    company: candidate.company.companyName,
    city: candidate.city || undefined,
    linkedinUrl: candidate.linkedinUrl || undefined,
    fitScore: candidate.fitScore || undefined,
    fitReasoning: candidate.fitReasoning || undefined,
    flightRisk: candidate.flightRisk || undefined,
    flightRiskSignals: candidate.flightRiskSignals || undefined,
  };

  // Try to find warm connections
  const connections = await findConnections(
    candidate.company.companyDomain,
    userId
  );
  if (connections.length > 0) {
    ctx.connections = connections;
  }

  return ctx;
}

async function buildFromDeveloper(
  id: string,
  _userId: string
): Promise<CandidateContextSnapshot | null> {
  const developer = await prisma.developer.findUnique({
    where: { id },
    include: {
      languages: { orderBy: { percentage: "desc" }, take: 5 },
      repositories: { orderBy: { stars: "desc" }, take: 3 },
    },
  });

  if (!developer || !developer.email) return null;

  return {
    name: developer.name || developer.username,
    email: developer.email,
    title: developer.bio || undefined,
    company: developer.company || undefined,
    city: developer.location || undefined,
    scoutScore: developer.score || undefined,
    languages: developer.languages.map((l) => l.language),
    topRepos: developer.repositories.map((r) => ({
      name: r.name,
      description: r.description || undefined,
      stars: r.stars,
    })),
  };
}

async function buildFromCandidateEntry(
  id: string,
  userId: string
): Promise<CandidateContextSnapshot | null> {
  const entry = await prisma.candidateEntry.findUnique({
    where: { id },
    include: {
      list: true,
      developer: {
        include: {
          languages: { orderBy: { percentage: "desc" }, take: 5 },
          repositories: { orderBy: { stars: "desc" }, take: 3 },
        },
      },
    },
  });

  if (!entry || entry.list.userId !== userId) return null;
  if (!entry.developer.email) return null;

  return {
    name: entry.developer.name || entry.developer.username,
    email: entry.developer.email,
    title: entry.developer.bio || undefined,
    company: entry.developer.company || undefined,
    city: entry.developer.location || undefined,
    scoutScore: entry.developer.score || undefined,
    languages: entry.developer.languages.map((l) => l.language),
    topRepos: entry.developer.repositories.map((r) => ({
      name: r.name,
      description: r.description || undefined,
      stars: r.stars,
    })),
  };
}

async function findConnections(
  companyDomain: string,
  userId: string
): Promise<Array<{ type: string; strength: string; detail: string }>> {
  try {
    const lookup = await prisma.connectionLookup.findFirst({
      where: { userId, targetCompanyDomain: companyDomain },
      include: { connections: { take: 5, orderBy: { strength: "asc" } } },
    });

    if (!lookup) return [];

    return lookup.connections.map((c) => ({
      type: c.connectionType,
      strength: c.strength,
      detail: c.homePersonName
        ? `${c.homePersonName} → ${c.targetPersonName || "target"}`
        : c.connectionType,
    }));
  } catch {
    return [];
  }
}
