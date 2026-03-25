// QA: Search performance — response times and rate limiting

import { test, expect } from "@playwright/test";

const BASE = process.env.QA_BASE_URL || "https://gitscout-beta.vercel.app";

test("Search responds under 10 seconds", async ({ request }) => {
  const start = Date.now();
  const res = await request.get(`${BASE}/api/search?q=python`);
  const elapsed = Date.now() - start;

  expect(res.ok()).toBeTruthy();
  expect(elapsed).toBeLessThan(10000);
  console.log(`  ⏱️  "python" search: ${(elapsed / 1000).toFixed(1)}s`);
});

test("Quick search pipeline responds under 5 seconds", async ({ request }) => {
  const start = Date.now();
  const res = await request.post(`${BASE}/api/search/quick`, {
    data: { language: "typescript", minFollowers: 100, perPage: 10 },
  });
  const elapsed = Date.now() - start;

  expect(res.ok()).toBeTruthy();
  const data = await res.json();
  expect(data.developers.length).toBeGreaterThan(0);
  expect(elapsed).toBeLessThan(5000);
  console.log(`  ⏱️  Quick search (TS, 100+ followers): ${(elapsed / 1000).toFixed(1)}s — ${data.developers.length} results`);
});

test("Stats endpoint responds under 2 seconds", async ({ request }) => {
  const start = Date.now();
  const res = await request.get(`${BASE}/api/stats`);
  const elapsed = Date.now() - start;

  expect(res.ok()).toBeTruthy();
  expect(elapsed).toBeLessThan(2000);
  const data = await res.json();
  console.log(`  ⏱️  Stats: ${(elapsed / 1000).toFixed(1)}s — ${data.totalDevelopers} devs indexed`);
});

test("Profile API responds under 5 seconds", async ({ request }) => {
  const start = Date.now();
  const res = await request.get(`${BASE}/api/profiles/sindresorhus`);
  const elapsed = Date.now() - start;

  // May 404 if not indexed, that's OK — just check it responds
  expect(elapsed).toBeLessThan(5000);
  console.log(`  ⏱️  Profile fetch: ${(elapsed / 1000).toFixed(1)}s — status ${res.status()}`);
});

test("Score API computes under 15 seconds", async ({ request }) => {
  const start = Date.now();
  const res = await request.get(`${BASE}/api/score/sindresorhus`);
  const elapsed = Date.now() - start;

  if (res.ok()) {
    const data = await res.json();
    console.log(`  ⏱️  Score compute: ${(elapsed / 1000).toFixed(1)}s — score: ${data.score}, tier: ${data.tier}`);
  } else {
    console.log(`  ⏱️  Score compute: ${(elapsed / 1000).toFixed(1)}s — status ${res.status()}`);
  }
  expect(elapsed).toBeLessThan(15000);
});

test("Concurrent searches don't crash", async ({ request }) => {
  const queries = ["python", "rust", "go developers", "frontend", "ml engineer"];
  const start = Date.now();

  const results = await Promise.all(
    queries.map((q) =>
      request.get(`${BASE}/api/search?q=${encodeURIComponent(q)}`).then((r) => ({
        query: q,
        ok: r.ok(),
        status: r.status(),
      }))
    )
  );
  const elapsed = Date.now() - start;

  const successful = results.filter((r) => r.ok).length;
  console.log(`  ⏱️  5 concurrent searches: ${(elapsed / 1000).toFixed(1)}s — ${successful}/5 succeeded`);

  expect(successful).toBeGreaterThanOrEqual(3); // At least 3 of 5 should work
});
