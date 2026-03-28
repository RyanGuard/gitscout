/**
 * RSS feed fetching and parsing for market intelligence signals.
 * Supplements Apollo news with Layoffs.fyi, TechCrunch, etc.
 */

import { XMLParser } from "fast-xml-parser";
import { prisma } from "@/lib/prisma";

interface RssArticle {
  title: string;
  snippet: string;
  url: string;
  published_date: string;
  source: string;
}

const RSS_SOURCES = [
  {
    id: "techcrunch",
    url: "https://techcrunch.com/feed/",
    name: "TechCrunch",
  },
];

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
});

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchFeed(
  source: (typeof RSS_SOURCES)[0]
): Promise<RssArticle[]> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const res = await fetch(source.url, {
      signal: controller.signal,
      headers: { "User-Agent": "Scout/1.0 (recruiting intelligence)" },
    });
    clearTimeout(timeout);

    if (!res.ok) return [];

    const xml = await res.text();
    const parsed = parser.parse(xml);

    // Handle RSS 2.0 format
    const items =
      parsed?.rss?.channel?.item ||
      parsed?.feed?.entry ||
      [];

    const articles: RssArticle[] = (Array.isArray(items) ? items : [items])
      .slice(0, 50)
      .map((item: Record<string, unknown>) => {
        const title = (item.title as string) || "";
        const description = stripHtml(
          (item.description as string) ||
            (item.summary as string) ||
            (item.content as string) ||
            ""
        );
        const link =
          (item.link as string) ||
          (item.link as Record<string, string>)?.["@_href"] ||
          "";
        const pubDate =
          (item.pubDate as string) ||
          (item.published as string) ||
          (item.updated as string) ||
          "";

        return {
          title: typeof title === "string" ? title : String(title),
          snippet: description.slice(0, 300),
          url: typeof link === "string" ? link : String(link),
          published_date: pubDate,
          source: source.name,
        };
      })
      .filter((a: RssArticle) => a.title && a.url);

    return articles;
  } catch {
    return [];
  }
}

/**
 * Fetch all RSS feeds and filter for articles mentioning a specific company.
 * Uses EnrichmentCache with 6-hour TTL per feed source.
 */
export async function fetchRssForCompany(
  companyName: string,
  companyDomain?: string
): Promise<RssArticle[]> {
  const allArticles: RssArticle[] = [];
  const searchTerms = [
    companyName.toLowerCase(),
    companyDomain?.replace(/\.com$|\.io$|\.dev$/, "").toLowerCase(),
  ].filter(Boolean) as string[];

  for (const source of RSS_SOURCES) {
    const cacheKey = `rss_feed:${source.id}`;

    // Check cache (6-hour TTL)
    let articles: RssArticle[] | null = null;
    try {
      const cached = await prisma.enrichmentCache.findUnique({
        where: { cacheKey },
      });
      if (cached && cached.expiresAt > new Date()) {
        articles = cached.data as unknown as RssArticle[];
      }
    } catch {
      // Cache miss
    }

    // Fetch if not cached
    if (!articles) {
      articles = await fetchFeed(source);
      if (articles.length > 0) {
        try {
          await prisma.enrichmentCache.upsert({
            where: { cacheKey },
            create: {
              cacheKey,
              cacheType: "rss_feed",
              data: articles as unknown as object,
              expiresAt: new Date(Date.now() + 6 * 60 * 60 * 1000), // 6 hours
            },
            update: {
              data: articles as unknown as object,
              expiresAt: new Date(Date.now() + 6 * 60 * 60 * 1000),
            },
          });
        } catch {
          // Cache write failure is non-fatal
        }
      }
    }

    // Filter for company mentions
    const matching = (articles || []).filter((a) => {
      const text = `${a.title} ${a.snippet}`.toLowerCase();
      return searchTerms.some((term) => text.includes(term));
    });

    allArticles.push(...matching);
  }

  return allArticles;
}
