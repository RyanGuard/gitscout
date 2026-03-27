import { getCached, setCache } from "./cache";

const APOLLO_API = "https://api.apollo.io/v1";

function getApiKey(): string {
  const key = process.env.APOLLO_API_KEY;
  if (!key) throw new Error("APOLLO_API_KEY not configured");
  return key;
}

export interface ApolloPerson {
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
  employment_history: Array<{
    organization_name: string | null;
    organization_id: string | null;
    title: string | null;
    current: boolean;
    start_date: string | null;
    end_date: string | null;
  }>;
  education: Array<{
    school_name: string | null;
    degree: string | null;
    field: string | null;
    start_date: string | null;
    end_date: string | null;
  }>;
}

export interface ApolloOrganization {
  id: string;
  name: string;
  website_url: string;
  domain: string;
  estimated_num_employees: number | null;
  industry: string | null;
  city: string | null;
  country: string | null;
  latest_funding_stage: string | null;
  total_funding: number | null;
  funding_events: Array<{
    investor_names: string[];
    round: string | null;
  }>;
}

/**
 * Enrich an organization by domain. Returns company info including investors.
 */
export async function enrichOrganization(
  domain: string
): Promise<ApolloOrganization | null> {
  const cacheKey = `company_info:${domain}`;
  const cached = await getCached<ApolloOrganization>(cacheKey);
  if (cached) return cached;

  const apiKey = getApiKey();
  const res = await fetch(
    `${APOLLO_API}/organizations/enrich?api_key=${apiKey}&domain=${domain}`
  );

  if (!res.ok) {
    console.error(`[apollo] Org enrichment failed: ${res.status} for ${domain}`);
    return null;
  }

  const data = await res.json();
  const org = data.organization;
  if (!org) return null;

  await setCache(cacheKey, "company_info", org);
  return org;
}

/**
 * Extract investor names from Apollo org data.
 */
export function extractInvestors(org: ApolloOrganization): string[] {
  if (!org.funding_events) return [];
  const investors = new Set<string>();
  for (const event of org.funding_events) {
    if (event.investor_names) {
      for (const name of event.investor_names) {
        if (name) investors.add(name);
      }
    }
  }
  return Array.from(investors);
}

/**
 * Search for people at a company using Apollo People API Search (FREE — no credits).
 * Paginates through results up to maxPages.
 */
export async function searchPeopleAtCompany(
  domain: string,
  options: {
    perPage?: number;
    maxPages?: number;
    departments?: string[];
    titles?: string[];
    seniorities?: string[];
  } = {}
): Promise<ApolloPerson[]> {
  const { perPage = 100, maxPages = 2 } = options;
  const cacheKey = `people_search_full:${domain}`;
  const cached = await getCached<ApolloPerson[]>(cacheKey);
  if (cached) return cached;

  const apiKey = getApiKey();
  const allPeople: ApolloPerson[] = [];

  for (let page = 1; page <= maxPages; page++) {
    const searchBody: Record<string, unknown> = {
      api_key: apiKey,
      organization_domains: [domain],
      per_page: perPage,
      page,
    };

    if (options.departments?.length) {
      searchBody.person_departments = options.departments;
    }
    if (options.titles?.length) {
      searchBody.person_titles = options.titles;
    }
    if (options.seniorities?.length) {
      searchBody.person_seniorities = options.seniorities;
    }

    const res = await fetch(`${APOLLO_API}/mixed_people/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(searchBody),
    });

    if (!res.ok) {
      console.error(
        `[apollo] People search failed: ${res.status} for ${domain} page ${page}`
      );
      break;
    }

    const data = await res.json();
    const people = (data.people || []).map(mapApolloPerson);
    allPeople.push(...people);

    // Stop if we got fewer than a full page
    if (people.length < perPage) break;
  }

  if (allPeople.length > 0) {
    await setCache(cacheKey, "people_search", allPeople);
  }

  return allPeople;
}

function mapApolloPerson(p: Record<string, unknown>): ApolloPerson {
  return {
    id: (p.id as string) || "",
    first_name: (p.first_name as string) || "",
    last_name: (p.last_name as string) || "",
    name: `${p.first_name || ""} ${p.last_name || ""}`.trim(),
    title: (p.title as string) || "",
    seniority: (p.seniority as string) || "",
    city: (p.city as string) || "",
    state: (p.state as string) || "",
    country: (p.country as string) || "",
    linkedin_url: (p.linkedin_url as string) || "",
    headline: (p.headline as string) || "",
    departments: (p.departments as string[]) || [],
    employment_history: (
      (p.employment_history as Array<Record<string, unknown>>) || []
    ).map((e) => ({
      organization_name: (e.organization_name as string) || null,
      organization_id: (e.organization_id as string) || null,
      title: (e.title as string) || null,
      current: (e.current as boolean) || false,
      start_date: (e.start_date as string) || null,
      end_date: (e.end_date as string) || null,
    })),
    education: ((p.education as Array<Record<string, unknown>>) || []).map(
      (e) => ({
        school_name: (e.school_name as string) || null,
        degree: (e.degree as string) || null,
        field: (e.field_of_study as string) || (e.field as string) || null,
        start_date: (e.start_date as string) || null,
        end_date: (e.end_date as string) || null,
      })
    ),
  };
}

/**
 * Check if a person is likely an engineer based on department/title keywords.
 */
export function isEngineeringRole(person: ApolloPerson): boolean {
  const engDepartments = [
    "engineering",
    "product",
    "technology",
    "it",
    "data",
    "research",
  ];
  const engTitleKeywords = [
    "engineer",
    "developer",
    "architect",
    "sre",
    "devops",
    "cto",
    "vp engineering",
    "head of engineering",
    "tech lead",
    "software",
    "data scientist",
    "ml ",
    "machine learning",
    "platform",
    "infrastructure",
    "security",
    "devsecops",
    "full stack",
    "fullstack",
    "frontend",
    "backend",
    "mobile",
    "ios",
    "android",
  ];

  const deptMatch = person.departments.some((d) =>
    engDepartments.includes(d.toLowerCase())
  );
  const titleMatch = engTitleKeywords.some((kw) =>
    (person.title || "").toLowerCase().includes(kw)
  );

  return deptMatch || titleMatch;
}
