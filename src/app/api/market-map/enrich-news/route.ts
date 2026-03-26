import { prisma } from "@/lib/prisma";
import Anthropic from "@anthropic-ai/sdk";

const APOLLO_API = "https://api.apollo.io/v1";

interface NewsEvent {
  event_type: "LAYOFFS" | "REORG" | "ACQUISITION" | "FUNDING" | "LEADERSHIP_CHANGE";
  severity: "low" | "medium" | "high";
  summary: string;
  date: string | null;
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const { company_id, company_name } = body;

  if (!company_id || !company_name) {
    return Response.json({ error: "company_id and company_name required" }, { status: 400 });
  }

  const apiKey = process.env.APOLLO_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "APOLLO_API_KEY not configured" }, { status: 500 });
  }

  try {
    // Check cache first (3-day TTL for news)
    const cacheKey = `news:${company_name.toLowerCase().replace(/\s+/g, "_")}`;
    const cached = await prisma.enrichmentCache.findUnique({
      where: { cacheKey },
    });

    let articles: Array<{ title: string; snippet: string; url: string; published_date: string }> = [];

    if (cached && cached.expiresAt > new Date()) {
      articles = cached.data as typeof articles;
    } else {
      // Fetch news from Apollo
      const newsRes = await fetch(`${APOLLO_API}/news_articles/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: apiKey,
          q_organization_name: company_name,
          page: 1,
          per_page: 10,
        }),
      });

      if (newsRes.ok) {
        const newsData = await newsRes.json();
        articles = (newsData.news_articles || []).map((a: Record<string, unknown>) => ({
          title: a.title || "",
          snippet: a.snippet || a.text || "",
          url: a.url || "",
          published_date: a.published_date || "",
        }));

        // Cache for 3 days
        await prisma.enrichmentCache.upsert({
          where: { cacheKey },
          create: {
            cacheKey,
            cacheType: "news",
            data: articles as object,
            expiresAt: new Date(Date.now() + 3 * 86400000),
          },
          update: {
            data: articles as object,
            expiresAt: new Date(Date.now() + 3 * 86400000),
          },
        }).catch(() => {});
      }
    }

    if (articles.length === 0) {
      // No news — update company with low risk
      await prisma.mapCompany.update({
        where: { id: company_id },
        data: {
          newsSummary: "No recent news articles found.",
          newsEvents: [],
          newsFetchedAt: new Date(),
          flightRiskCompany: "low",
        },
      });
      return Response.json({ events: [], flightRisk: "low", summary: "No recent news." });
    }

    // Analyze news with Claude
    const anthropic = new Anthropic();

    const articleText = articles
      .slice(0, 8)
      .map((a, i) => `${i + 1}. "${a.title}" (${a.published_date})\n   ${a.snippet.slice(0, 200)}`)
      .join("\n\n");

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      system: `You are analyzing news articles about ${company_name} for recruiting intelligence.

From these articles, identify any of the following events. Respond ONLY with the events you find clear evidence for:
- LAYOFFS: any reduction in force, layoffs, or significant headcount cuts
- REORG: major restructuring, department changes, leadership turnover
- ACQUISITION: company being acquired or acquiring another company
- FUNDING: new funding round (positive signal — company is growing)
- LEADERSHIP_CHANGE: CEO/CTO/VP Engineering departure or replacement

For each event found, provide:
- event_type: one of the above
- severity: low/medium/high
- summary: one sentence
- date: approximate date if available (YYYY-MM format)

If no relevant events are found, return an empty array.

Respond ONLY in JSON:
{
  "events": [
    {"event_type": "LAYOFFS", "severity": "high", "summary": "Company laid off 15% of workforce in January", "date": "2026-01"}
  ],
  "overall_summary": "One sentence summary of the most important finding for a recruiter"
}`,
      messages: [{ role: "user", content: `Articles about ${company_name}:\n\n${articleText}` }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    let events: NewsEvent[] = [];
    let overallSummary = "No significant events detected.";

    try {
      const parsed = JSON.parse(text);
      events = parsed.events || [];
      overallSummary = parsed.overall_summary || overallSummary;
    } catch {
      const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[1]);
        events = parsed.events || [];
        overallSummary = parsed.overall_summary || overallSummary;
      }
    }

    // Compute company-level flight risk from events
    const hasHighSeverity = events.some(
      (e) => (e.event_type === "LAYOFFS" || e.event_type === "REORG") && e.severity === "high"
    );
    const hasMediumSeverity = events.some(
      (e) => (e.event_type === "LAYOFFS" || e.event_type === "REORG" || e.event_type === "LEADERSHIP_CHANGE") &&
        (e.severity === "medium" || e.severity === "high")
    );
    const flightRisk = hasHighSeverity ? "high" : hasMediumSeverity ? "medium" : "low";

    // Update company
    await prisma.mapCompany.update({
      where: { id: company_id },
      data: {
        newsSummary: overallSummary,
        newsEvents: events as object,
        newsFetchedAt: new Date(),
        flightRiskCompany: flightRisk,
      },
    });

    return Response.json({
      events,
      flightRisk,
      summary: overallSummary,
      articlesAnalyzed: articles.length,
    });
  } catch (error) {
    console.error("[enrich-news] Failed:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "News enrichment failed" },
      { status: 500 }
    );
  }
}
