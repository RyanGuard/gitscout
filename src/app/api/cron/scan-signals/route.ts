import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { fetchRssForCompany } from "@/lib/intelligence/rssFeeds";
import Anthropic from "@anthropic-ai/sdk";

const APOLLO_API = "https://api.apollo.io/api/v1";
const BATCH_SIZE = 30;

export const maxDuration = 300; // 5 minutes

export async function GET(req: NextRequest) {
  // Verify cron secret
  const authHeader = req.headers.get("authorization");
  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.APOLLO_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "APOLLO_API_KEY not configured" }, { status: 500 });
  }

  // Fetch active watched companies not scanned in last 24h
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const companies = await prisma.watchedCompany.findMany({
    where: {
      isActive: true,
      OR: [
        { lastScannedAt: null },
        { lastScannedAt: { lt: cutoff } },
      ],
    },
    orderBy: { lastScannedAt: { sort: "asc", nulls: "first" } },
    take: BATCH_SIZE,
  });

  if (companies.length === 0) {
    return NextResponse.json({ processed: 0, message: "No companies due for scanning" });
  }

  const anthropic = new Anthropic();
  let processed = 0;
  let signalsCreated = 0;
  let candidatesSurfaced = 0;

  for (const company of companies) {
    try {
      // Step 1: Fetch news from Apollo
      let articles: Array<{ title: string; snippet: string; url: string; published_date: string }> = [];

      // Build news search body — use org ID if available, fall back to name
      const newsBody: Record<string, unknown> = { page: 1, per_page: 10 };
      if (company.apolloOrgId) {
        newsBody.organization_ids = [company.apolloOrgId];
      } else {
        newsBody.q_organization_name = company.companyName;
      }

      const newsRes = await fetch(`${APOLLO_API}/news_articles/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Api-Key": apiKey },
        body: JSON.stringify(newsBody),
      });

      if (newsRes.ok) {
        const data = await newsRes.json();
        articles = (data.news_articles || []).map((a: Record<string, unknown>) => ({
          title: (a.title as string) || "",
          snippet: (a.snippet as string) || (a.text as string) || "",
          url: (a.url as string) || "",
          published_date: (a.published_date as string) || "",
        }));
      }

      // Step 2: Supplement with RSS feeds
      const rssArticles = await fetchRssForCompany(company.companyName, company.companyDomain);
      const rssFormatted = rssArticles.map((a) => ({
        title: a.title,
        snippet: a.snippet,
        url: a.url,
        published_date: a.published_date,
      }));

      // Merge and dedup by URL
      const seen = new Set<string>();
      const merged = [...articles, ...rssFormatted].filter((a) => {
        if (!a.url || seen.has(a.url)) return false;
        seen.add(a.url);
        return true;
      });

      if (merged.length === 0) {
        await prisma.watchedCompany.update({
          where: { id: company.id },
          data: { lastScannedAt: new Date() },
        });
        processed++;
        continue;
      }

      // Step 3: Claude classification
      const articleText = merged
        .slice(0, 8)
        .map((a, i) => `${i + 1}. "${a.title}" (${a.published_date})\n   ${a.snippet.slice(0, 200)}`)
        .join("\n\n");

      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2000,
        system: `You are analyzing news articles about ${company.companyName} for recruiting intelligence.

Identify any of these events with clear evidence:
- LAYOFFS: reduction in force, headcount cuts
- REORG: major restructuring, department changes
- ACQUISITION: company being acquired or acquiring
- FUNDING: new funding round
- LEADERSHIP_CHANGE: CEO/CTO/VP Engineering departure or replacement

For each event, provide event_type, severity (low/medium/high), summary (one sentence), date (YYYY-MM if available).
If no relevant events, return empty array.

Respond ONLY in JSON:
{"events": [{"event_type": "...", "severity": "...", "summary": "...", "date": "..."}]}`,
        messages: [{ role: "user", content: `Articles about ${company.companyName}:\n\n${articleText}` }],
      });

      const text = response.content[0].type === "text" ? response.content[0].text : "";
      let events: Array<{ event_type: string; severity: string; summary: string; date: string | null }> = [];

      try {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          events = parsed.events || [];
        }
      } catch {
        // Parse failure — skip
      }

      // Step 4: Create signals for medium/high severity events
      const significantEvents = events.filter(
        (e) => e.severity === "medium" || e.severity === "high"
      );

      // Apply signal filters if set
      const filteredEvents = company.signalFilters.length > 0
        ? significantEvents.filter((e) => company.signalFilters.includes(e.event_type))
        : significantEvents;

      for (const event of filteredEvents) {
        // Dedup: check for same event type + company within 7 days
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const existing = await prisma.marketSignal.findFirst({
          where: {
            watchedCompanyId: company.id,
            eventType: event.event_type,
            createdAt: { gte: sevenDaysAgo },
          },
        });

        if (existing) continue;

        // Create signal
        const signal = await prisma.marketSignal.create({
          data: {
            watchedCompanyId: company.id,
            userId: company.userId,
            eventType: event.event_type,
            severity: event.severity,
            summary: event.summary,
            sourceType: "apollo",
            eventDate: event.date,
            rawArticles: merged.slice(0, 5) as unknown as object,
          },
        });
        signalsCreated++;

        // Step 5: Surface candidates via Apollo People Search
        const searchBody: Record<string, unknown> = {
          organization_domains: [company.companyDomain],
          per_page: 25,
        };

        if (company.titleFilters.length > 0) {
          searchBody.person_titles = company.titleFilters;
        } else {
          searchBody.person_titles = ["engineer", "developer", "architect", "SRE", "devops"];
        }

        if (company.seniorityFilters.length > 0) {
          searchBody.person_seniorities = company.seniorityFilters;
        } else {
          searchBody.person_seniorities = ["senior", "manager", "director"];
        }

        const peopleRes = await fetch(`${APOLLO_API}/mixed_people/api_search`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Api-Key": apiKey },
          body: JSON.stringify(searchBody),
        });

        if (peopleRes.ok) {
          const peopleData = await peopleRes.json();
          const people = peopleData.people || [];

          for (const p of people) {
            await prisma.surfacedCandidate.create({
              data: {
                signalId: signal.id,
                apolloPersonId: p.id || null,
                name: `${p.first_name || ""} ${p.last_name || ""}`.trim() || "Unknown",
                firstName: p.first_name || null,
                lastName: p.last_name || null,
                title: p.title || null,
                seniority: p.seniority || null,
                city: p.city || null,
                state: p.state || null,
                country: p.country || null,
                linkedinUrl: p.linkedin_url || null,
                headline: p.headline || null,
                departments: (p.departments as string[]) || [],
              },
            });
            candidatesSurfaced++;
          }

          // Update signal candidate count
          await prisma.marketSignal.update({
            where: { id: signal.id },
            data: { candidateCount: people.length },
          });
        }
      }

      // Update company scan timestamp
      await prisma.watchedCompany.update({
        where: { id: company.id },
        data: {
          lastScannedAt: new Date(),
          signalCount: { increment: filteredEvents.length },
        },
      });

      processed++;
    } catch (err) {
      console.error(`[scan-signals] Failed for ${company.companyDomain}:`, err);
    }
  }

  return NextResponse.json({
    processed,
    signalsCreated,
    candidatesSurfaced,
  });
}
