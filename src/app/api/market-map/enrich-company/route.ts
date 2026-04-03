import { getAuthUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { scoreTier, assignTier } from "@/lib/map/tierScoring";
import { apolloFetch } from "@/lib/apollo-fetch";
import { safeErrorMessage } from "@/lib/api-error";

// Apollo + org enrich + candidates + internal news (Claude) + classify often exceeds 60s.
// Vercel Pro: up to 300s. Hobby is capped at 60 — upgrade or trim the pipeline.
export const maxDuration = 300;

const APOLLO_API = "https://api.apollo.io/api/v1";

// Title variations for broader matching
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
  // Default: use the title as-is plus common variations
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

// Cache TTLs in days
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
    // Expired — delete
    if (cached) {
      await prisma.enrichmentCache.delete({ where: { cacheKey: key } }).catch(() => {});
    }
  } catch {
    // Cache miss
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
    // Cache write failure is non-fatal
  }
}

export async function POST(request: Request) {
  const userId = await getAuthUserId(request);
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const { map_id, company_id, company_domain, role_title, role_level, role_stack, geography } = body;

  if (!map_id || !company_id || !company_domain) {
    return Response.json({ error: "map_id, company_id, company_domain required" }, { status: 400 });
  }

  const companyRow = await prisma.mapCompany.findFirst({
    where: { id: company_id, mapId: map_id, map: { userId } },
    select: { id: true, companyDomain: true },
  });
  if (!companyRow) {
    return Response.json({ error: "Company not found" }, { status: 404 });
  }
  if (String(company_domain).toLowerCase() !== companyRow.companyDomain.toLowerCase()) {
    return Response.json({ error: "company_domain does not match this record" }, { status: 400 });
  }

  // Look up intake data for enriched classification
  let intakeData: Record<string, unknown> | null = null;
  try {
    const mapWithIntake = await prisma.marketMap.findFirst({
      where: { id: map_id, userId },
      include: { intake: true },
    });
    intakeData = mapWithIntake?.intake as unknown as Record<string, unknown> | null;
  } catch { /* intake lookup is optional */ }

  const apiKey = process.env.APOLLO_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "APOLLO_API_KEY not configured" }, { status: 500 });
  }

  try {
    // Atomic lock — prevent double-enrichment
    const lockResult = await prisma.mapCompany.updateMany({
      where: { id: company_id, enrichmentStatus: { notIn: ["enriching"] } },
      data: { enrichmentStatus: "enriching", enrichmentSubstatus: "starting", enrichmentError: null },
    });
    if (lockResult.count === 0) {
      return Response.json({ status: "already_enriching" }, { status: 200 });
    }

    await prisma.mapCompany.update({
      where: { id: company_id },
      data: { enrichmentSubstatus: "fetching_people" },
    });

    // Check cache
    const cacheKey = `people_search:${company_domain}:${role_level || "senior"}:${(role_title || "engineer").replace(/\s+/g, "_")}`;
    const cached = await getCached(cacheKey);

    let people: Array<{
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
    }> = [];

    if (cached) {
      people = cached as typeof people;
    } else {
      // Call Apollo People API Search (free — no credits consumed)
      const titles = expandTitles(role_title || "engineer");
      const seniorities = mapSeniorityToApollo(role_level);

      const searchBody: Record<string, unknown> = {
        organization_domains: [company_domain],
        person_titles: titles,
        person_seniorities: seniorities,
        per_page: 25,
      };

      // Add location filter if provided
      if (geography && geography.length > 0) {
        searchBody.person_locations = geography;
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

        // Cache the results
        await setCache(cacheKey, "people_search", people);
      } else {
        const errBody = await res.text().catch(() => "");
        console.error(`[apollo] People search failed: ${res.status} for ${company_domain}`, errBody.slice(0, 500));
      }
    }

    // Try to get company info from Apollo
    let companyInfo: Record<string, unknown> | null = null;
    const compCacheKey = `company_info:${company_domain}`;
    const cachedCompany = await getCached(compCacheKey);

    if (cachedCompany) {
      companyInfo = cachedCompany as Record<string, unknown>;
    } else {
      try {
        const orgRes = await apolloFetch(`${APOLLO_API}/organizations/enrich?domain=${company_domain}`, {}, { label: "org_enrich" });
        if (orgRes.ok) {
          const orgData = await orgRes.json();
          companyInfo = orgData.organization || null;
          if (companyInfo) {
            await setCache(compCacheKey, "company_info", companyInfo);
          }
        }
      } catch {
        // Company enrichment is optional
      }
    }

    await prisma.mapCompany.update({
      where: { id: company_id },
      data: { enrichmentSubstatus: "updating_company" },
    }).catch(() => {});

    // Update company with enriched info (keep enriching — mark complete after candidates)
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
      where: { id: company_id },
      data: updateData,
    });

    // Post-enrichment tier refinement — re-score with structured data
    const currentCompany = await prisma.mapCompany.findUnique({
      where: { id: company_id },
      select: { tier: true, tierOverride: true, tierReasoning: true, techStack: true, headcount: true, fundingStage: true, growthRate: true, hqCity: true, hqCountry: true },
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
        { roleStack: role_stack || [], roleLevel: role_level || null, geography: geography || [] }
      );
      const newTier = assignTier(score);
      await prisma.mapCompany.update({
        where: { id: company_id },
        data: { tier: newTier, tierScore: score, tierBreakdown: breakdown as object },
      });
    }

    await prisma.mapCompany.update({
      where: { id: company_id },
      data: { enrichmentSubstatus: "inserting_candidates" },
    }).catch(() => {});

    // Deduplicate: check for existing candidates
    const existingCandidates = await prisma.mapCandidate.findMany({
      where: { companyId: company_id },
      select: { apolloPersonId: true },
    });
    const existingIds = new Set(existingCandidates.map(c => c.apolloPersonId).filter(Boolean));
    const newPeople = people.filter(p => !existingIds.has(p.id));

    // Insert candidates
    const candidates = await Promise.all(
      newPeople.map((p) =>
        prisma.mapCandidate.create({
          data: {
            mapId: map_id,
            companyId: company_id,
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

    // Mark enrichment complete after candidates inserted
    await prisma.mapCompany.update({
      where: { id: company_id },
      data: { enrichmentStatus: "complete", enrichmentSubstatus: null },
    });

    // Backfill missing LinkedIn URLs via Apollo person match — Tier A only (credits)
    await prisma.mapCompany.update({ where: { id: company_id }, data: { enrichmentSubstatus: "backfilling_linkedin" } }).catch(() => {});
    const company = await prisma.mapCompany.findUnique({ where: { id: company_id }, select: { tier: true } });
    const missingLinkedin = candidates.filter(c => !c.linkedinUrl && c.apolloPersonId);
    if (missingLinkedin.length > 0 && apiKey && company?.tier === "A") {
      try {
        const matchRes = await apolloFetch(`${APOLLO_API}/people/bulk_match`, {
          method: "POST",
          body: JSON.stringify({
            reveal_personal_emails: false,
            reveal_phone_number: false,
            details: missingLinkedin.map(c => ({ id: c.apolloPersonId })),
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

    // Chain: fetch news for this company (non-blocking — best effort)
    await prisma.mapCompany.update({ where: { id: company_id }, data: { enrichmentSubstatus: "enriching_news" } }).catch(() => {});
    let newsResult: { events?: object[]; flightRisk?: string; summary?: string } = {};
    const baseUrl = request.url.replace(/\/api\/market-map\/enrich-company.*/, "");
    const internalHeaders: Record<string, string> = { "Content-Type": "application/json" };
    const cookieHeader = request.headers.get("cookie");
    if (cookieHeader) internalHeaders.cookie = cookieHeader;
    const evalKeyHeader = request.headers.get("x-eval-api-key");
    if (evalKeyHeader) internalHeaders["x-eval-api-key"] = evalKeyHeader;

    try {
      const newsRes = await fetch(`${baseUrl}/api/market-map/enrich-news`, {
        method: "POST",
        headers: internalHeaders,
        body: JSON.stringify({
          map_id,
          company_id,
          company_name: body.company_name || company_domain.split(".")[0],
        }),
      });
      if (newsRes.ok) {
        newsResult = await newsRes.json();
      }
    } catch (err) {
      console.warn("[enrich] News enrichment failed:", err);
    }

    // Chain: auto-classify candidates if we have a role brief
    await prisma.mapCompany.update({ where: { id: company_id }, data: { enrichmentSubstatus: "classifying" } }).catch(() => {});
    let classifyResult: { classified?: number; highRisk?: number } = {};
    if (candidates.length > 0 && (role_title || role_stack?.length)) {
      try {
        const classifyRes = await fetch(`${baseUrl}/api/market-map/classify`, {
          method: "POST",
          headers: internalHeaders,
          body: JSON.stringify({
            map_id,
            company_id,
            role_brief: {
              title: role_title,
              level: role_level,
              stack: role_stack,
              geography,
              ...(intakeData?.candidateProfile ? {
                must_haves: (intakeData.candidateProfile as Record<string, unknown>).mustHaves,
                nice_to_haves: (intakeData.candidateProfile as Record<string, unknown>).niceToHaves,
                years_experience: (intakeData.candidateProfile as Record<string, unknown>).yearsExperience,
                personality: (intakeData.candidateProfile as Record<string, unknown>).personality,
              } : {}),
              ...(intakeData?.redFlags ? {
                disqualifiers: (intakeData.redFlags as Record<string, unknown>).disqualifiers,
              } : {}),
              ...(intakeData?.roleBasics ? {
                description: (intakeData.roleBasics as Record<string, unknown>).responsibilities,
                team_size: (intakeData.roleBasics as Record<string, unknown>).teamSize,
                is_backfill: (intakeData.roleBasics as Record<string, unknown>).isBackfill,
              } : {}),
            },
            candidates: candidates.map((c) => ({
              id: c.id,
              name: c.name,
              title: c.title,
              seniority: c.seniority,
              city: c.city,
            })),
            company_news: newsResult.summary || null,
            company_news_events: newsResult.events || [],
            company_growth_rate: companyInfo?.annual_revenue_printed || null,
          }),
        });
        if (classifyRes.ok) {
          classifyResult = await classifyRes.json();
        }
      } catch (err) {
        console.warn("[enrich] Classification failed:", err);
      }
    }

    // Clear substatus after all chains complete
    await prisma.mapCompany.update({ where: { id: company_id }, data: { enrichmentSubstatus: null } }).catch(() => {});

    return Response.json({
      companyId: company_id,
      candidatesFound: candidates.length,
      candidatesClassified: classifyResult.classified || 0,
      highFlightRisk: classifyResult.highRisk || 0,
      companyFlightRisk: newsResult.flightRisk || "low",
      companyInfo: companyInfo
        ? {
            headcount: updateData.headcount,
            engHeadcount: updateData.engHeadcount,
            hqCity: updateData.hqCity,
            fundingStage: updateData.fundingStage,
            fundingAmount: updateData.fundingAmount,
          }
        : null,
    });
  } catch (error) {
    console.error(`[market-map] Enrichment failed for ${company_domain}:`, error);
    await prisma.mapCompany.update({
      where: { id: company_id },
      data: {
        enrichmentStatus: "failed",
        enrichmentSubstatus: null,
        enrichmentError: error instanceof Error ? error.message.slice(0, 500) : "Unknown error",
      },
    }).catch(() => {});
    return Response.json(
      { error: safeErrorMessage(error, "Enrichment failed") },
      { status: 500 }
    );
  }
}
