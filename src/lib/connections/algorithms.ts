import { prisma } from "@/lib/prisma";
import type { ApolloPerson } from "./apollo";
import { fetchTargetPersonRepos } from "./github";

export interface DetectedConnection {
  connectionType: string;
  strength: "strong" | "medium" | "weak";
  homePersonId: string | null;
  homePersonName: string | null;
  homePersonTitle: string | null;
  targetPersonName: string | null;
  targetPersonTitle: string | null;
  targetPersonApolloId: string | null;
  detail: Record<string, unknown>;
}

// ─── Algorithm 1: Former Employee Overlap ───

interface EmploymentEntry {
  company_name?: string | null;
  company_domain?: string | null;
  organization_name?: string | null;
  title?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  is_current?: boolean;
  current?: boolean;
}

function parseDate(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
}

function extractYear(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const match = dateStr.match(/(\d{4})/);
  return match ? parseInt(match[1]) : null;
}

function computeOverlapMonths(
  startA: string | null | undefined,
  endA: string | null | undefined,
  startB: string | null | undefined,
  endB: string | null | undefined
): number {
  const sA = parseDate(startA);
  const eA = parseDate(endA) || new Date();
  const sB = parseDate(startB);
  const eB = parseDate(endB) || new Date();

  if (!sA || !sB) {
    // Fall back to year-level comparison
    const yStartA = extractYear(startA);
    const yEndA = extractYear(endA) || new Date().getFullYear();
    const yStartB = extractYear(startB);
    const yEndB = extractYear(endB) || new Date().getFullYear();

    if (yStartA === null || yStartB === null) return 0;

    const overlapStart = Math.max(yStartA, yStartB);
    const overlapEnd = Math.min(yEndA, yEndB);
    if (overlapStart > overlapEnd) return 0;
    return (overlapEnd - overlapStart + 1) * 12; // approximate
  }

  const overlapStart = sA > sB ? sA : sB;
  const overlapEnd = eA < eB ? eA : eB;

  if (overlapStart >= overlapEnd) return 0;
  return Math.round(
    (overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60 * 24 * 30)
  );
}

function datesOverlap(
  startA: string | null | undefined,
  endA: string | null | undefined,
  startB: string | null | undefined,
  endB: string | null | undefined
): boolean {
  return computeOverlapMonths(startA, endA, startB, endB) > 0;
}

function normalizeDomain(input: string | null | undefined): string {
  if (!input) return "";
  return input
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "")
    .trim();
}

function strengthFromOverlap(months: number): "strong" | "medium" | "weak" {
  if (months > 12) return "strong";
  if (months >= 6) return "medium";
  return "weak";
}

export async function detectFormerEmployeeOverlap(
  homeBaseId: string,
  targetDomain: string,
  targetPeople: ApolloPerson[]
): Promise<DetectedConnection[]> {
  const connections: DetectedConnection[] = [];
  const normalizedTarget = normalizeDomain(targetDomain);

  // Get home base people with employment history
  const homePeople = await prisma.homeBasePerson.findMany({
    where: { homeBaseId },
    select: {
      id: true,
      name: true,
      title: true,
      employmentHistory: true,
    },
  });

  // Check 1: Home person previously worked at the target company
  for (const hp of homePeople) {
    const history = (hp.employmentHistory as EmploymentEntry[]) || [];
    for (const entry of history) {
      const entryDomain = normalizeDomain(
        entry.company_domain || entry.organization_name
      );
      if (!entryDomain) continue;

      // Check if this employment entry matches the target domain
      if (
        entryDomain === normalizedTarget ||
        entryDomain.includes(normalizedTarget.split(".")[0])
      ) {
        const months = computeOverlapMonths(
          entry.start_date,
          entry.end_date,
          null,
          null
        );
        connections.push({
          connectionType: "former_employee",
          strength: months > 0 ? strengthFromOverlap(months) : "medium",
          homePersonId: hp.id,
          homePersonName: hp.name,
          homePersonTitle: hp.title,
          targetPersonName: null,
          targetPersonTitle: null,
          targetPersonApolloId: null,
          detail: {
            direction: "home_to_target",
            overlapping_company: targetDomain,
            role_at_overlap: entry.title,
            overlap_start: entry.start_date,
            overlap_end: entry.end_date,
          },
        });
      }
    }
  }

  // Check 2: Target person previously worked at the home base company
  const homeBase = await prisma.connectionHomeBase.findUnique({
    where: { id: homeBaseId },
    select: { companyDomain: true },
  });
  const homeDomain = normalizeDomain(homeBase?.companyDomain);

  for (const tp of targetPeople) {
    for (const entry of tp.employment_history) {
      const entryDomain = normalizeDomain(
        entry.organization_name
      );
      if (!entryDomain) continue;

      if (
        entryDomain === homeDomain ||
        entryDomain.includes(homeDomain.split(".")[0])
      ) {
        connections.push({
          connectionType: "former_employee",
          strength: "strong",
          homePersonId: null,
          homePersonName: null,
          homePersonTitle: null,
          targetPersonName: tp.name,
          targetPersonTitle: tp.title,
          targetPersonApolloId: tp.id,
          detail: {
            direction: "target_to_home",
            overlapping_company: homeBase?.companyDomain,
            role_at_overlap: entry.title,
            overlap_start: entry.start_date,
            overlap_end: entry.end_date,
          },
        });
      }
    }
  }

  // Check 3: Third-company overlap (both worked at same third company at same time)
  for (const hp of homePeople) {
    const hpHistory = (hp.employmentHistory as EmploymentEntry[]) || [];
    for (const tp of targetPeople) {
      for (const hEntry of hpHistory) {
        const hCompany = normalizeDomain(
          hEntry.company_domain || hEntry.organization_name
        );
        if (!hCompany || hCompany === normalizedTarget || hCompany === homeDomain) continue;

        for (const tEntry of tp.employment_history) {
          const tCompany = normalizeDomain(tEntry.organization_name);
          if (!tCompany) continue;

          // Check if they worked at the same third company
          if (
            hCompany === tCompany ||
            hCompany.split(".")[0] === tCompany.split(".")[0]
          ) {
            // Check date overlap
            if (
              datesOverlap(
                hEntry.start_date,
                hEntry.end_date,
                tEntry.start_date,
                tEntry.end_date
              )
            ) {
              const months = computeOverlapMonths(
                hEntry.start_date,
                hEntry.end_date,
                tEntry.start_date,
                tEntry.end_date
              );

              // Deduplicate: check if we already have this connection
              const key = `${hp.id}-${tp.id}-${hCompany}`;
              const exists = connections.some(
                (c) =>
                  c.homePersonId === hp.id &&
                  c.targetPersonApolloId === tp.id &&
                  (c.detail.overlapping_company as string)?.includes(
                    hCompany.split(".")[0]
                  )
              );
              if (exists) continue;

              connections.push({
                connectionType: "former_employee",
                strength: strengthFromOverlap(months),
                homePersonId: hp.id,
                homePersonName: hp.name,
                homePersonTitle: hp.title,
                targetPersonName: tp.name,
                targetPersonTitle: tp.title,
                targetPersonApolloId: tp.id,
                detail: {
                  direction: "third_company",
                  overlapping_company:
                    hEntry.company_domain || hEntry.organization_name,
                  role_at_overlap: hEntry.title,
                  overlap_start: hEntry.start_date,
                  overlap_end: hEntry.end_date,
                  overlap_months: months,
                },
              });
            }
          }
        }
      }
    }
  }

  return connections;
}

// ─── Algorithm 2: Shared Investor Overlap ───

// Normalize investor name for fuzzy matching
function normalizeInvestorName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+(ventures|capital|partners|fund|management|group|investments|llc|inc|corp)$/gi, "")
    .replace(/[.,]/g, "")
    .trim();
}

export function detectSharedInvestors(
  homeInvestors: string[],
  targetInvestors: string[],
  targetFundingEvents?: Array<{ investor_names: string[]; round: string | null }>
): DetectedConnection[] {
  const connections: DetectedConnection[] = [];

  const normalizedHome = homeInvestors.map((i) => ({
    original: i,
    normalized: normalizeInvestorName(i),
  }));
  const normalizedTarget = targetInvestors.map((i) => ({
    original: i,
    normalized: normalizeInvestorName(i),
  }));

  for (const h of normalizedHome) {
    for (const t of normalizedTarget) {
      if (
        h.normalized === t.normalized ||
        h.normalized.includes(t.normalized) ||
        t.normalized.includes(h.normalized)
      ) {
        // Find round info
        let targetRound: string | null = null;
        if (targetFundingEvents) {
          for (const event of targetFundingEvents) {
            if (event.investor_names?.some((n) => normalizeInvestorName(n) === t.normalized)) {
              targetRound = event.round;
              break;
            }
          }
        }

        connections.push({
          connectionType: "shared_investor",
          strength: "medium",
          homePersonId: null,
          homePersonName: null,
          homePersonTitle: null,
          targetPersonName: null,
          targetPersonTitle: null,
          targetPersonApolloId: null,
          detail: {
            investor_name: h.original,
            home_round: null, // Could be enriched
            target_round: targetRound,
          },
        });
        break; // Don't double-count same investor
      }
    }
  }

  return connections;
}

// ─── Algorithm 3: Shared Education ───

// Normalize school names for matching
const SCHOOL_ALIASES: Record<string, string> = {
  stanford: "stanford university",
  mit: "massachusetts institute of technology",
  "mass inst of tech": "massachusetts institute of technology",
  caltech: "california institute of technology",
  "cal tech": "california institute of technology",
  cmu: "carnegie mellon university",
  "carnegie mellon": "carnegie mellon university",
  berkeley: "university of california berkeley",
  "uc berkeley": "university of california berkeley",
  ucla: "university of california los angeles",
  "uc la": "university of california los angeles",
  harvard: "harvard university",
  yale: "yale university",
  princeton: "princeton university",
  columbia: "columbia university",
  cornell: "cornell university",
  penn: "university of pennsylvania",
  upenn: "university of pennsylvania",
  nyu: "new york university",
  usc: "university of southern california",
  gatech: "georgia institute of technology",
  "georgia tech": "georgia institute of technology",
  uiuc: "university of illinois urbana champaign",
  "u of i": "university of illinois urbana champaign",
  umich: "university of michigan",
  uw: "university of washington",
  utaustin: "university of texas austin",
  "ut austin": "university of texas austin",
  waterloo: "university of waterloo",
  oxford: "university of oxford",
  cambridge: "university of cambridge",
  eth: "eth zurich",
  iit: "indian institute of technology",
  nus: "national university of singapore",
};

function normalizeSchoolName(name: string | null | undefined): string {
  if (!name) return "";
  const lower = name.toLowerCase().replace(/[.,]/g, "").trim();
  return SCHOOL_ALIASES[lower] || lower;
}

interface EducationEntry {
  school_name?: string | null;
  degree?: string | null;
  field?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  start_year?: number | null;
  end_year?: number | null;
}

function educationYearsOverlap(a: EducationEntry, b: EducationEntry): boolean {
  const aStart = a.start_year || extractYear(a.start_date);
  const aEnd = a.end_year || extractYear(a.end_date);
  const bStart = b.start_year || extractYear(b.start_date);
  const bEnd = b.end_year || extractYear(b.end_date);

  if (aStart === null || bStart === null) return false;
  const aEndActual = aEnd || aStart + 4; // assume 4 years if no end
  const bEndActual = bEnd || bStart + 4;

  return aStart <= bEndActual && bStart <= aEndActual;
}

export async function detectSharedEducation(
  homeBaseId: string,
  targetPeople: ApolloPerson[]
): Promise<DetectedConnection[]> {
  const connections: DetectedConnection[] = [];

  const homePeople = await prisma.homeBasePerson.findMany({
    where: { homeBaseId },
    select: { id: true, name: true, title: true, education: true },
  });

  for (const hp of homePeople) {
    const hpEdu = (hp.education as EducationEntry[]) || [];
    if (hpEdu.length === 0) continue;

    for (const tp of targetPeople) {
      if (tp.education.length === 0) continue;

      for (const hSchool of hpEdu) {
        const hNorm = normalizeSchoolName(hSchool.school_name);
        if (!hNorm) continue;

        for (const tSchool of tp.education) {
          const tNorm = normalizeSchoolName(tSchool.school_name);
          if (!tNorm) continue;

          if (hNorm === tNorm || hNorm.includes(tNorm) || tNorm.includes(hNorm)) {
            const overlap = educationYearsOverlap(hSchool, tSchool);

            connections.push({
              connectionType: "shared_education",
              strength: overlap ? "medium" : "weak",
              homePersonId: hp.id,
              homePersonName: hp.name,
              homePersonTitle: hp.title,
              targetPersonName: tp.name,
              targetPersonTitle: tp.title,
              targetPersonApolloId: tp.id,
              detail: {
                school_name: hSchool.school_name || tSchool.school_name,
                home_degree: [hSchool.degree, hSchool.field]
                  .filter(Boolean)
                  .join(" "),
                target_degree: [tSchool.degree, tSchool.field]
                  .filter(Boolean)
                  .join(" "),
                years_overlap: overlap,
              },
            });
            break; // One connection per school per pair
          }
        }
      }
    }
  }

  return connections;
}

// ─── Algorithm 4: GitHub / OSS Overlap ───

export async function detectGithubOverlap(
  homeBaseId: string,
  targetPeople: ApolloPerson[]
): Promise<DetectedConnection[]> {
  const connections: DetectedConnection[] = [];

  // Get all home base GitHub repos
  const homeRepos = await prisma.homeBaseGithubRepo.findMany({
    where: { homeBaseId },
    include: { person: { select: { id: true, name: true, title: true } } },
  });

  if (homeRepos.length === 0) return connections;

  // Build a map of repo -> home base contributors
  const repoMap = new Map<
    string,
    Array<{
      personId: string;
      personName: string;
      personTitle: string | null;
      username: string;
      count: number;
    }>
  >();

  for (const repo of homeRepos) {
    const list = repoMap.get(repo.repoFullName) || [];
    list.push({
      personId: repo.person.id,
      personName: repo.person.name,
      personTitle: repo.person.title,
      username: repo.githubUsername,
      count: repo.contributionCount,
    });
    repoMap.set(repo.repoFullName, list);
  }

  // For each target engineer with a GitHub profile, check for repo overlap
  for (const tp of targetPeople) {
    // We need GitHub username for target person - check from Apollo employment
    // For now, skip if no GitHub profile info available
    // This would be enhanced by doing GitHub matching on target people too
    // For MVP, we check if any target person has github info in their data
    // (In practice, this would be improved in a later pass)
  }

  return connections;
}

// ─── Algorithm 5: LinkedIn Import Cross-Reference ───

export async function detectLinkedinConnections(
  userId: string,
  targetCompanyName: string,
  targetCompanyDomain: string
): Promise<DetectedConnection[]> {
  const connections: DetectedConnection[] = [];

  const imports = await prisma.linkedinImport.findMany({
    where: { userId },
  });

  if (imports.length === 0) return connections;

  const normalizedTarget = targetCompanyName.toLowerCase();
  const normalizedDomain = targetCompanyDomain.toLowerCase().split(".")[0];

  for (const li of imports) {
    const company = (li.connectionCompany || "").toLowerCase();
    if (
      company.includes(normalizedTarget) ||
      normalizedTarget.includes(company) ||
      company.includes(normalizedDomain)
    ) {
      connections.push({
        connectionType: "linkedin_import",
        strength: "strong",
        homePersonId: null,
        homePersonName: null,
        homePersonTitle: null,
        targetPersonName: li.connectionName,
        targetPersonTitle: li.connectionTitle,
        targetPersonApolloId: null,
        detail: {
          connection_degree: 1,
          imported_at: li.importedAt.toISOString(),
        },
      });
    }
  }

  return connections;
}
