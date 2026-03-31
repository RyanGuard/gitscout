import { getAuthUserId } from "@/lib/auth";

const APOLLO_API = "https://api.apollo.io/api/v1";

export async function POST(request: Request) {
  const userId = await getAuthUserId(request);
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.APOLLO_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "Apollo API key not configured" }, { status: 500 });
  }

  const body = await request.json().catch(() => ({}));
  const { location, min_headcount, max_headcount, funding_stages } = body;

  // Build Apollo organization search query
  const searchBody: Record<string, unknown> = {
    page: 1,
    per_page: 25,
  };

  if (location) {
    searchBody.organization_locations = [location];
  }

  if (min_headcount || max_headcount) {
    const ranges: string[] = [];
    const min = min_headcount || 1;
    const max = max_headcount || 1000000;
    // Apollo uses predefined ranges — map our input to their format
    const apolloRanges = [
      { label: "1,10", min: 1, max: 10 },
      { label: "11,20", min: 11, max: 20 },
      { label: "21,50", min: 21, max: 50 },
      { label: "51,100", min: 51, max: 100 },
      { label: "101,200", min: 101, max: 200 },
      { label: "201,500", min: 201, max: 500 },
      { label: "501,1000", min: 501, max: 1000 },
      { label: "1001,2000", min: 1001, max: 2000 },
      { label: "2001,5000", min: 2001, max: 5000 },
      { label: "5001,10000", min: 5001, max: 10000 },
      { label: "10001,", min: 10001, max: Infinity },
    ];
    for (const range of apolloRanges) {
      if (range.max >= min && range.min <= max) {
        ranges.push(range.label);
      }
    }
    if (ranges.length > 0) {
      searchBody.organization_num_employees_ranges = ranges;
    }
  }

  if (funding_stages?.length) {
    // Map user-friendly names to Apollo's format
    const stageMap: Record<string, string> = {
      "Seed": "seed",
      "Series A": "series_a",
      "Series B": "series_b",
      "Series C": "series_c",
      "Series D+": "series_d",
      "IPO": "ipo",
    };
    searchBody.organization_latest_funding_stage_cd = funding_stages
      .map((s: string) => stageMap[s])
      .filter(Boolean);
  }

  try {
    const res = await fetch(`${APOLLO_API}/mixed_companies/search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": apiKey,
      },
      body: JSON.stringify(searchBody),
    });

    if (!res.ok) {
      return Response.json({ error: "Apollo search failed" }, { status: 502 });
    }

    const data = await res.json();
    const organizations = data.organizations || [];

    const companies = organizations.map((org: {
      name?: string;
      primary_domain?: string;
      estimated_num_employees?: number;
      city?: string;
      state?: string;
      latest_funding_stage?: string;
      technologies?: string[];
    }) => ({
      name: org.name || "Unknown",
      domain: org.primary_domain || "",
      headcount: org.estimated_num_employees || null,
      city: [org.city, org.state].filter(Boolean).join(", ") || null,
      funding: org.latest_funding_stage || null,
      techStack: org.technologies || [],
    }));

    return Response.json({ companies });
  } catch (err) {
    console.error("[search-companies] Failed:", err);
    return Response.json(
      { error: err instanceof Error ? err.message : "Search failed" },
      { status: 500 }
    );
  }
}
