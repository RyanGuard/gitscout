/**
 * Stack Overflow profile enrichment.
 * Fetches a user's SO profile by username or display name using the public API.
 * Results are cached in EnrichmentCache with a 14-day TTL.
 */

import { prisma } from "@/lib/prisma";

export interface StackOverflowProfile {
  userId: number;
  displayName: string;
  reputation: number;
  goldBadges: number;
  silverBadges: number;
  bronzeBadges: number;
  answerCount: number;
  questionCount: number;
  topTags: Array<{ name: string; answerCount: number; answerScore: number }>;
  profileUrl: string;
  reputationTier: "elite" | "expert" | "experienced" | "active" | "new";
}

const SO_API = "https://api.stackexchange.com/2.3";
const CACHE_TTL_DAYS = 14;

function getReputationTier(
  reputation: number
): StackOverflowProfile["reputationTier"] {
  if (reputation >= 50_000) return "elite";
  if (reputation >= 10_000) return "expert";
  if (reputation >= 3_000) return "experienced";
  if (reputation >= 500) return "active";
  return "new";
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: {
      "Accept-Encoding": "gzip",
      "User-Agent": "Scout/1.0 (recruiting intelligence)",
    },
  });

  if (!res.ok) {
    throw new Error(`Stack Overflow API error: ${res.status}`);
  }

  return res.json() as Promise<T>;
}

interface SOUserResponse {
  items: Array<{
    user_id: number;
    display_name: string;
    reputation: number;
    badge_counts: {
      gold: number;
      silver: number;
      bronze: number;
    };
    answer_count: number;
    question_count: number;
    link: string;
  }>;
}

interface SOTopTagsResponse {
  items: Array<{
    tag_name: string;
    answer_count: number;
    answer_score: number;
  }>;
}

async function findUser(
  nameOrUsername: string
): Promise<SOUserResponse["items"][0] | null> {
  const encoded = encodeURIComponent(nameOrUsername);
  const url = `${SO_API}/users?order=desc&sort=reputation&inname=${encoded}&site=stackoverflow`;
  const data = await fetchJson<SOUserResponse>(url);

  if (!data.items || data.items.length === 0) return null;

  // Prefer an exact match on display name (case-insensitive)
  const lower = nameOrUsername.toLowerCase();
  const exact = data.items.find(
    (u) => u.display_name.toLowerCase() === lower
  );

  return exact ?? data.items[0];
}

async function fetchTopTags(userId: number): Promise<SOTopTagsResponse> {
  const url = `${SO_API}/users/${userId}/top-answer-tags?pagesize=10&site=stackoverflow`;
  return fetchJson<SOTopTagsResponse>(url);
}

/**
 * Enrich a Stack Overflow profile by username or display name.
 * Returns null if no matching user is found.
 */
export async function enrichStackOverflow(
  nameOrUsername: string
): Promise<StackOverflowProfile | null> {
  const cacheKey = `stackoverflow:${nameOrUsername.toLowerCase()}`;

  // Check cache first
  try {
    const cached = await prisma.enrichmentCache.findUnique({
      where: { cacheKey },
    });
    if (cached && cached.expiresAt > new Date()) {
      return cached.data as unknown as StackOverflowProfile;
    }
  } catch {
    // Cache miss — continue to API
  }

  // Search for user
  const user = await findUser(nameOrUsername);
  if (!user) return null;

  // Fetch top tags
  let topTags: StackOverflowProfile["topTags"] = [];
  try {
    const tagsResponse = await fetchTopTags(user.user_id);
    topTags = (tagsResponse.items || []).map((t) => ({
      name: t.tag_name,
      answerCount: t.answer_count,
      answerScore: t.answer_score,
    }));
  } catch {
    // Non-fatal — return profile without top tags
  }

  const profile: StackOverflowProfile = {
    userId: user.user_id,
    displayName: user.display_name,
    reputation: user.reputation,
    goldBadges: user.badge_counts.gold,
    silverBadges: user.badge_counts.silver,
    bronzeBadges: user.badge_counts.bronze,
    answerCount: user.answer_count,
    questionCount: user.question_count,
    topTags,
    profileUrl: user.link,
    reputationTier: getReputationTier(user.reputation),
  };

  // Cache the result (14-day TTL)
  try {
    await prisma.enrichmentCache.upsert({
      where: { cacheKey },
      create: {
        cacheKey,
        cacheType: "stackoverflow",
        data: profile as unknown as object,
        expiresAt: new Date(Date.now() + CACHE_TTL_DAYS * 86_400_000),
      },
      update: {
        data: profile as unknown as object,
        expiresAt: new Date(Date.now() + CACHE_TTL_DAYS * 86_400_000),
      },
    });
  } catch {
    // Cache write failure is non-fatal
  }

  return profile;
}
