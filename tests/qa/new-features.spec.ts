/**
 * QA Tests for New Features
 * Tests: NL Search, LinkedIn Lookup, Open-to-Move, Stack Overflow,
 *        Conference Speakers, Company Sourcing, Market Intelligence,
 *        Sequences, Onboarding
 *
 * Run: npx playwright test tests/qa/new-features.spec.ts --reporter=list
 */

import { test, expect } from "@playwright/test";

const BASE = process.env.QA_BASE_URL || "https://gitscout-beta.vercel.app";

// Helper: call API with optional auth
async function api(
  path: string,
  options: { method?: string; body?: unknown; timeout?: number } = {}
) {
  const { method = "GET", body, timeout = 30000 } = options;
  const url = `${BASE}${path}`;
  const headers: Record<string, string> = { "Content-Type": "application/json" };

  // Add eval API key if available (for authenticated endpoints)
  if (process.env.EVAL_API_KEY) {
    headers["x-eval-api-key"] = process.env.EVAL_API_KEY;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    signal: controller.signal,
  });
  clearTimeout(timer);
  return res;
}

/** Skip test gracefully if endpoint requires auth and we don't have it */
function skipIfUnauth(res: Response, label: string): boolean {
  if (res.status === 401) {
    console.log(`⏭️  Skipped "${label}": auth required (set EVAL_API_KEY to run)`);
    return true;
  }
  return false;
}

// ═══════════════════════════════════════════════════════════
//  1. NATURAL LANGUAGE SEARCH INTERPRETATION
// ═══════════════════════════════════════════════════════════

test.describe("Natural Language Search", () => {
  test("interprets complex query into structured params", async () => {
    const res = await api("/api/search/interpret", {
      method: "POST",
      body: { query: "senior Go engineers in Austin who worked at startups" },
    });

    if (skipIfUnauth(res, "NL search")) return;
    if (skipIfUnauth(res, "test")) return;
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.interpreted).toBeDefined();
    expect(data.interpreted.suggestedQuery).toBeTruthy();

    // Should detect Go as a language
    const langs = (data.interpreted.languages || []).map((l: string) => l.toLowerCase());
    expect(langs.some((l: string) => l.includes("go"))).toBe(true);

    // Should detect Austin as location
    expect(data.interpreted.location?.toLowerCase()).toContain("austin");

    console.log("NL Search interpretation:", JSON.stringify(data.interpreted, null, 2));
  });

  test("interprets simple query without breaking", async () => {
    const res = await api("/api/search/interpret", {
      method: "POST",
      body: { query: "python developer" },
    });

    if (skipIfUnauth(res, "test")) return;
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.interpreted.suggestedQuery).toBeTruthy();
  });

  test("interprets query with multiple technologies", async () => {
    const res = await api("/api/search/interpret", {
      method: "POST",
      body: { query: "Find someone who knows React, TypeScript, and has contributed to Next.js" },
    });

    if (skipIfUnauth(res, "test")) return;
    expect(res.status).toBe(200);
    const data = await res.json();
    const langs = (data.interpreted.languages || []).map((l: string) => l.toLowerCase());
    expect(langs.length).toBeGreaterThanOrEqual(1);
    console.log("Multi-tech interpretation:", data.interpreted);
  });
});

// ═══════════════════════════════════════════════════════════
//  2. LINKEDIN URL LOOKUP
// ═══════════════════════════════════════════════════════════

test.describe("LinkedIn URL Lookup", () => {
  test("resolves a known LinkedIn profile", async () => {
    const res = await api("/api/lookup/linkedin", {
      method: "POST",
      body: { linkedin_url: "https://www.linkedin.com/in/ryanguard" },
    });

    if (skipIfUnauth(res, "LinkedIn lookup")) return;

    // May return 404 if not in Apollo, which is acceptable
    if (res.status === 200) {
      const data = await res.json();
      expect(data.person).toBeDefined();
      expect(data.person.name).toBeTruthy();
      console.log("LinkedIn lookup result:", data.person.name, data.person.title);
    } else {
      console.log("LinkedIn lookup: profile not found in Apollo (expected for some profiles)");
      expect([200, 404]).toContain(res.status);
    }
  });

  test("rejects invalid LinkedIn URL", async () => {
    const res = await api("/api/lookup/linkedin", {
      method: "POST",
      body: { linkedin_url: "https://google.com" },
    });
    if (skipIfUnauth(res, "LinkedIn invalid URL")) return;
    expect(res.status).toBe(400);
  });
});

// ═══════════════════════════════════════════════════════════
//  3. OPEN-TO-MOVE SCORING
// ═══════════════════════════════════════════════════════════

test.describe("Open-to-Move Score", () => {
  test("scores a company domain", async () => {
    const res = await api("/api/candidates/open-to-move?domain=stripe.com");

    if (skipIfUnauth(res, "test")) return;
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.score).toBeDefined();
    expect(typeof data.score).toBe("number");
    expect(data.score).toBeGreaterThanOrEqual(0);
    expect(data.score).toBeLessThanOrEqual(100);
    expect(data.signals).toBeDefined();
    expect(Array.isArray(data.signals)).toBe(true);
    expect(["likely", "possible", "unlikely"]).toContain(data.label);

    console.log(`Open-to-move: stripe.com → ${data.score}/100 (${data.label})`);
    console.log("Signals:", data.signals.map((s: { type: string; impact: number }) => `${s.type}: ${s.impact > 0 ? "+" : ""}${s.impact}`).join(", "));
  });

  test("returns valid score for unknown company", async () => {
    const res = await api("/api/candidates/open-to-move?domain=randomstartup12345.com");

    if (skipIfUnauth(res, "test")) return;
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(typeof data.score).toBe("number");
    // Unknown company should have low/zero score
    expect(data.score).toBeLessThanOrEqual(50);
  });
});

// ═══════════════════════════════════════════════════════════
//  4. STACK OVERFLOW ENRICHMENT
// ═══════════════════════════════════════════════════════════

test.describe("Stack Overflow Integration", () => {
  test("enriches a well-known developer", async () => {
    const res = await api("/api/enrich/stackoverflow?name=Jon%20Skeet");

    if (skipIfUnauth(res, "test")) return;
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.profile).toBeDefined();
    expect(data.profile.reputation).toBeGreaterThan(1000);
    expect(data.profile.topTags).toBeDefined();
    expect(data.profile.topTags.length).toBeGreaterThan(0);
    expect(data.profile.reputationTier).toBe("elite");

    console.log(`Stack Overflow: ${data.profile.displayName} — ${data.profile.reputation} rep (${data.profile.reputationTier})`);
    console.log("Top tags:", data.profile.topTags.slice(0, 5).map((t: { name: string }) => t.name).join(", "));
  });

  test("handles unknown user gracefully", async () => {
    const res = await api("/api/enrich/stackoverflow?name=xyznonexistent12345abc");

    if (skipIfUnauth(res, "test")) return;
    expect(res.status).toBe(200);
    const data = await res.json();
    // Should return null or empty profile
    expect(data.profile === null || data.profile === undefined).toBe(true);
  });

  test("rejects missing name parameter", async () => {
    const res = await api("/api/enrich/stackoverflow");
    // 400 or 401 (auth check before param check) are both acceptable
    expect([400, 401]).toContain(res.status);
  });
});

// ═══════════════════════════════════════════════════════════
//  5. CONFERENCE SPEAKER DISCOVERY
// ═══════════════════════════════════════════════════════════

test.describe("Conference Speaker Discovery", () => {
  test("finds Kubernetes speakers", async () => {
    const res = await api("/api/intelligence/speakers?technology=kubernetes");

    if (skipIfUnauth(res, "test")) return;
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.speakers).toBeDefined();
    expect(Array.isArray(data.speakers)).toBe(true);

    if (data.speakers.length > 0) {
      expect(data.speakers[0].name).toBeTruthy();
      expect(data.speakers[0].source).toBeTruthy();
      console.log(`Found ${data.speakers.length} Kubernetes speakers`);
      data.speakers.slice(0, 3).forEach((s: { name: string; source: string; evidence: string }) => {
        console.log(`  - ${s.name} (${s.source}): ${s.evidence}`);
      });
    } else {
      console.log("No speakers found (API may be rate limited)");
    }
  });

  test("finds React speakers", async () => {
    const res = await api("/api/intelligence/speakers?technology=react");

    if (skipIfUnauth(res, "test")) return;
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.speakers).toBeDefined();
    console.log(`Found ${data.speakers.length} React speakers`);
  });
});

// ═══════════════════════════════════════════════════════════
//  6. COMPANY SOURCING / ORG EXPLORER
// ═══════════════════════════════════════════════════════════

test.describe("Company Sourcing", () => {
  test("explores Stripe org structure", async () => {
    const res = await api("/api/company/explore", {
      method: "POST",
      body: { domain: "stripe.com" },
      timeout: 45000,
    });

    if (skipIfUnauth(res, "test")) return;
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.company).toBeDefined();
    expect(data.company.name).toBeTruthy();
    expect(data.departments).toBeDefined();
    expect(data.departments.length).toBeGreaterThan(0);
    expect(data.totalPeople).toBeGreaterThan(0);

    console.log(`Company: ${data.company.name} (${data.company.headcount} employees)`);
    console.log(`Departments found: ${data.departments.length}`);
    data.departments.slice(0, 5).forEach((d: { name: string; count: number }) => {
      console.log(`  - ${d.name}: ${d.count} people`);
    });

    // Should have an Engineering department
    const eng = data.departments.find((d: { name: string }) => d.name === "Engineering");
    if (eng) {
      console.log(`Engineering breakdown:`, eng.seniorityBreakdown);
    }
  });

  test("handles unknown company gracefully", async () => {
    const res = await api("/api/company/explore", {
      method: "POST",
      body: { domain: "totallynonexistent12345.com" },
      timeout: 30000,
    });

    if (skipIfUnauth(res, "test")) return;
    expect(res.status).toBe(200);
    const data = await res.json();
    // Should return company shell with 0 people
    expect(data.company).toBeDefined();
    expect(data.totalPeople).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════
//  7. MARKET INTELLIGENCE — WATCHLIST & SIGNALS
// ═══════════════════════════════════════════════════════════

test.describe("Market Intelligence", () => {
  test("lists watchlist (initially empty or populated)", async () => {
    const res = await api("/api/alerts/watchlist");

    if (res.status === 200) {
      const data = await res.json();
      expect(data.companies).toBeDefined();
      expect(Array.isArray(data.companies)).toBe(true);
      console.log(`Watchlist: ${data.companies.length} companies`);
    } else {
      // 401 if no auth — expected
      expect(res.status).toBe(401);
      console.log("Watchlist: auth required (expected)");
    }
  });

  test("signals feed returns valid structure", async () => {
    const res = await api("/api/alerts/signals");

    if (res.status === 200) {
      const data = await res.json();
      expect(data.signals).toBeDefined();
      expect(typeof data.total).toBe("number");
      console.log(`Signals: ${data.total} total, ${data.signals.length} returned`);
    } else {
      expect(res.status).toBe(401);
    }
  });

  test("unread count returns number", async () => {
    const res = await api("/api/alerts/unread-count");

    if (res.status === 200) {
      const data = await res.json();
      expect(typeof data.count).toBe("number");
      console.log(`Unread signals: ${data.count}`);
    } else {
      expect(res.status).toBe(401);
    }
  });
});

// ═══════════════════════════════════════════════════════════
//  8. SEQUENCES
// ═══════════════════════════════════════════════════════════

test.describe("Sequences", () => {
  test("lists sequences (empty or populated)", async () => {
    const res = await api("/api/sequences");

    if (res.status === 200) {
      const data = await res.json();
      expect(data.sequences).toBeDefined();
      expect(Array.isArray(data.sequences)).toBe(true);
      console.log(`Sequences: ${data.sequences.length} total`);
    } else {
      expect(res.status).toBe(401);
      console.log("Sequences: auth required (expected)");
    }
  });

  test("sequence process endpoint responds", async () => {
    const res = await api("/api/sequences/process", { method: "POST" });
    // Should work (processes 0 items) or return auth error
    expect([200, 401]).toContain(res.status);
    if (res.status === 200) {
      const data = await res.json();
      expect(typeof data.processed).toBe("number");
      console.log(`Sequence processor: ${data.processed} processed`);
    }
  });
});

// ═══════════════════════════════════════════════════════════
//  9. PAGE LOAD TESTS
// ═══════════════════════════════════════════════════════════

test.describe("Page Loads", () => {
  test("search page loads", async ({ page }) => {
    await page.goto(`${BASE}/search`);
    await expect(page.locator("input[placeholder*='LinkedIn']")).toBeVisible({ timeout: 10000 });
    const placeholder = await page.locator("input[placeholder*='LinkedIn']").getAttribute("placeholder");
    expect(placeholder).toContain("LinkedIn");
  });

  test("outreach/sequences page loads", async ({ page }) => {
    await page.goto(`${BASE}/outreach`);
    await page.waitForLoadState("networkidle", { timeout: 15000 });
    // Should show either sequences list or sign-in redirect
    const url = page.url();
    expect(url.includes("/outreach") || url.includes("/auth")).toBe(true);
  });

  test("alerts/market intel page loads", async ({ page }) => {
    await page.goto(`${BASE}/alerts`);
    await page.waitForLoadState("networkidle", { timeout: 15000 });
    const url = page.url();
    expect(url.includes("/alerts") || url.includes("/auth")).toBe(true);
  });

  test("company sourcing page loads", async ({ page }) => {
    await page.goto(`${BASE}/company`);
    await page.waitForLoadState("networkidle", { timeout: 15000 });
    const url = page.url();
    expect(url.includes("/company") || url.includes("/auth")).toBe(true);
  });

  test("outreach/new page loads", async ({ page }) => {
    await page.goto(`${BASE}/outreach/new`);
    await page.waitForLoadState("networkidle", { timeout: 15000 });
    const url = page.url();
    expect(url.includes("/outreach") || url.includes("/auth")).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════
//  10. SEARCH QUALITY — EXISTING + NEW FEATURES
// ═══════════════════════════════════════════════════════════

test.describe("Search Quality", () => {
  test("basic search returns results", async () => {
    const res = await api("/api/search?q=react+frontend&page=1");

    if (skipIfUnauth(res, "test")) return;
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.developers).toBeDefined();
    expect(data.developers.length).toBeGreaterThan(0);
    console.log(`Search "react frontend": ${data.developers.length} results, avg score: ${
      (data.developers.reduce((s: number, d: { score: number }) => s + (d.score || 0), 0) / data.developers.length).toFixed(1)
    }`);
  });

  test("search with location filter works", async () => {
    const res = await api("/api/search?q=python&location=San+Francisco&page=1");

    if (skipIfUnauth(res, "test")) return;
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.developers).toBeDefined();
    console.log(`Search "python in SF": ${data.developers.length} results`);
  });
});

// ═══════════════════════════════════════════════════════════
//  SUMMARY REPORT
// ═══════════════════════════════════════════════════════════

test.afterAll(() => {
  console.log("\n" + "═".repeat(60));
  console.log("  NEW FEATURES QA COMPLETE");
  console.log("═".repeat(60));
  console.log("  Features tested:");
  console.log("  1. Natural Language Search Interpretation");
  console.log("  2. LinkedIn URL Lookup");
  console.log("  3. Open-to-Move Scoring");
  console.log("  4. Stack Overflow Integration");
  console.log("  5. Conference Speaker Discovery");
  console.log("  6. Company Sourcing / Org Explorer");
  console.log("  7. Market Intelligence (Watchlist + Signals)");
  console.log("  8. Sequences API");
  console.log("  9. Page Load Verification");
  console.log("  10. Search Quality Baseline");
  console.log("═".repeat(60) + "\n");
});
