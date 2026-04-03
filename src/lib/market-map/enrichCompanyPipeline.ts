import { prisma } from "@/lib/prisma";
import { scoreTier, assignTier } from "@/lib/map/tierScoring";
import { apolloFetch } from "@/lib/apollo-fetch";
import { runEnrichNewsCore } from "@/lib/market-map/enrichNewsCore";
import { runClassifyCore } from "@/lib/market-map/classifyCore";

const APOLLO_API = "https://api.apollo.io/api/v1";

const TITLE_EXPANSIONS: Record<string, string[]> = {
  "platform engineer": ["platform engineer", "infrastructure engineer", "SRE", "site reliability", "devops engineer", "cloud engineer"],
  "frontend engineer": ["frontend engineer", "front-end developer", "UI engineer", "web developer", "react developer"],
  "backend engineer": ["backend engineer", "back-end developer", "server engineer", "API engineer"],
  "ml engineer": ["machine learning engineer", "ML engineer", "AI engineer", "deep learning", "data scientist"],
  "data engineer": ["data engineer", "analytics engineer", "data platform", "ETL engineer"],
  "mobile engineer": ["mobile engineer", "iOS developer", "android developer", "mobile developer"],
  "devops": ["devops engineer", "SRE", "site reliability", "infrastructure engineer", "platform engineer"],
  "security": ["security engineer", "application security", "infosec", "cybersecurity engineer"],
};

function expandTitles(roleTitle: string): string[] {
  const lower = roleTitle.toLowerCase();
  for (const [key, expansions] of Object.entries(TITLE_EXPANSIONS)) {
    if (lower.includes(key)) return expansions;
  }
  return [roleTitle, `senior ${roleTitle}`, `staff ${roleTitle}`];
}

function mapSeniorityToApollo(level?: string): string[] {
  if (!level) return ["senior", "manager"];
  const lower = level.toLowerCase();
  if (lower === "junior" || lower === "mid") return ["entry", "senior"];
  if (lower === "senior") return ["senior", "manager"];
  if (lower === "staff") return ["senior", "manager", "director"];
  if (lower === "principal") return ["director", "vp"];
  return ["senior", "manager"];
}

const CACHE_TTL: Record<string, number> = {
  people_search: 7,
  company_info: 14,
  person_enrichment: 30,
  job_postings: 3,
};

async function getCached(key: string): Promise<unknown | null> {
  try {
    const cached = await prisma.enrichmentCache.findUnique({
      where: { cacheKey: key },
    });
    if (cached && cached.expiresAt > new Date()) {
      return cached.data;
    }
    if (cached) {
      await prisma.enrichmentCache.delete({ where: { cacheKey: key } }).catch(() => {});
    }
  } catch {
    /* miss */
  }
  return null;
}

async function setCache(key: string, type: string, data: unknown) {
  const ttlDays = CACHE_TTL[type] || 7;
  const expiresAt = new Date(Date.now() + ttlDays * 86400000);
  try {
    await prisma.enrichmentCache.upsert({
      where: { cacheKey: key },
      create: { cacheKey: key, cacheType: type, data: data as object, expiresAt },
      update: { data: data as object, expiresAt },
    });
  } catch {
    /* non-fatal */
  }
}

type PersonRow = {
  id: string;
  first_name: string;
  last_name: string;
  name: string;
  title: string;
  seniority: string;
  city: string;
  state: string;
  country: string;
  linkedin_url: string;
  headline: string;
  departments: string[];
};

function peopleCacheKey(companyDomain: string, roleLevel: string | null | undefined, roleTitle: string) {
  return `people_search:${companyDomain}:${roleLevel || "senior"}:${(roleTitle || "engineer").replace(/\s+/g, "_")}`;
}

async function loadJobContext(companyId: string) {
  const row = await prisma.mapCompany.findUnique({
    where: { id: companyId },
    include: {
      map: {
        include: { intake: true },
      },
    },
  });
  if (!row) return null;
  const intakeData = row.map.intake as unknown as Record<string, unknown> | null;
  return {
    mapId: row.mapId,
    companyId: row.id,
    companyDomain: row.companyDomain,
    companyName: row.companyName,
    roleTitle: row.map.roleTitle,
    roleLevel: row.map.roleLevel,
    roleStack: row.map.roleStack,
    geography: row.map.geography,
    intakeData,
  };
}

async function markFailed(companyId: string, message: string) {
  await prisma.mapCompany.update({
    where: { id: companyId },
    data: {
      enrichmentStatus: "failed",
      enrichmentSubstatus: null,
      enrichmentError: message.slice(0, 500),
    },
  });
}

/**
 * Runs exactly one phase of company enrichment (Hobby-safe: each phase stays under ~60s).
 */
export async function runEnrichmentPhase(companyId: string): Promise<void> {
  const apiKey = process.env.APOLLO_API_KEY;
  if (!apiKey) {
    await markFailed(companyId, "APOLLO_API_KEY not configured");
    return;
  }

  const ctx = await loadJobContext(companyId);
  if (!ctx) {
    return;
  }

  const co = await prisma.mapCompany.findUnique({
    where: { id: companyId },
    select: { enrichmentStatus: true, enrichmentSubstatus: true },
  });
  if (!co || co.enrichmentStatus !== "enriching" || !co.enrichmentSubstatus) {
    return;
  }

  const sub = co.enrichmentSubstatus;

  try {
    if (sub === "fetching_people") {
      const cacheKey = peopleCacheKey(ctx.companyDomain, ctx.roleLevel, ctx.roleTitle);
      const cached = await getCached(cacheKey);
      let people: PersonRow[] = [];
      if (cached) {
        people = cached as PersonRow[];
      } else {
        const titles = expandTitles(ctx.roleTitle || "engineer");
        const seniorities = mapSeniorityToApollo(ctx.roleLevel || undefined);
        const searchBody: Record<string, unknown> = {
          organization_domains: [ctx.companyDomain],
          person_titles: titles,
          person_seniorities: seniorities,
          per_page: 25,
        };
        if (ctx.geography?.length) {
          searchBody.person_locations = ctx.geography;
        }
        const res = await apolloFetch(`${APOLLO_API}/mixed_people/api_search`, {
          method: "POST",
          body: JSON.stringify(searchBody),
        }, { label: "people_search" });
        if (res.ok) {
          const data = await res.json();
          people = (data.people || []).map((p: Record<string, unknown>) => ({
            id: p.id || "",
            first_name: p.first_name || "",
            last_name: p.last_name || "",
            name: `${p.first_name || ""} ${p.last_name || ""}`.trim(),
            title: p.title || "",
            seniority: p.seniority || "",
            city: p.city || "",
            state: p.state || "",
            country: p.country || "",
            linkedin_url: p.linkedin_url || "",
            headline: p.headline || "",
            departments: (p.departments as string[]) || [],
          }));
          await setCache(cacheKey, "people_search", people);
        } else {
          const errBody = await res.text().catch(() => "");
          console.error(`[apollo] People search failed: ${res.status} for ${ctx.companyDomain}`, errBody.slice(0, 500));
        }
      }
      await prisma.mapCompany.update({
        where: { id: companyId },
        data: { enrichmentSubstatus: "updating_company" },
      });
      return;
    }

    if (sub === "updating_company") {
      const compCacheKey = `company_info:${ctx.companyDomain}`;
      let companyInfo: Record<string, unknown> | null = null;
      const cachedCompany = await getCached(compCacheKey);
      if (cachedCompany) {
        companyInfo = cachedCompany as Record<string, unknown>;
      } else {
        try {
          const orgRes = await apolloFetch(`${APOLLO_API}/organizations/enrich?domain=${ctx.companyDomain}`, {}, { label: "org_enrich" });
          if (orgRes.ok) {
            const orgData = await orgRes.json();
            companyInfo = orgData.organization || null;
            if (companyInfo) {
              await setCache(compCacheKey, "company_info", companyInfo);
            }
          }
        } catch {
          /* optional */
        }
      }

      const updateData: Record<string, unknown> = {};
      if (companyInfo) {
        updateData.headcount = (companyInfo.estimated_num_employees as number) || null;
        updateData.departmentalHeadcount = companyInfo.departmental_head_count || null;
        updateData.engHeadcount = Math.round(((companyInfo.estimated_num_employees as number) || 0) * 0.3) || null;
        updateData.hqCity = (companyInfo.city as string) || null;
        updateData.hqCountry = (companyInfo.country as string) || null;
        updateData.fundingStage = (companyInfo.latest_funding_stage as string) || null;
        updateData.fundingAmount = (companyInfo.total_funding as number)
          ? `$${Math.round((companyInfo.total_funding as number) / 1000000)}M`
          : null;
        updateData.techStack = (companyInfo.technologies as string[]) || [];
        updateData.apolloOrgId = (companyInfo.id as string) || null;
      }

      await prisma.mapCompany.update({
        where: { id: companyId },
        data: updateData,
      });

      const currentCompany = await prisma.mapCompany.findUnique({
        where: { id: companyId },
        select: {
          tier: true,
          tierOverride: true,
          tierReasoning: true,
          techStack: true,
          headcount: true,
          fundingStage: true,
          growthRate: true,
          hqCity: true,
          hqCountry: true,
        },
      });
      if (currentCompany && !currentCompany.tierOverride) {
        const { score, breakdown } = scoreTier(
          {
            techStack: currentCompany.techStack,
            headcount: currentCompany.headcount,
            fundingStage: currentCompany.fundingStage,
            growthRate: currentCompany.growthRate,
            hqCity: currentCompany.hqCity,
            hqCountry: currentCompany.hqCountry,
            tierReasoning: currentCompany.tierReasoning,
          },
          { roleStack: ctx.roleStack || [], roleLevel: ctx.roleLevel || null, geography: ctx.geography || [] }
        );
        const newTier = assignTier(score);
        await prisma.mapCompany.update({
          where: { id: companyId },
          data: { tier: newTier, tierScore: score, tierBreakdown: breakdown as object },
        });
      }

      await prisma.mapCompany.update({
        where: { id: companyId },
        data: { enrichmentSubstatus: "inserting_candidates" },
      });
      return;
    }

    if (sub === "inserting_candidates") {
      const cacheKey = peopleCacheKey(ctx.companyDomain, ctx.roleLevel, ctx.roleTitle);
      const cached = await getCached(cacheKey);
      const people = (cached || []) as PersonRow[];

      const existingCandidates = await prisma.mapCandidate.findMany({
        where: { companyId },
        select: { apolloPersonId: true },
      });
      const existingIds = new Set(existingCandidates.map((c) => c.apolloPersonId).filter(Boolean));
      const newPeople = people.filter((p) => !existingIds.has(p.id));

      await Promise.all(
        newPeople.map((p) =>
          prisma.mapCandidate.create({
            data: {
              mapId: ctx.mapId,
              companyId,
              apolloPersonId: p.id,
              name: p.name,
              firstName: p.first_name,
              lastName: p.last_name,
              title: p.title,
              seniority: p.seniority,
              city: p.city,
              state: p.state,
              country: p.country,
              linkedinUrl: p.linkedin_url,
              headline: p.headline,
              departments: p.departments,
            },
          })
        )
      );

      await prisma.mapCompany.update({
        where: { id: companyId },
        data: { enrichmentSubstatus: "backfilling_linkedin" },
      });
      return;
    }

    if (sub === "backfilling_linkedin") {
      const company = await prisma.mapCompany.findUnique({
        where: { id: companyId },
        select: { tier: true },
      });
      const missingLinkedin = await prisma.mapCandidate.findMany({
        where: { companyId, linkedinUrl: null, apolloPersonId: { not: null } },
        select: { id: true, apolloPersonId: true },
      });
      if (missingLinkedin.length > 0 && company?.tier === "A") {
        try {
          const matchRes = await apolloFetch(`${APOLLO_API}/people/bulk_match`, {
            method: "POST",
            body: JSON.stringify({
              reveal_personal_emails: false,
              reveal_phone_number: false,
              details: missingLinkedin.map((c) => ({ id: c.apolloPersonId })),
            }),
          }, { label: "linkedin_backfill" });
          if (matchRes.ok) {
            const matchData = await matchRes.json();
            const matches = matchData.matches || [];
            for (let i = 0; i < missingLinkedin.length; i++) {
              const linkedinUrl = matches[i]?.linkedin_url;
              if (linkedinUrl) {
                await prisma.mapCandidate.update({
                  where: { id: missingLinkedin[i].id },
                  data: { linkedinUrl },
                }).catch(() => {});
              }
            }
          }
        } catch (err) {
          console.warn("[enrich] LinkedIn backfill failed:", err);
        }
      }

      await prisma.mapCompany.update({
        where: { id: companyId },
        data: { enrichmentSubstatus: "enriching_news" },
      });
      return;
    }

    if (sub === "enriching_news") {
      const apolloRow = await prisma.mapCompany.findUnique({
        where: { id: companyId },
        select: { apolloOrgId: true, companyDomain: true, companyName: true },
      });
      if (apolloRow) {
        try {
          await runEnrichNewsCore({
            companyId,
            companyName: apolloRow.companyName,
            companyDomain: apolloRow.companyDomain,
            apolloOrgId: apolloRow.apolloOrgId,
          });
        } catch (err) {
          console.warn("[enrich] News enrichment failed:", err);
        }
      }
      await prisma.mapCompany.update({
        where: { id: companyId },
        data: { enrichmentSubstatus: "classifying" },
      });
      return;
    }

    if (sub === "classifying") {
      const newsRow = await prisma.mapCompany.findUnique({
        where: { id: companyId },
        select: { newsSummary: true, newsEvents: true },
      });
      const compCacheKey = `company_info:${ctx.companyDomain}`;
      const cachedOrg = await getCached(compCacheKey);
      const companyInfo = cachedOrg as Record<string, unknown> | null;

      const candidatesDb = await prisma.mapCandidate.findMany({
        where: { companyId },
        select: { id: true, name: true, title: true, seniority: true, city: true },
      });

      const events = (newsRow?.newsEvents as Array<{ event_type: string; severity: string; summary: string }>) || [];
      const hasRoleBrief = !!(ctx.roleTitle || (ctx.roleStack?.length ?? 0) > 0);

      if (candidatesDb.length > 0 && hasRoleBrief) {
        const intakeData = ctx.intakeData;
        const roleBrief: Record<string, unknown> = {
          title: ctx.roleTitle,
          level: ctx.roleLevel,
          stack: ctx.roleStack,
          geography: ctx.geography,
          ...(intakeData?.candidateProfile
            ? {
                must_haves: (intakeData.candidateProfile as Record<string, unknown>).mustHaves,
                nice_to_haves: (intakeData.candidateProfile as Record<string, unknown>).niceToHaves,
                years_experience: (intakeData.candidateProfile as Record<string, unknown>).yearsExperience,
                personality: (intakeData.candidateProfile as Record<string, unknown>).personality,
              }
            : {}),
          ...(intakeData?.redFlags
            ? {
                disqualifiers: (intakeData.redFlags as Record<string, unknown>).disqualifiers,
              }
            : {}),
          ...(intakeData?.roleBasics
            ? {
                description: (intakeData.roleBasics as Record<string, unknown>).responsibilities,
                team_size: (intakeData.roleBasics as Record<string, unknown>).teamSize,
                is_backfill: (intakeData.roleBasics as Record<string, unknown>).isBackfill,
              }
            : {}),
        };
        try {
          await runClassifyCore({
            mapId: ctx.mapId,
            companyId,
            roleBrief,
            candidates: candidatesDb.map((c) => ({
              id: c.id,
              name: c.name,
              title: c.title || "",
              seniority: c.seniority || "",
              city: c.city || undefined,
            })),
            companyNews: newsRow?.newsSummary || null,
            companyNewsEvents: events,
            companyGrowthRate: (companyInfo?.annual_revenue_printed as string) || null,
          });
        } catch (err) {
          console.warn("[enrich] Classification failed:", err);
        }
      }

      await prisma.mapCompany.update({
        where: { id: companyId },
        data: { enrichmentStatus: "complete", enrichmentSubstatus: null },
      });
      return;
    }

    // Unknown substatus (e.g. legacy "starting") — advance to a safe step
    if (sub === "starting") {
      await prisma.mapCompany.update({
        where: { id: companyId },
        data: { enrichmentSubstatus: "fetching_people" },
      });
      return;
    }

    await markFailed(companyId, `Unknown enrichment substatus: ${sub}`);
  } catch (error) {
    console.error(`[enrich-pipeline] Phase failed for ${companyId}:`, error);
    await markFailed(
      companyId,
      error instanceof Error ? error.message : "Unknown error"
    );
  }
}

/**
 * Pick the next company to process: resume in-flight, then oldest queued (claimed in a transaction).
 * When `onlyCompanyId` is set (local / single-request processing), only that row is claimed or resumed.
 */
export async function pickEnrichmentJob(
  pinnedId: string | null,
  onlyCompanyId?: string | null
): Promise<string | null> {
  if (onlyCompanyId) {
    if (pinnedId && pinnedId !== onlyCompanyId) pinnedId = null;

    const row = await prisma.mapCompany.findUnique({
      where: { id: onlyCompanyId },
      select: { enrichmentStatus: true, enrichmentSubstatus: true },
    });
    if (!row) return null;
    if (row.enrichmentStatus === "queued") {
      const u = await prisma.mapCompany.updateMany({
        where: { id: onlyCompanyId, enrichmentStatus: "queued" },
        data: {
          enrichmentStatus: "enriching",
          enrichmentSubstatus: "fetching_people",
          enrichmentError: null,
        },
      });
      return u.count ? onlyCompanyId : null;
    }
    if (row.enrichmentStatus === "enriching" && row.enrichmentSubstatus) {
      return onlyCompanyId;
    }
    return null;
  }

  if (pinnedId) {
    const still = await prisma.mapCompany.findFirst({
      where: {
        id: pinnedId,
        enrichmentStatus: "enriching",
        enrichmentSubstatus: { not: null },
      },
      select: { id: true },
    });
    if (still) return still.id;
  }

  const resume = await prisma.mapCompany.findFirst({
    where: {
      enrichmentStatus: "enriching",
      enrichmentSubstatus: { not: null },
      updatedAt: { gte: new Date(Date.now() - 10 * 60 * 1000) },
    },
    orderBy: { updatedAt: "asc" },
    select: { id: true },
  });
  if (resume) return resume.id;

  const claimed = await prisma.$transaction(async (tx) => {
    const q = await tx.mapCompany.findFirst({
      where: { enrichmentStatus: "queued" },
      orderBy: { updatedAt: "asc" },
      select: { id: true },
    });
    if (!q) return null;
    const u = await tx.mapCompany.updateMany({
      where: { id: q.id, enrichmentStatus: "queued" },
      data: {
        enrichmentStatus: "enriching",
        enrichmentSubstatus: "fetching_people",
        enrichmentError: null,
      },
    });
    return u.count ? q.id : null;
  });

  return claimed;
}

export async function hasPendingEnrichmentWork(): Promise<boolean> {
  const n = await prisma.mapCompany.count({
    where: {
      OR: [
        { enrichmentStatus: "queued" },
        {
          enrichmentStatus: "enriching",
          enrichmentSubstatus: { not: null },
        },
      ],
    },
  });
  return n > 0;
}

export function deploymentOrigin(): string {
  const base = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (base) return base;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

export function triggerEnrichmentProcessor(chainDepth = 0): void {
  const secret = process.env.CRON_SECRET;
  if (!secret) return;
  const url = `${deploymentOrigin()}/api/market-map/process-enrichment-jobs`;
  void fetch(url, {
    headers: {
      authorization: `Bearer ${secret}`,
      "x-gitscout-enrich-chain": String(chainDepth),
    },
  }).catch(() => {});
}

/**
 * One processor invocation (cron route, or inline after POST when CRON_SECRET is unset).
 * `onlyCompanyId` limits work to that company (avoids draining the whole queue from one browser request).
 */
export async function runEnrichmentProcessorSweep(
  chainDepth: number,
  allowSelfChain: boolean,
  onlyCompanyId?: string | null
): Promise<{
  phasesRun: number;
  pending: boolean;
}> {
  // Single-company (browser) requests: no time cap here — Vercel Hobby still hard-limits ~60s for the route.
  // Global / cron sweeps: stay under one invocation budget and optionally chain.
  const useWallDeadline = !onlyCompanyId;
  const deadline = Date.now() + 52_000;
  const maxPhases = onlyCompanyId ? 16 : 24;
  let pinned: string | null = onlyCompanyId ?? null;
  let phases = 0;

  while ((useWallDeadline ? Date.now() < deadline : true) && phases < maxPhases) {
    const id = await pickEnrichmentJob(pinned, onlyCompanyId);
    if (!id) break;

    await runEnrichmentPhase(id);
    phases++;

    const s = await prisma.mapCompany.findUnique({
      where: { id },
      select: { enrichmentStatus: true, enrichmentSubstatus: true },
    });
    if (s?.enrichmentStatus === "complete" || s?.enrichmentStatus === "failed") {
      pinned = onlyCompanyId ?? null;
      continue;
    }
    if (s?.enrichmentStatus === "enriching" && s.enrichmentSubstatus) {
      pinned = id;
      continue;
    }
    pinned = onlyCompanyId ?? null;
  }

  const pending = onlyCompanyId
    ? false
    : await hasPendingEnrichmentWork();
  if (pending && allowSelfChain && chainDepth < 15) {
    triggerEnrichmentProcessor(chainDepth + 1);
  }

  return { phasesRun: phases, pending };
}
