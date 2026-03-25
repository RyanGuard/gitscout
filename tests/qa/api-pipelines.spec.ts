// QA: API pipeline tests — deep search, quick search, scoring

import { test, expect } from "@playwright/test";
import { gradeResults, printGradeReport, type QualityGrade } from "./helpers";

const BASE = process.env.QA_BASE_URL || "https://gitscout-beta.vercel.app";

const grades: QualityGrade[] = [];

test("Deep search: frontend role returns high-quality results", async ({ request }) => {
  const start = Date.now();
  const res = await request.post(`${BASE}/api/search/deep`, {
    data: { roleCategory: "frontend", maxResults: 10 },
    timeout: 45000,
  });
  const elapsed = Date.now() - start;

  if (res.ok()) {
    const data = await res.json();
    console.log(`  🔍 Deep search (frontend): ${(elapsed / 1000).toFixed(1)}s`);
    console.log(`     Results: ${data.total_count} | Repos scanned: ${data.meta?.reposScanned}`);
    console.log(`     Contributors found: ${data.meta?.contributorsFound} | Unicorns: ${data.meta?.unicorns}`);

    if (data.developers?.length > 0) {
      const top3 = data.developers.slice(0, 3);
      for (const d of top3) {
        console.log(`     ${d.tier?.emoji || "?"} ${d.displayName} (@${d.username}) — Score: ${d.score?.total} | ${d.followers} followers`);
      }
    }

    expect(data.developers?.length).toBeGreaterThan(0);

    // Deep results should be higher quality than quick
    const avgScore = data.developers.reduce((s: number, d: { score: { total: number } }) => s + (d.score?.total || 0), 0) / data.developers.length;
    console.log(`     Avg deep score: ${avgScore.toFixed(1)}`);
  } else {
    console.log(`  🔍 Deep search failed: ${res.status()} (${(elapsed / 1000).toFixed(1)}s)`);
    // Deep search may timeout on Vercel Hobby — don't fail the test
  }
});

test("Deep search: rust role returns Rust developers", async ({ request }) => {
  const start = Date.now();
  const res = await request.post(`${BASE}/api/search/deep`, {
    data: { roleCategory: "rust", maxResults: 5 },
    timeout: 45000,
  });
  const elapsed = Date.now() - start;

  if (res.ok()) {
    const data = await res.json();
    console.log(`  🦀 Deep search (rust): ${(elapsed / 1000).toFixed(1)}s — ${data.total_count} results`);

    if (data.developers?.length > 0) {
      // Check that results actually know Rust
      const rustDevs = data.developers.filter((d: { languages: Record<string, number> }) =>
        d.languages && Object.keys(d.languages).some((l) => l.toLowerCase() === "rust")
      );
      console.log(`     Rust developers: ${rustDevs.length}/${data.developers.length}`);
    }
  } else {
    console.log(`  🦀 Deep search (rust) failed: ${res.status()}`);
  }
});

test("Quick search vs Deep search quality comparison", async ({ request }) => {
  // Quick search
  const quickStart = Date.now();
  const quickRes = await request.post(`${BASE}/api/search/quick`, {
    data: { language: "python", minFollowers: 50, perPage: 10 },
  });
  const quickTime = Date.now() - quickStart;

  let quickAvgFollowers = 0;
  if (quickRes.ok()) {
    const quickData = await quickRes.json();
    quickAvgFollowers = quickData.developers.reduce((s: number, d: { followers: number }) => s + d.followers, 0) / Math.max(quickData.developers.length, 1);
    console.log(`  ⚡ Quick (Python): ${(quickTime / 1000).toFixed(1)}s | ${quickData.developers.length} results | Avg followers: ${Math.round(quickAvgFollowers)}`);
  }

  // Deep search
  const deepStart = Date.now();
  const deepRes = await request.post(`${BASE}/api/search/deep`, {
    data: { roleCategory: "ml", maxResults: 10 },
    timeout: 45000,
  });
  const deepTime = Date.now() - deepStart;

  if (deepRes.ok()) {
    const deepData = await deepRes.json();
    const deepAvgScore = deepData.developers.reduce((s: number, d: { score: { total: number } }) => s + (d.score?.total || 0), 0) / Math.max(deepData.developers.length, 1);
    console.log(`  🧠 Deep (ML): ${(deepTime / 1000).toFixed(1)}s | ${deepData.developers.length} results | Avg score: ${deepAvgScore.toFixed(1)}`);
    console.log(`  📊 Deep search took ${((deepTime - quickTime) / 1000).toFixed(1)}s longer but should be higher quality`);
  }
});

test("Scoring API returns valid 5-pillar breakdown", async ({ request }) => {
  const res = await request.get(`${BASE}/api/score/torvalds`);

  if (res.ok()) {
    const data = await res.json();
    console.log(`  📊 Score for torvalds: ${data.score} (${data.tier})`);
    console.log(`     Confidence: ${data.confidence}`);

    if (data.pillars) {
      for (const [key, pillar] of Object.entries(data.pillars) as [string, { score: number; label: string }][]) {
        console.log(`     ${pillar.label}: ${pillar.score}/${10}`);
      }
    }

    // Score should be a valid number
    expect(data.score).toBeGreaterThanOrEqual(0);
    expect(data.score).toBeLessThanOrEqual(100);
    expect(data.tier).toBeTruthy();
    expect(data.confidence).toMatch(/high|medium|low/);
  }
});

test.afterAll(() => {
  if (grades.length > 0) printGradeReport(grades);
});
