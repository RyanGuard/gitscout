import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { safeErrorMessage } from "@/lib/api-error";

const APOLLO_API = "https://api.apollo.io/api/v1";

interface NewsEvent {
  event_type:
    | "LAYOFFS"
    | "REORG"
    | "ACQUISITION"
    | "FUNDING"
    | "LEADERSHIP_CHANGE";
  severity: "low" | "medium" | "high";
  summary: string;
  date: string | null;
  source_url?: string;
}

interface ApolloArticle {
  title?: string;
  snippet?: string;
  text?: string;
  url?: string;
  published_date?: string;
}

interface ApolloPerson {
  id?: string;
  first_name?: string;
  last_name?: string;
  name?: string;
  title?: string;
  seniority?: string;
  city?: string;
  state?: string;
  country?: string;
  linkedin_url?: string;
  headline?: string;
  departments?: string[];
  months_in_current_role?: number;
  email?: string;
  phone?: string;
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const { watchedCompanyId } = body;

  if (!watchedCompanyId || typeof watchedCompanyId !== "string") {
    return NextResponse.json(
      { error: "watchedCompanyId is required" },
      { status: 400 }
    );
  }

  // Verify ownership
  const watchedCompany = await prisma.watchedCompany.findUnique({
    where: { id: watchedCompanyId },
  });

  if (!watchedCompany) {
    return NextResponse.json(
      { error: "Watched company not found" },
      { status: 404 }
    );
  }

  if (watchedCompany.userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!watchedCompany.isActive) {
    return NextResponse.json(
      { error: "Watched company is not active" },
      { status: 400 }
    );
  }

  const apolloApiKey = process.env.APOLLO_API_KEY;
  if (!apolloApiKey) {
    return NextResponse.json(
      { error: "APOLLO_API_KEY not configured" },
      { status: 500 }
    );
  }

  try {
    // -------------------------------------------------------
    // Step 1: Fetch news from Apollo (check cache first)
    // -------------------------------------------------------
    const cacheKey = `news:${watchedCompany.companyName.toLowerCase().replace(/\s+/g, "_")}`;
    const cached = await prisma.enrichmentCache.findUnique({
      where: { cacheKey },
    });

    let articles: Array<{
      title: string;
      snippet: string;
      url: string;
      published_date: string;
    }> = [];

    if (cached && cached.expiresAt > new Date()) {
      articles = cached.data as typeof articles;
    } else {
      const newsRes = await fetch(`${APOLLO_API}/news_articles/search`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Api-Key": apolloApiKey,
        },
        body: JSON.stringify({
          q_organization_name: watchedCompany.companyName,
          page: 1,
          per_page: 10,
        }),
      });

      if (newsRes.ok) {
        const newsData = await newsRes.json();
        articles = (newsData.news_articles || []).map((a: ApolloArticle) => ({
          title: a.title || "",
          snippet: a.snippet || a.text || "",
          url: a.url || "",
          published_date: a.published_date || "",
        }));

        // Cache for 3 days
        await prisma.enrichmentCache
          .upsert({
            where: { cacheKey },
            create: {
              cacheKey,
              cacheType: "news_articles",
              data: articles as object,
              expiresAt: new Date(Date.now() + 3 * 86400000),
            },
            update: {
              data: articles as object,
              expiresAt: new Date(Date.now() + 3 * 86400000),
            },
          })
          .catch(() => {});
      }
    }

    // -------------------------------------------------------
    // Step 2: Classify news with Claude (skip if no articles)
    // -------------------------------------------------------
    let events: NewsEvent[] = [];

    if (articles.length > 0) {
      const anthropic = new Anthropic();
      const articleText = articles
        .slice(0, 8)
        .map(
          (a, i) =>
            `${i + 1}. "${a.title}" (${a.published_date})\n   ${a.snippet.slice(0, 200)}`
        )
        .join("\n\n");

      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2000,
        system: `You are analyzing news articles about ${watchedCompany.companyName} for recruiting intelligence.

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
- source_url: the article URL if available

If no relevant events are found, return an empty array.

Respond ONLY in JSON:
{
  "events": [
    {"event_type": "LAYOFFS", "severity": "high", "summary": "Company laid off 15% of workforce in January", "date": "2026-01", "source_url": "https://..."}
  ]
}`,
        messages: [
          {
            role: "user",
            content: `Articles about ${watchedCompany.companyName}:\n\n${articleText}`,
          },
        ],
      });

      const text =
        response.content[0].type === "text" ? response.content[0].text : "";

      try {
        const parsed = JSON.parse(text);
        events = parsed.events || [];
      } catch {
        const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[1]);
          events = parsed.events || [];
        }
      }
    }

    // Filter by signal filters if configured
    const filteredEvents =
      watchedCompany.signalFilters.length > 0
        ? events.filter((e) =>
            watchedCompany.signalFilters.includes(e.event_type)
          )
        : events;

    // Only create signals for medium/high severity events
    const significantEvents = filteredEvents.filter(
      (e) => e.severity === "medium" || e.severity === "high"
    );

    // If no significant news events, create a baseline signal
    // so candidates still get surfaced on first scan
    if (significantEvents.length === 0) {
      significantEvents.push({
        event_type: "FUNDING" as const,
        severity: "medium" as const,
        summary: `Now watching ${watchedCompany.companyName} — ${articles.length > 0 ? articles.length + " recent articles reviewed, no major events detected" : "no recent news found"}. Here are current engineering candidates.`,
        date: new Date().toISOString().slice(0, 7),
        source_url: undefined,
      });
    }

    // -------------------------------------------------------
    // Step 3: Surface candidates via Apollo People Search
    // -------------------------------------------------------
    const peopleCacheKey = `people_search:${watchedCompany.companyDomain}:${(watchedCompany.titleFilters || []).join(",")}:${(watchedCompany.seniorityFilters || []).join(",")}`;
    const peopleCached = await prisma.enrichmentCache.findUnique({
      where: { cacheKey: peopleCacheKey },
    });

    let apolloPeople: ApolloPerson[] = [];

    if (peopleCached && peopleCached.expiresAt > new Date()) {
      apolloPeople = peopleCached.data as ApolloPerson[];
    } else {
      const searchBody: Record<string, unknown> = {
        q_organization_domains: watchedCompany.companyDomain,
        page: 1,
        per_page: 25,
      };

      const titleFilters = watchedCompany.titleFilters?.length
        ? watchedCompany.titleFilters
        : ["engineer", "developer", "architect", "SRE", "devops"];
      const seniorityFilters = watchedCompany.seniorityFilters?.length
        ? watchedCompany.seniorityFilters
        : ["senior", "manager", "director"];

      searchBody.person_titles = titleFilters;
      searchBody.person_seniorities = seniorityFilters;

      const peopleRes = await fetch(
        `${APOLLO_API}/mixed_people/api_search`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Api-Key": apolloApiKey,
          },
          body: JSON.stringify(searchBody),
        }
      );

      if (peopleRes.ok) {
        const peopleData = await peopleRes.json();
        apolloPeople = peopleData.people || [];

        // Cache for 7 days
        await prisma.enrichmentCache
          .upsert({
            where: { cacheKey: peopleCacheKey },
            create: {
              cacheKey: peopleCacheKey,
              cacheType: "people_search",
              data: apolloPeople as object,
              expiresAt: new Date(Date.now() + 7 * 86400000),
            },
            update: {
              data: apolloPeople as object,
              expiresAt: new Date(Date.now() + 7 * 86400000),
            },
          })
          .catch(() => {});
      }
    }

    // -------------------------------------------------------
    // Step 4: Create MarketSignal + SurfacedCandidate records
    // -------------------------------------------------------
    let totalSignalsCreated = 0;
    let totalCandidatesSurfaced = 0;

    for (const event of significantEvents) {
      const signal = await prisma.marketSignal.create({
        data: {
          watchedCompanyId,
          userId: session.user.id,
          eventType: event.event_type,
          severity: event.severity,
          summary: event.summary,
          sourceUrl: event.source_url || null,
          sourceType: "apollo",
          eventDate: event.date || null,
          rawArticles: articles as object,
          candidateCount: apolloPeople.length,
        },
      });

      totalSignalsCreated++;

      // Create surfaced candidates for each signal
      if (apolloPeople.length > 0) {
        const candidateData = apolloPeople.map((p) => ({
          signalId: signal.id,
          apolloPersonId: p.id || null,
          name:
            p.name ||
            [p.first_name, p.last_name].filter(Boolean).join(" ") ||
            "Unknown",
          firstName: p.first_name || null,
          lastName: p.last_name || null,
          title: p.title || null,
          seniority: p.seniority || null,
          city: p.city || null,
          state: p.state || null,
          country: p.country || null,
          linkedinUrl: p.linkedin_url || null,
          headline: p.headline || null,
          departments: p.departments || [],
          tenureMonths: p.months_in_current_role || null,
        }));

        await prisma.surfacedCandidate.createMany({
          data: candidateData,
        });

        totalCandidatesSurfaced += candidateData.length;
      }
    }

    // -------------------------------------------------------
    // Step 5: Update WatchedCompany
    // -------------------------------------------------------
    const currentSignalCount = await prisma.marketSignal.count({
      where: { watchedCompanyId },
    });

    await prisma.watchedCompany.update({
      where: { id: watchedCompanyId },
      data: {
        lastScannedAt: new Date(),
        signalCount: currentSignalCount,
      },
    });

    return NextResponse.json({
      signalsCreated: totalSignalsCreated,
      candidatesSurfaced: totalCandidatesSurfaced,
      eventsFound: filteredEvents.length,
      significantEvents: significantEvents.length,
    });
  } catch (error) {
    console.error("[alerts/scan] Failed:", error);
    return NextResponse.json(
      {
        error: safeErrorMessage(error, "Scan failed"),
      },
      { status: 500 }
    );
  }
}
