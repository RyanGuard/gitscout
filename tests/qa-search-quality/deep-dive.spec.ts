/**
 * QA Deep Dive — 17 real searches against localhost:3000
 * Captures: result count, load time, relevance, match quality,
 * fields shown, scores, tiers, email indicators
 */

import { test, expect } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

const BASE = process.env.QA_BASE_URL || "https://gitscout-beta.vercel.app";
const REPORT_DIR = path.join(__dirname, "../../qa-reports/search-deep-dive");

// ─── Types ───────────────────────────────────────────────────────────────────

interface Developer {
  id: string;
  username: string;
  name: string | null;
  email: string | null;
  avatarUrl: string | null;
  bio: string | null;
  company: string | null;
  location: string | null;
  blog: string | null;
  publicRepos: number;
  followers: number;
  following: number;
  hireable: boolean;
  primaryLanguage: string | null;
  totalCommits: number;
  totalStars: number;
  score: number;
  tier: string;
  languages: { language: string; bytes?: number; repoCount?: number; percentage?: number }[];
  repositories: { name: string; language: string | null; stars: number; description: string | null }[];
  source: string;
}

interface SearchResponse {
  developers: Developer[];
  total: number;
  page: number;
  totalPages: number;
  query: string;
}

interface SearchMetrics {
  testId: number;
  testName: string;
  query: string;
  queryParams: Record<string, string>;
  loadTimeMs: number;
  httpStatus: number;
  resultCount: number;
  totalAvailable: number;
  relevanceScore: number; // 1-10
  matchQuality: string;
  avgDevScore: number;
  medianDevScore: number;
  minDevScore: number;
  maxDevScore: number;
  tierDistribution: Record<string, number>;
  emailCount: number;
  locationCount: number;
  bioCount: number;
  companyCount: number;
  hireableCount: number;
  avgFollowers: number;
  avgStars: number;
  avgRepos: number;
  languageDistribution: Record<string, number>;
  sourceDistribution: Record<string, number>;
  topDevelopers: { username: string; score: number; tier: string; followers: number; location: string | null }[];
  issues: string[];
  notes: string;
  rawResponse?: SearchResponse;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function analyzeResults(
  testId: number,
  testName: string,
  query: string,
  queryParams: Record<string, string>,
  data: SearchResponse,
  loadTimeMs: number,
  httpStatus: number,
  expectedLanguage?: string,
  expectedLocation?: string,
): SearchMetrics {
  const devs = data.developers || [];
  const issues: string[] = [];
  const notes: string[] = [];

  // Score distribution
  const scores = devs.map((d) => d.score || 0);
  const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
  const medScore = median(scores);

  // Tier distribution
  const tierDist: Record<string, number> = {};
  devs.forEach((d) => {
    const t = d.tier || "Unknown";
    tierDist[t] = (tierDist[t] || 0) + 1;
  });

  // Language distribution
  const langDist: Record<string, number> = {};
  devs.forEach((d) => {
    if (d.primaryLanguage) langDist[d.primaryLanguage] = (langDist[d.primaryLanguage] || 0) + 1;
    d.languages?.forEach((l) => {
      langDist[l.language] = (langDist[l.language] || 0) + 1;
    });
  });

  // Source distribution
  const srcDist: Record<string, number> = {};
  devs.forEach((d) => {
    const s = d.source || "unknown";
    srcDist[s] = (srcDist[s] || 0) + 1;
  });

  // Field availability
  const emailCount = devs.filter((d) => d.email).length;
  const locationCount = devs.filter((d) => d.location).length;
  const bioCount = devs.filter((d) => d.bio).length;
  const companyCount = devs.filter((d) => d.company).length;
  const hireableCount = devs.filter((d) => d.hireable).length;

  // Averages
  const avgFollowers = devs.length > 0 ? devs.reduce((s, d) => s + (d.followers || 0), 0) / devs.length : 0;
  const avgStars = devs.length > 0 ? devs.reduce((s, d) => s + (d.totalStars || 0), 0) / devs.length : 0;
  const avgRepos = devs.length > 0 ? devs.reduce((s, d) => s + (d.publicRepos || 0), 0) / devs.length : 0;

  // Relevance scoring (1-10)
  let relevance = 5; // baseline

  // Language relevance
  if (expectedLanguage) {
    const langMatch = devs.filter((d) => {
      const langs = d.languages?.map((l) => l.language.toLowerCase()) || [];
      const primary = d.primaryLanguage?.toLowerCase();
      const target = expectedLanguage.toLowerCase();
      // Also check aliases
      const aliases: Record<string, string[]> = {
        javascript: ["javascript", "typescript", "react"],
        typescript: ["typescript", "javascript"],
        react: ["javascript", "typescript"],
      };
      const targets = aliases[target] || [target];
      return targets.some((t) => langs.includes(t) || primary === t);
    }).length;
    const langPct = devs.length > 0 ? langMatch / devs.length : 0;
    if (langPct >= 0.7) relevance += 2;
    else if (langPct >= 0.4) relevance += 1;
    else if (langPct < 0.2) {
      relevance -= 2;
      issues.push(`Only ${langMatch}/${devs.length} (${(langPct * 100).toFixed(0)}%) match expected language "${expectedLanguage}"`);
    }
  }

  // Location relevance
  if (expectedLocation) {
    const locLower = expectedLocation.toLowerCase();
    const locVariants = [locLower];
    // Add common aliases
    const locAliases: Record<string, string[]> = {
      "san francisco": ["san francisco", "sf", "bay area", "silicon valley", "california", "ca"],
      sf: ["san francisco", "sf", "bay area"],
      "bay area": ["san francisco", "sf", "bay area", "silicon valley"],
      "new york": ["new york", "nyc", "brooklyn", "manhattan", "ny"],
      seattle: ["seattle", "wa", "washington"],
      austin: ["austin", "tx", "texas"],
      berlin: ["berlin", "germany", "deutschland"],
      "buenos aires": ["buenos aires", "argentina", "caba"],
      portland: ["portland", "or", "oregon"],
    };
    if (locAliases[locLower]) locVariants.push(...locAliases[locLower]);

    const locMatch = devs.filter((d) => {
      const devLoc = (d.location || "").toLowerCase();
      return locVariants.some((v) => devLoc.includes(v));
    }).length;
    const locPct = devs.length > 0 ? locMatch / devs.length : 0;
    if (locPct >= 0.5) relevance += 2;
    else if (locPct >= 0.2) relevance += 1;
    else if (devs.length > 0) {
      relevance -= 1;
      issues.push(`Only ${locMatch}/${devs.length} (${(locPct * 100).toFixed(0)}%) in expected location "${expectedLocation}"`);
    }
  }

  // Score quality
  if (avgScore >= 70) relevance += 1;
  if (devs.length === 0) relevance = 1;
  if (loadTimeMs > 15000) issues.push(`Slow response: ${(loadTimeMs / 1000).toFixed(1)}s`);
  if (loadTimeMs > 30000) relevance -= 1;

  relevance = Math.max(1, Math.min(10, relevance));

  // Match quality label
  let matchQuality = "Poor";
  if (relevance >= 9) matchQuality = "Excellent";
  else if (relevance >= 7) matchQuality = "Good";
  else if (relevance >= 5) matchQuality = "Fair";
  else if (relevance >= 3) matchQuality = "Weak";

  // Top developers
  const topDevs = [...devs]
    .sort((a, b) => (b.score || 0) - (a.score || 0))
    .slice(0, 5)
    .map((d) => ({
      username: d.username,
      score: d.score,
      tier: d.tier,
      followers: d.followers,
      location: d.location,
    }));

  return {
    testId,
    testName,
    query,
    queryParams,
    loadTimeMs,
    httpStatus,
    resultCount: devs.length,
    totalAvailable: data.total || 0,
    relevanceScore: relevance,
    matchQuality,
    avgDevScore: Math.round(avgScore * 10) / 10,
    medianDevScore: Math.round(medScore * 10) / 10,
    minDevScore: scores.length > 0 ? Math.min(...scores) : 0,
    maxDevScore: scores.length > 0 ? Math.max(...scores) : 0,
    tierDistribution: tierDist,
    emailCount,
    locationCount,
    bioCount,
    companyCount,
    hireableCount,
    avgFollowers: Math.round(avgFollowers),
    avgStars: Math.round(avgStars),
    avgRepos: Math.round(avgRepos),
    languageDistribution: langDist,
    sourceDistribution: srcDist,
    topDevelopers: topDevs,
    issues,
    notes: notes.join("; "),
    rawResponse: data,
  };
}

async function doSearch(
  request: { get: (url: string) => Promise<{ status: () => number; json: () => Promise<unknown>; ok: () => boolean; text: () => Promise<string> }> },
  params: Record<string, string>,
): Promise<{ data: SearchResponse; loadTimeMs: number; httpStatus: number }> {
  const qs = new URLSearchParams(params).toString();
  const start = Date.now();
  const res = await request.get(`${BASE}/api/search?${qs}`);
  const loadTimeMs = Date.now() - start;
  const status = res.status();

  // Handle non-JSON / empty responses gracefully
  let data: SearchResponse;
  try {
    const text = await res.text();
    data = text ? JSON.parse(text) : { developers: [], total: 0, page: 1, totalPages: 0, query: params.q || "" };
  } catch {
    data = { developers: [], total: 0, page: 1, totalPages: 0, query: params.q || "" };
  }
  return { data, loadTimeMs, httpStatus: status };
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ─── Storage for all results ─────────────────────────────────────────────────

const allMetrics: SearchMetrics[] = [];

// ─── Tests ───────────────────────────────────────────────────────────────────

test.describe.configure({ mode: "serial" });

// 1) TypeScript developers in San Francisco
test("Q01: TypeScript developers in San Francisco", async ({ request }) => {
  const params = { q: "TypeScript developers in San Francisco" };
  const { data, loadTimeMs, httpStatus } = await doSearch(request, params);
  const m = analyzeResults(1, "TypeScript developers in San Francisco", params.q, params, data, loadTimeMs, httpStatus, "typescript", "san francisco");
  allMetrics.push(m);
  expect(data.developers.length).toBeGreaterThan(0);
});

// 2) Python developers in Austin
test("Q02: Python developers in Austin", async ({ request }) => {
  const params = { q: "Python developers in Austin" };
  const { data, loadTimeMs, httpStatus } = await doSearch(request, params);
  const m = analyzeResults(2, "Python developers in Austin", params.q, params, data, loadTimeMs, httpStatus, "python", "austin");
  allMetrics.push(m);
  expect(data.developers.length).toBeGreaterThan(0);
});

// 3) Rust developers in Berlin
test("Q03: Rust developers in Berlin", async ({ request }) => {
  const params = { q: "Rust developers in Berlin" };
  const { data, loadTimeMs, httpStatus } = await doSearch(request, params);
  const m = analyzeResults(3, "Rust developers in Berlin", params.q, params, data, loadTimeMs, httpStatus, "rust", "berlin");
  allMetrics.push(m);
  expect(data.developers.length).toBeGreaterThan(0);
});

// 4) Go developers in Seattle
test("Q04: Go developers in Seattle", async ({ request }) => {
  const params = { q: "Go developers in Seattle" };
  const { data, loadTimeMs, httpStatus } = await doSearch(request, params);
  const m = analyzeResults(4, "Go developers in Seattle", params.q, params, data, loadTimeMs, httpStatus, "go", "seattle");
  allMetrics.push(m);
  expect(data.developers.length).toBeGreaterThan(0);
});

// 5) React developers in New York
test("Q05: React developers in New York", async ({ request }) => {
  const params = { q: "React developers in New York" };
  const { data, loadTimeMs, httpStatus } = await doSearch(request, params);
  const m = analyzeResults(5, "React developers in New York", params.q, params, data, loadTimeMs, httpStatus, "javascript", "new york");
  allMetrics.push(m);
  expect(data.developers.length).toBeGreaterThan(0);
});

// 6) Machine learning engineers
test("Q06: Machine learning engineers", async ({ request }) => {
  const params = { q: "machine learning engineers" };
  const { data, loadTimeMs, httpStatus } = await doSearch(request, params);
  const m = analyzeResults(6, "Machine learning engineers", params.q, params, data, loadTimeMs, httpStatus, "python");
  allMetrics.push(m);
  expect(data.developers.length).toBeGreaterThan(0);
});

// 7) Developers in Buenos Aires
test("Q07: Developers in Buenos Aires", async ({ request }) => {
  const params = { q: "developers in Buenos Aires" };
  const { data, loadTimeMs, httpStatus } = await doSearch(request, params);
  const m = analyzeResults(7, "Developers in Buenos Aires", params.q, params, data, loadTimeMs, httpStatus, undefined, "buenos aires");
  allMetrics.push(m);
  expect(data.developers.length).toBeGreaterThan(0);
});

// 8) Empty search
test("Q08: Empty search", async ({ request }) => {
  const params = { q: "" };
  const { data, loadTimeMs, httpStatus } = await doSearch(request, params);
  const m = analyzeResults(8, "Empty search", "", params, data, loadTimeMs, httpStatus);
  // Empty search should return empty or handle gracefully
  if (data.developers.length === 0) {
    m.notes = "Correctly returns empty results for empty query";
    m.relevanceScore = 10;
    m.matchQuality = "Excellent";
  } else {
    m.notes = `Returned ${data.developers.length} results for empty query (unexpected)`;
    m.issues.push("Non-empty results for empty query");
  }
  allMetrics.push(m);
  expect(httpStatus).toBe(200);
});

// 9) JavaScript vs TypeScript comparison
test("Q09: JavaScript vs TypeScript comparison", async ({ request }) => {
  const paramsJS = { q: "javascript developers" };
  const paramsTS = { q: "typescript developers" };
  const js = await doSearch(request, paramsJS);
  await delay(1500);
  const ts = await doSearch(request, paramsTS);

  const mJS = analyzeResults(9, "JavaScript developers (comparison)", paramsJS.q, paramsJS, js.data, js.loadTimeMs, js.httpStatus, "javascript");
  const mTS = analyzeResults(9, "TypeScript developers (comparison)", paramsTS.q, paramsTS, ts.data, ts.loadTimeMs, ts.httpStatus, "typescript");

  // Check for differentiation
  const jsUsernames = new Set(js.data.developers.map((d) => d.username));
  const tsUsernames = new Set(ts.data.developers.map((d) => d.username));
  const overlap = [...jsUsernames].filter((u) => tsUsernames.has(u)).length;
  const overlapPct = Math.max(jsUsernames.size, tsUsernames.size) > 0
    ? overlap / Math.max(jsUsernames.size, tsUsernames.size)
    : 0;

  mJS.notes = `JS results: ${js.data.developers.length}, TS results: ${ts.data.developers.length}, Overlap: ${overlap} (${(overlapPct * 100).toFixed(0)}%)`;
  mTS.notes = mJS.notes;

  if (overlapPct > 0.7) {
    mJS.issues.push(`High overlap with TS results: ${(overlapPct * 100).toFixed(0)}%`);
    mTS.issues.push(`High overlap with JS results: ${(overlapPct * 100).toFixed(0)}%`);
  }

  allMetrics.push(mJS);
  allMetrics.push(mTS);
  expect(js.data.developers.length).toBeGreaterThan(0);
  expect(ts.data.developers.length).toBeGreaterThan(0);
});

// 10) San Francisco vs SF vs Bay Area
test("Q10: SF location alias comparison", async ({ request }) => {
  const sf1 = await doSearch(request, { q: "developers in San Francisco" });
  await delay(1500);
  const sf2 = await doSearch(request, { q: "developers in SF" });
  await delay(1500);
  const sf3 = await doSearch(request, { q: "developers in Bay Area" });

  const m1 = analyzeResults(10, "Developers in San Francisco", "developers in San Francisco", { q: "developers in San Francisco" }, sf1.data, sf1.loadTimeMs, sf1.httpStatus, undefined, "san francisco");
  const m2 = analyzeResults(10, "Developers in SF", "developers in SF", { q: "developers in SF" }, sf2.data, sf2.loadTimeMs, sf2.httpStatus, undefined, "san francisco");
  const m3 = analyzeResults(10, "Developers in Bay Area", "developers in Bay Area", { q: "developers in Bay Area" }, sf3.data, sf3.loadTimeMs, sf3.httpStatus, undefined, "san francisco");

  // Check consistency
  const u1 = new Set(sf1.data.developers.map((d) => d.username));
  const u2 = new Set(sf2.data.developers.map((d) => d.username));
  const u3 = new Set(sf3.data.developers.map((d) => d.username));
  const overlap12 = [...u1].filter((u) => u2.has(u)).length;
  const overlap13 = [...u1].filter((u) => u3.has(u)).length;
  const overlap23 = [...u2].filter((u) => u3.has(u)).length;

  const note = `SF: ${sf1.data.developers.length} results, "SF": ${sf2.data.developers.length} results, "Bay Area": ${sf3.data.developers.length} results. Overlap SF/sf: ${overlap12}, SF/BA: ${overlap13}, sf/BA: ${overlap23}`;
  m1.notes = note;
  m2.notes = note;
  m3.notes = note;

  if (overlap12 < 3 && sf1.data.developers.length > 5 && sf2.data.developers.length > 5) {
    m2.issues.push("Low overlap between 'San Francisco' and 'SF' aliases");
  }

  allMetrics.push(m1);
  allMetrics.push(m2);
  allMetrics.push(m3);
  expect(sf1.httpStatus).toBe(200);
});

// 11) torvalds
test("Q11: torvalds (known user)", async ({ request }) => {
  const params = { q: "torvalds" };
  const { data, loadTimeMs, httpStatus } = await doSearch(request, params);
  const m = analyzeResults(11, "torvalds (known user)", params.q, params, data, loadTimeMs, httpStatus);

  const found = data.developers.find((d) => d.username.toLowerCase() === "torvalds");
  if (found) {
    m.notes = `Found torvalds: score=${found.score}, tier=${found.tier}, followers=${found.followers}, location=${found.location}`;
    m.relevanceScore = 10;
    m.matchQuality = "Excellent";
  } else {
    m.issues.push("Linus Torvalds not found in results");
    m.relevanceScore = 1;
  }

  allMetrics.push(m);
  expect(found).toBeTruthy();
});

// 12) FakeLanguage123
test("Q12: FakeLanguage123 (nonsense query)", async ({ request }) => {
  const params = { q: "FakeLanguage123" };
  const { data, loadTimeMs, httpStatus } = await doSearch(request, params);
  const m = analyzeResults(12, "FakeLanguage123 (nonsense query)", params.q, params, data, loadTimeMs, httpStatus);

  if (data.developers.length === 0) {
    m.notes = "Correctly returns empty/minimal results for nonsense query";
    m.relevanceScore = 8;
    m.matchQuality = "Good";
  } else {
    m.notes = `Returned ${data.developers.length} results for nonsense query`;
    // Not necessarily bad — GitHub may find users with that term
  }

  allMetrics.push(m);
  expect(httpStatus).toBe(200);
});

// 13) Elixir in Portland
test("Q13: Elixir in Portland", async ({ request }) => {
  const params = { q: "Elixir in Portland" };
  const { data, loadTimeMs, httpStatus } = await doSearch(request, params);
  const m = analyzeResults(13, "Elixir in Portland", params.q, params, data, loadTimeMs, httpStatus, "elixir", "portland");
  allMetrics.push(m);
  // Niche query — may have few results
  expect(httpStatus).toBe(200);
});

// 14) Rapid consecutive searches
test("Q14: Rapid consecutive searches (stress test)", async ({ request }) => {
  const queries = [
    "python developers",
    "rust developers",
    "go developers",
    "javascript developers",
    "typescript developers",
  ];

  const results: { query: string; loadTimeMs: number; resultCount: number; status: number }[] = [];

  // Fire all 5 rapidly (sequential with minimal delay to avoid GitHub secondary rate limits)
  for (const q of queries) {
    const start = Date.now();
    const res = await request.get(`${BASE}/api/search?q=${encodeURIComponent(q)}`);
    const loadTimeMs = Date.now() - start;
    let data: SearchResponse;
    try {
      const text = await res.text();
      data = text ? JSON.parse(text) : { developers: [], total: 0, page: 1, totalPages: 0, query: q };
    } catch {
      data = { developers: [], total: 0, page: 1, totalPages: 0, query: q };
    }
    results.push({ query: q, loadTimeMs, resultCount: data.developers?.length || 0, status: res.status() });
    await delay(800);
  }

  const failedCount = results.filter((r) => r.status !== 200).length;
  const avgTime = results.reduce((s, r) => s + r.loadTimeMs, 0) / results.length;
  const maxTime = Math.max(...results.map((r) => r.loadTimeMs));

  const m: SearchMetrics = {
    testId: 14,
    testName: "Rapid consecutive searches (stress test)",
    query: queries.join(" | "),
    queryParams: { queries: queries.join(",") },
    loadTimeMs: Math.round(avgTime),
    httpStatus: failedCount === 0 ? 200 : 429,
    resultCount: results.reduce((s, r) => s + r.resultCount, 0),
    totalAvailable: 0,
    relevanceScore: failedCount === 0 ? 8 : 4,
    matchQuality: failedCount === 0 ? "Good" : "Weak",
    avgDevScore: 0,
    medianDevScore: 0,
    minDevScore: 0,
    maxDevScore: 0,
    tierDistribution: {},
    emailCount: 0,
    locationCount: 0,
    bioCount: 0,
    companyCount: 0,
    hireableCount: 0,
    avgFollowers: 0,
    avgStars: 0,
    avgRepos: 0,
    languageDistribution: {},
    sourceDistribution: {},
    topDevelopers: [],
    issues: [],
    notes: `5 concurrent searches. Avg: ${Math.round(avgTime)}ms, Max: ${maxTime}ms, Failed: ${failedCount}/5. Details: ${results.map((r) => `${r.query}=${r.status}(${r.loadTimeMs}ms,${r.resultCount})`).join(", ")}`,
  };

  if (failedCount > 0) m.issues.push(`${failedCount}/5 requests failed (rate limited?)`);
  if (maxTime > 30000) m.issues.push(`Slowest request: ${(maxTime / 1000).toFixed(1)}s`);

  allMetrics.push(m);
  expect(failedCount).toBeLessThanOrEqual(2); // allow some rate limiting
});

// 15) Same search twice (consistency)
test("Q15: Same search twice (consistency check)", async ({ request }) => {
  const params = { q: "TypeScript developers in San Francisco" };
  const r1 = await doSearch(request, params);

  // Small delay to avoid pure cache hits
  await new Promise((r) => setTimeout(r, 500));

  const r2 = await doSearch(request, params);

  const m1 = analyzeResults(15, "Consistency check — run 1", params.q, params, r1.data, r1.loadTimeMs, r1.httpStatus, "typescript", "san francisco");
  const m2 = analyzeResults(15, "Consistency check — run 2", params.q, params, r2.data, r2.loadTimeMs, r2.httpStatus, "typescript", "san francisco");

  const u1 = new Set(r1.data.developers.map((d) => d.username));
  const u2 = new Set(r2.data.developers.map((d) => d.username));
  const overlap = [...u1].filter((u) => u2.has(u)).length;
  const consistency = Math.max(u1.size, u2.size) > 0
    ? overlap / Math.max(u1.size, u2.size)
    : 1;

  const note = `Run 1: ${r1.data.developers.length} results (${r1.loadTimeMs}ms), Run 2: ${r2.data.developers.length} results (${r2.loadTimeMs}ms). Overlap: ${overlap}/${Math.max(u1.size, u2.size)} (${(consistency * 100).toFixed(0)}%)`;
  m1.notes = note;
  m2.notes = note;

  if (consistency < 0.5) {
    m1.issues.push(`Low consistency between identical searches: ${(consistency * 100).toFixed(0)}%`);
    m2.issues.push(`Low consistency between identical searches: ${(consistency * 100).toFixed(0)}%`);
  }

  allMetrics.push(m1);
  allMetrics.push(m2);
  expect(r1.httpStatus).toBe(200);
  expect(r2.httpStatus).toBe(200);
});

// 16) TypeScript+SF sorted each way — verify top, #10, last result
test("Q16: TypeScript+SF sort comparison", async ({ request }) => {
  const baseQ = "TypeScript developers in San Francisco";
  const byFollowers = await doSearch(request, { q: baseQ, sort: "followers" });
  await delay(1500);
  const byStars = await doSearch(request, { q: baseQ, sort: "stars" });
  await delay(1500);
  const byJoined = await doSearch(request, { q: baseQ, sort: "joined" });

  const analyze = (label: string, sort: string, result: typeof byFollowers) => {
    const devs = result.data.developers || [];
    const top = devs[0];
    const tenth = devs[9];
    const last = devs[devs.length - 1];

    const m = analyzeResults(16, `Sort by ${label}`, baseQ, { q: baseQ, sort }, result.data, result.loadTimeMs, result.httpStatus, "typescript", "san francisco");
    m.notes = [
      `Sort: ${label}`,
      `Top: ${top?.username || "N/A"} (score=${top?.score}, followers=${top?.followers})`,
      `#10: ${tenth?.username || "N/A"} (score=${tenth?.score}, followers=${tenth?.followers})`,
      `Last: ${last?.username || "N/A"} (score=${last?.score}, followers=${last?.followers})`,
      `Total results: ${devs.length}`,
    ].join(" | ");
    return m;
  };

  allMetrics.push(analyze("followers", "followers", byFollowers));
  allMetrics.push(analyze("stars", "stars", byStars));
  allMetrics.push(analyze("joined", "joined", byJoined));

  expect(byFollowers.httpStatus).toBe(200);
});

// 17) Python+Machine Learning — check for PyTorch/TF/HF contributors
test("Q17: Python + Machine Learning (ML ecosystem check)", async ({ request }) => {
  const params = { q: "Python machine learning" };
  const { data, loadTimeMs, httpStatus } = await doSearch(request, params);
  const m = analyzeResults(17, "Python + Machine Learning", params.q, params, data, loadTimeMs, httpStatus, "python");

  // Check for ML ecosystem indicators
  const devs = data.developers || [];
  const mlSignals: string[] = [];

  devs.forEach((d) => {
    const bioLower = (d.bio || "").toLowerCase();
    const repoNames = d.repositories?.map((r) => r.name.toLowerCase()) || [];
    const repoDescs = d.repositories?.map((r) => (r.description || "").toLowerCase()) || [];
    const allText = [bioLower, ...repoNames, ...repoDescs].join(" ");

    if (allText.includes("pytorch") || allText.includes("torch")) mlSignals.push(`${d.username}:PyTorch`);
    if (allText.includes("tensorflow") || allText.includes("tf2") || allText.includes("keras")) mlSignals.push(`${d.username}:TensorFlow`);
    if (allText.includes("hugging") || allText.includes("transformers") || allText.includes("huggingface")) mlSignals.push(`${d.username}:HuggingFace`);
    if (allText.includes("machine learning") || allText.includes("deep learning") || allText.includes("neural")) mlSignals.push(`${d.username}:ML`);
    if (allText.includes("llm") || allText.includes("gpt") || allText.includes("language model")) mlSignals.push(`${d.username}:LLM`);
  });

  const uniqueMLDevs = new Set(mlSignals.map((s) => s.split(":")[0])).size;
  m.notes = `ML ecosystem signals: ${mlSignals.length} across ${uniqueMLDevs} devs. Signals: ${mlSignals.slice(0, 20).join(", ")}${mlSignals.length > 20 ? "..." : ""}`;

  if (uniqueMLDevs === 0 && devs.length > 0) {
    m.issues.push("No ML ecosystem signals (PyTorch/TF/HF) found in results");
  }

  allMetrics.push(m);
  expect(httpStatus).toBe(200);
});

// ─── Report Generation ──────────────────────────────────────────────────────

test.afterAll(async () => {
  if (allMetrics.length === 0) return;

  // Write raw JSON
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(REPORT_DIR, "raw-metrics.json"),
    JSON.stringify(
      allMetrics.map((metric) => {
        const { rawResponse, ...rest } = metric;
        void rawResponse;
        return rest;
      }),
      null,
      2
    ),
  );

  // Generate markdown report
  const report = generateMarkdownReport(allMetrics);
  fs.writeFileSync(path.join(REPORT_DIR, "query-quality-report.md"), report);
});

function generateMarkdownReport(metrics: SearchMetrics[]): string {
  const now = new Date().toISOString();
  const lines: string[] = [];

  lines.push("# Scout Search Quality Deep Dive Report");
  lines.push("");
  lines.push(`**Generated:** ${now}`);
  lines.push(`**Target:** ${BASE}`);
  lines.push(`**Total Searches:** ${metrics.length}`);
  lines.push("");

  // ── Executive Summary
  lines.push("## Executive Summary");
  lines.push("");

  const searchMetrics = metrics.filter((m) => m.testId !== 14); // exclude stress test from averages
  const avgRelevance = searchMetrics.length > 0 ? searchMetrics.reduce((s, m) => s + m.relevanceScore, 0) / searchMetrics.length : 0;
  const avgLoadTime = searchMetrics.length > 0 ? searchMetrics.reduce((s, m) => s + m.loadTimeMs, 0) / searchMetrics.length : 0;
  const totalIssues = metrics.reduce((s, m) => s + m.issues.length, 0);
  const excellentCount = searchMetrics.filter((m) => m.matchQuality === "Excellent").length;
  const goodCount = searchMetrics.filter((m) => m.matchQuality === "Good").length;
  const fairCount = searchMetrics.filter((m) => m.matchQuality === "Fair").length;
  const weakCount = searchMetrics.filter((m) => m.matchQuality === "Weak").length;
  const poorCount = searchMetrics.filter((m) => m.matchQuality === "Poor").length;

  lines.push(`| Metric | Value |`);
  lines.push(`|--------|-------|`);
  lines.push(`| Avg Relevance Score | ${avgRelevance.toFixed(1)} / 10 |`);
  lines.push(`| Avg Load Time | ${(avgLoadTime / 1000).toFixed(2)}s |`);
  lines.push(`| Total Issues Found | ${totalIssues} |`);
  lines.push(`| Excellent | ${excellentCount} |`);
  lines.push(`| Good | ${goodCount} |`);
  lines.push(`| Fair | ${fairCount} |`);
  lines.push(`| Weak | ${weakCount} |`);
  lines.push(`| Poor | ${poorCount} |`);
  lines.push("");

  // Overall grade
  const overallGrade = avgRelevance >= 8 ? "A" : avgRelevance >= 6.5 ? "B" : avgRelevance >= 5 ? "C" : avgRelevance >= 3.5 ? "D" : "F";
  lines.push(`### Overall Grade: **${overallGrade}** (${avgRelevance.toFixed(1)}/10)`);
  lines.push("");

  // ── Summary Table
  lines.push("## Results Summary");
  lines.push("");
  lines.push("| # | Query | Results | Load Time | Relevance | Quality | Avg Score | Issues |");
  lines.push("|---|-------|---------|-----------|-----------|---------|-----------|--------|");

  for (const m of metrics) {
    const loadStr = `${(m.loadTimeMs / 1000).toFixed(1)}s`;
    const issueStr = m.issues.length > 0 ? m.issues.length.toString() : "-";
    lines.push(`| ${m.testId} | ${m.testName.substring(0, 45)} | ${m.resultCount} | ${loadStr} | ${m.relevanceScore}/10 | ${m.matchQuality} | ${m.avgDevScore} | ${issueStr} |`);
  }
  lines.push("");

  // ── Detailed Results
  lines.push("---");
  lines.push("");
  lines.push("## Detailed Results");
  lines.push("");

  // Group by testId (some tests produce multiple entries)
  const byTestId = new Map<number, SearchMetrics[]>();
  for (const m of metrics) {
    if (!byTestId.has(m.testId)) byTestId.set(m.testId, []);
    byTestId.get(m.testId)!.push(m);
  }

  for (const [testId, testMetrics] of byTestId) {
    const first = testMetrics[0];
    lines.push(`### Q${String(testId).padStart(2, "0")}: ${first.testName}`);
    lines.push("");

    for (const m of testMetrics) {
      if (testMetrics.length > 1) {
        lines.push(`#### ${m.testName}`);
        lines.push("");
      }

      lines.push(`**Query:** \`${m.query}\``);
      lines.push("");
      lines.push(`| Metric | Value |`);
      lines.push(`|--------|-------|`);
      lines.push(`| HTTP Status | ${m.httpStatus} |`);
      lines.push(`| Results Returned | ${m.resultCount} |`);
      lines.push(`| Total Available | ${m.totalAvailable} |`);
      lines.push(`| Load Time | ${(m.loadTimeMs / 1000).toFixed(2)}s |`);
      lines.push(`| Relevance Score | ${m.relevanceScore}/10 |`);
      lines.push(`| Match Quality | ${m.matchQuality} |`);
      lines.push("");

      if (m.resultCount > 0 && m.testId !== 14) {
        lines.push("**Score Distribution:**");
        lines.push("");
        lines.push(`| Metric | Value |`);
        lines.push(`|--------|-------|`);
        lines.push(`| Average Score | ${m.avgDevScore} |`);
        lines.push(`| Median Score | ${m.medianDevScore} |`);
        lines.push(`| Min Score | ${m.minDevScore} |`);
        lines.push(`| Max Score | ${m.maxDevScore} |`);
        lines.push("");

        lines.push("**Tier Distribution:**");
        lines.push("");
        for (const [tier, count] of Object.entries(m.tierDistribution).sort((a, b) => b[1] - a[1])) {
          const bar = "#".repeat(Math.min(30, count));
          lines.push(`- ${tier}: ${count} ${bar}`);
        }
        lines.push("");

        lines.push("**Field Availability:**");
        lines.push("");
        lines.push(`| Field | Count | % |`);
        lines.push(`|-------|-------|---|`);
        lines.push(`| Email | ${m.emailCount} | ${m.resultCount > 0 ? ((m.emailCount / m.resultCount) * 100).toFixed(0) : 0}% |`);
        lines.push(`| Location | ${m.locationCount} | ${m.resultCount > 0 ? ((m.locationCount / m.resultCount) * 100).toFixed(0) : 0}% |`);
        lines.push(`| Bio | ${m.bioCount} | ${m.resultCount > 0 ? ((m.bioCount / m.resultCount) * 100).toFixed(0) : 0}% |`);
        lines.push(`| Company | ${m.companyCount} | ${m.resultCount > 0 ? ((m.companyCount / m.resultCount) * 100).toFixed(0) : 0}% |`);
        lines.push(`| Hireable | ${m.hireableCount} | ${m.resultCount > 0 ? ((m.hireableCount / m.resultCount) * 100).toFixed(0) : 0}% |`);
        lines.push("");

        lines.push("**Averages:**");
        lines.push("");
        lines.push(`- Avg Followers: ${m.avgFollowers}`);
        lines.push(`- Avg Stars: ${m.avgStars}`);
        lines.push(`- Avg Public Repos: ${m.avgRepos}`);
        lines.push("");

        if (Object.keys(m.languageDistribution).length > 0) {
          lines.push("**Top Languages:**");
          lines.push("");
          const sortedLangs = Object.entries(m.languageDistribution).sort((a, b) => b[1] - a[1]).slice(0, 10);
          for (const [lang, count] of sortedLangs) {
            lines.push(`- ${lang}: ${count}`);
          }
          lines.push("");
        }

        lines.push("**Source Distribution:**");
        lines.push("");
        for (const [src, count] of Object.entries(m.sourceDistribution)) {
          lines.push(`- ${src}: ${count}`);
        }
        lines.push("");

        if (m.topDevelopers.length > 0) {
          lines.push("**Top 5 Developers:**");
          lines.push("");
          lines.push("| Username | Score | Tier | Followers | Location |");
          lines.push("|----------|-------|------|-----------|----------|");
          for (const d of m.topDevelopers) {
            lines.push(`| ${d.username} | ${d.score} | ${d.tier} | ${d.followers} | ${d.location || "N/A"} |`);
          }
          lines.push("");
        }
      }

      if (m.notes) {
        lines.push(`**Notes:** ${m.notes}`);
        lines.push("");
      }

      if (m.issues.length > 0) {
        lines.push("**Issues:**");
        lines.push("");
        for (const issue of m.issues) {
          lines.push(`- ${issue}`);
        }
        lines.push("");
      }
    }

    lines.push("---");
    lines.push("");
  }

  // ── Cross-Query Analysis
  lines.push("## Cross-Query Analysis");
  lines.push("");

  // Performance breakdown
  lines.push("### Performance");
  lines.push("");
  const sortedByTime = [...metrics].sort((a, b) => b.loadTimeMs - a.loadTimeMs);
  lines.push("| Query | Load Time |");
  lines.push("|-------|-----------|");
  for (const m of sortedByTime.slice(0, 10)) {
    lines.push(`| ${m.testName.substring(0, 50)} | ${(m.loadTimeMs / 1000).toFixed(2)}s |`);
  }
  lines.push("");

  // Issues summary
  const allIssues = metrics.flatMap((m) => m.issues.map((i) => ({ test: m.testName, issue: i })));
  if (allIssues.length > 0) {
    lines.push("### All Issues Found");
    lines.push("");
    for (const { test, issue } of allIssues) {
      lines.push(`- **${test}**: ${issue}`);
    }
    lines.push("");
  }

  // Recommendations
  lines.push("### Recommendations");
  lines.push("");

  const slowSearches = metrics.filter((m) => m.loadTimeMs > 10000);
  if (slowSearches.length > 0) {
    lines.push(`- **Performance**: ${slowSearches.length} searches took >10s. Consider caching or reducing profile fetches.`);
  }

  const lowRelevance = searchMetrics.filter((m) => m.relevanceScore < 5);
  if (lowRelevance.length > 0) {
    lines.push(`- **Relevance**: ${lowRelevance.length} searches scored below 5/10 relevance. Review query parsing for these cases.`);
  }

  const lowEmailRate = searchMetrics.filter((m) => m.resultCount > 0 && m.emailCount / m.resultCount < 0.1);
  if (lowEmailRate.length > 0) {
    lines.push(`- **Email Availability**: ${lowEmailRate.length} searches had <10% email availability. Consider enrichment pipeline.`);
  }

  lines.push("");
  lines.push("---");
  lines.push(`*Report generated by Scout QA Deep Dive Suite*`);

  return lines.join("\n");
}
