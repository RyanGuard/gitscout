import { prisma } from "@/lib/prisma";

const CACHE_TTL: Record<string, number> = {
  people_search: 7,
  company_info: 14,
  person_enrichment: 30,
  job_postings: 3,
  news_articles: 3,
  connection_lookup: 7,
  github_repos: 7,
  stack_scan: 7,
};

export async function getCached<T = unknown>(key: string): Promise<T | null> {
  try {
    const cached = await prisma.enrichmentCache.findUnique({
      where: { cacheKey: key },
    });
    if (cached && cached.expiresAt > new Date()) {
      return cached.data as T;
    }
    if (cached) {
      await prisma.enrichmentCache
        .delete({ where: { cacheKey: key } })
        .catch(() => {});
    }
  } catch {
    // Cache miss
  }
  return null;
}

export async function setCache(key: string, type: string, data: unknown) {
  const ttlDays = CACHE_TTL[type] || 7;
  const expiresAt = new Date(Date.now() + ttlDays * 86400000);
  try {
    await prisma.enrichmentCache.upsert({
      where: { cacheKey: key },
      create: {
        cacheKey: key,
        cacheType: type,
        data: data as object,
        expiresAt,
      },
      update: { data: data as object, expiresAt },
    });
  } catch {
    // Cache write failure is non-fatal
  }
}
