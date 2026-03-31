import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

const APOLLO_API = "https://api.apollo.io/api/v1";

interface ApolloPerson {
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
}

/**
 * POST /api/company/explore
 * Takes a company domain, fetches org info + people from Apollo,
 * returns structured org data grouped by department and seniority.
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { domain } = body;

  if (!domain) {
    return NextResponse.json({ error: "domain required" }, { status: 400 });
  }

  const apiKey = process.env.APOLLO_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "APOLLO_API_KEY not configured" }, { status: 500 });
  }

  try {
    // Check cache
    const cacheKey = `company_explore:${domain.toLowerCase()}`;
    const cached = await prisma.enrichmentCache.findUnique({
      where: { cacheKey },
    });

    if (cached && cached.expiresAt > new Date()) {
      return NextResponse.json(cached.data as object);
    }

    // Step 1: Get company info from Apollo
    let companyInfo: Record<string, unknown> | null = null;

    const orgRes = await fetch(`${APOLLO_API}/organizations/enrich?domain=${domain}`, {
      headers: { "X-Api-Key": apiKey },
    });

    if (orgRes.ok) {
      const orgData = await orgRes.json();
      companyInfo = orgData.organization || null;
    }

    // Step 2: Fetch people across multiple pages
    const allPeople: ApolloPerson[] = [];

    for (let page = 1; page <= 4; page++) {
      const peopleRes = await fetch(`${APOLLO_API}/mixed_people/api_search`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Api-Key": apiKey },
        body: JSON.stringify({
          organization_domains: [domain],
          per_page: 25,
          page,
        }),
      });

      if (!peopleRes.ok) break;

      const data = await peopleRes.json();
      const people = (data.people || []).map((p: Record<string, unknown>) => ({
        id: p.id || "",
        first_name: p.first_name || "",
        last_name: p.last_name || "",
        name: `${p.first_name || ""} ${p.last_name || ""}`.trim(),
        title: p.title || "",
        seniority: p.seniority || "unknown",
        city: p.city || "",
        state: p.state || "",
        country: p.country || "",
        linkedin_url: p.linkedin_url || "",
        headline: p.headline || "",
        departments: (p.departments as string[]) || [],
      }));

      allPeople.push(...people);

      // Stop if we got fewer than expected (last page)
      if (people.length < 25) break;
    }

    // Step 3: Group by department
    const departmentMap: Record<string, ApolloPerson[]> = {};

    for (const person of allPeople) {
      const depts = person.departments.length > 0 ? person.departments : ["Other"];
      for (const dept of depts) {
        const normalized = normalizeDepartment(dept);
        if (!departmentMap[normalized]) departmentMap[normalized] = [];
        departmentMap[normalized].push(person);
      }
    }

    // Step 4: Build department summaries with seniority breakdown
    const departments = Object.entries(departmentMap)
      .map(([name, people]) => {
        const seniorityBreakdown: Record<string, number> = {};
        for (const p of people) {
          const s = normalizeSeniority(p.seniority);
          seniorityBreakdown[s] = (seniorityBreakdown[s] || 0) + 1;
        }

        return {
          name,
          count: people.length,
          seniorityBreakdown,
          people: people.map((p) => ({
            id: p.id,
            name: p.name,
            title: p.title,
            seniority: normalizeSeniority(p.seniority),
            city: p.city,
            state: p.state,
            country: p.country,
            linkedinUrl: p.linkedin_url,
            headline: p.headline,
          })),
        };
      })
      .sort((a, b) => b.count - a.count);

    const result = {
      company: companyInfo
        ? {
            name: (companyInfo.name as string) || domain.split(".")[0],
            domain,
            headcount: companyInfo.estimated_num_employees || null,
            industry: companyInfo.industry || null,
            city: companyInfo.city || null,
            state: companyInfo.state || null,
            country: companyInfo.country || null,
            fundingStage: companyInfo.latest_funding_stage || null,
            fundingTotal: companyInfo.total_funding
              ? `$${Math.round((companyInfo.total_funding as number) / 1000000)}M`
              : null,
            logoUrl: companyInfo.logo_url || null,
            description: companyInfo.short_description || null,
            technologies: (companyInfo.technologies as string[]) || [],
          }
        : {
            name: domain.split(".")[0].charAt(0).toUpperCase() + domain.split(".")[0].slice(1),
            domain,
            headcount: null,
            industry: null,
            city: null,
            state: null,
            country: null,
            fundingStage: null,
            fundingTotal: null,
            logoUrl: null,
            description: null,
            technologies: [],
          },
      departments,
      totalPeople: allPeople.length,
    };

    // Cache for 7 days
    await prisma.enrichmentCache.upsert({
      where: { cacheKey },
      create: {
        cacheKey,
        cacheType: "company_explore",
        data: result as unknown as object,
        expiresAt: new Date(Date.now() + 7 * 86400000),
      },
      update: {
        data: result as unknown as object,
        expiresAt: new Date(Date.now() + 7 * 86400000),
      },
    }).catch(() => {});

    return NextResponse.json(result);
  } catch (error) {
    console.error("[company/explore] Failed:", error);
    return NextResponse.json(
      { error: "Failed to explore company. Please try again." },
      { status: 500 }
    );
  }
}

function normalizeDepartment(dept: string): string {
  const lower = dept.toLowerCase();
  if (lower.includes("engineer") || lower.includes("development") || lower.includes("technology") || lower.includes("it")) return "Engineering";
  if (lower.includes("product")) return "Product";
  if (lower.includes("design") || lower.includes("ux")) return "Design";
  if (lower.includes("data") || lower.includes("analytics")) return "Data";
  if (lower.includes("marketing")) return "Marketing";
  if (lower.includes("sales") || lower.includes("business_development")) return "Sales";
  if (lower.includes("operations") || lower.includes("support")) return "Operations";
  if (lower.includes("hr") || lower.includes("human") || lower.includes("people")) return "People";
  if (lower.includes("finance") || lower.includes("legal")) return "Finance & Legal";
  if (lower.includes("executive") || lower.includes("c_suite") || lower.includes("founder")) return "Leadership";
  return dept.charAt(0).toUpperCase() + dept.slice(1).replace(/_/g, " ");
}

function normalizeSeniority(seniority: string): string {
  const lower = seniority.toLowerCase();
  if (lower === "vp" || lower === "director") return "VP/Director";
  if (lower === "manager") return "Manager";
  if (lower === "senior") return "Senior";
  if (lower === "entry" || lower === "junior") return "Junior/Mid";
  if (lower === "intern" || lower === "training") return "Intern";
  if (lower === "owner" || lower === "founder" || lower === "partner") return "Executive";
  return seniority.charAt(0).toUpperCase() + seniority.slice(1);
}
