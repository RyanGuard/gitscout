import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q");

  if (!q || q.length < 2) {
    return Response.json({ results: [] });
  }

  const apiKey = process.env.APOLLO_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "APOLLO_API_KEY not configured" }, { status: 500 });
  }

  // Check cache first (14-day TTL)
  const cacheKey = `org_search:${q.toLowerCase().trim()}`;
  try {
    const cached = await prisma.enrichmentCache.findUnique({
      where: { cacheKey },
    });
    if (cached && cached.expiresAt > new Date()) {
      return Response.json({ results: cached.data as object[], cached: true });
    }
  } catch {
    // Cache miss — continue
  }

  try {
    const res = await fetch("https://api.apollo.io/v1/organizations/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        q_organization_name: q,
        per_page: 5,
      }),
    });

    if (!res.ok) {
      return Response.json({ error: `Apollo returned ${res.status}` }, { status: 502 });
    }

    const data = await res.json();
    const results = (data.organizations || []).map((org: Record<string, unknown>) => ({
      company_name: org.name || "",
      company_domain: org.primary_domain || org.website_url || "",
      headcount: org.estimated_num_employees || null,
      hq_city: org.city || null,
      apollo_org_id: org.id || null,
    }));

    // Cache results (14 day TTL)
    try {
      await prisma.enrichmentCache.upsert({
        where: { cacheKey },
        create: {
          cacheKey,
          cacheType: "company_search",
          data: results as object,
          expiresAt: new Date(Date.now() + 14 * 86400000),
        },
        update: {
          data: results as object,
          expiresAt: new Date(Date.now() + 14 * 86400000),
        },
      });
    } catch {
      // Cache write failure is non-fatal
    }

    return Response.json({ results });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Search failed" },
      { status: 500 }
    );
  }
}
