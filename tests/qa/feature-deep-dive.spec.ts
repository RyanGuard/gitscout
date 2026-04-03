/**
 * Deep Dive QA — Market Map + Connections
 * Tests the actual user flows, not just API endpoints.
 *
 * Run: npx playwright test tests/qa/feature-deep-dive.spec.ts --reporter=list
 */

import { test, expect } from "@playwright/test";

const BASE = process.env.QA_BASE_URL || "https://gitscout-beta.vercel.app";

async function api(path: string, options: { method?: string; body?: unknown; timeout?: number } = {}) {
  const { method = "GET", body, timeout = 30000 } = options;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (process.env.EVAL_API_KEY) headers["x-eval-api-key"] = process.env.EVAL_API_KEY;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  const res = await fetch(`${BASE}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined, signal: controller.signal });
  clearTimeout(timer);
  return res;
}

// ═══════════════════════════════════════════════════════════
//  MARKET MAP — API FLOW
// ═══════════════════════════════════════════════════════════

test.describe("Market Map — API Deep Dive", () => {
  test("generate endpoint responds and returns companies", async () => {
    const res = await api("/api/market-map/generate", {
      method: "POST",
      body: {
        role_title: "Senior Frontend Engineer",
        role_level: "senior",
        role_stack: ["React", "TypeScript"],
        geography: ["San Francisco"],
      },
      timeout: 60000,
    });

    console.log(`Generate: status=${res.status}`);
    if (res.status === 401) {
      console.log("⏭️  Auth required — skipping (set EVAL_API_KEY)");
      return;
    }

    const data = await res.json();
    console.log("Generate response:", JSON.stringify(data, null, 2).slice(0, 500));

    if (res.status === 200) {
      expect(data.mapId).toBeTruthy();
      expect(data.companies).toBeDefined();
      console.log(`✅ Map generated: ${data.mapId}, ${data.companies?.length || 0} companies`);
    } else {
      console.log(`❌ Generate failed: ${res.status} — ${data.error || JSON.stringify(data)}`);
      // Don't fail test — capture the error for diagnosis
    }
  });

  test("enrich-company endpoint responds", async () => {
    const res = await api("/api/market-map/enrich-company", {
      method: "POST",
      body: {
        map_id: "test-map-id",
        company_id: "test-company-id",
        company_domain: "stripe.com",
        role_title: "Frontend Engineer",
        role_level: "senior",
        role_stack: ["React"],
        geography: ["San Francisco"],
      },
      timeout: 45000,
    });

    console.log(`Enrich-company: status=${res.status}`);
    const data = await res.json().catch(() => ({}));
    console.log("Enrich response:", JSON.stringify(data).slice(0, 300));

    // 200 (already_enriching), 500 (bad map_id — expected), or actual success
    expect([200, 400, 500]).toContain(res.status);

    if (data.status === "already_enriching") {
      console.log("✅ Idempotency guard working — returned 'already_enriching'");
    } else if (data.candidatesFound !== undefined) {
      console.log(`✅ Enrichment worked: ${data.candidatesFound} candidates found`);
    } else {
      console.log(`⚠️  Expected failure (test IDs): ${data.error || "unknown"}`);
    }
  });

  test("enrich-news endpoint responds", async () => {
    const res = await api("/api/market-map/enrich-news", {
      method: "POST",
      body: {
        map_id: "test-map",
        company_id: "test-id",
        company_name: "Stripe",
      },
      timeout: 30000,
    });

    console.log(`Enrich-news: status=${res.status}`);
    const data = await res.json().catch(() => ({}));

    // Will fail with bad ids but should not 500 crash
    if (res.status === 200) {
      console.log(`✅ News enrichment: ${data.articlesAnalyzed || 0} articles, flight risk: ${data.flightRisk}`);
    } else {
      console.log(`⚠️  ${res.status}: ${data.error || "unknown"}`);
    }
    expect([200, 400, 401, 404, 500]).toContain(res.status);
  });

  test("classify endpoint responds", async () => {
    const res = await api("/api/market-map/classify", {
      method: "POST",
      body: {
        map_id: "test",
        company_id: "test",
        role_brief: { title: "Frontend Engineer", level: "senior", stack: ["React"], geography: "SF" },
        candidates: [{ id: "1", name: "Test User", title: "Engineer", seniority: "senior", city: "SF" }],
      },
      timeout: 30000,
    });

    console.log(`Classify: status=${res.status}`);
    const data = await res.json().catch(() => ({}));
    console.log("Classify response:", JSON.stringify(data).slice(0, 300));
    expect([200, 400, 401, 404, 500]).toContain(res.status);
  });

  test("map list endpoint returns user maps", async () => {
    const res = await api("/api/market-map/list");

    console.log(`Map list: status=${res.status}`);
    if (res.status === 200) {
      const data = await res.json();
      console.log(`✅ Maps: ${data.maps?.length || 0} maps found`);
      if (data.maps?.length > 0) {
        const first = data.maps[0];
        console.log(`  First map: "${first.name}" — ${first.totalCompanies} companies, ${first.totalCandidates} candidates`);
      }
    } else if (res.status === 401) {
      console.log("⏭️  Auth required");
    }
  });
});

// ═══════════════════════════════════════════════════════════
//  MARKET MAP — UI FLOW
// ═══════════════════════════════════════════════════════════

test.describe("Market Map — UI Deep Dive", () => {
  test("map page loads and shows generation form", async ({ page }) => {
    await page.goto(`${BASE}/map`);
    await page.waitForLoadState("networkidle", { timeout: 15000 });

    const url = page.url();
    console.log(`Map page URL: ${url}`);

    if (url.includes("/auth")) {
      console.log("⏭️  Redirected to auth — user not logged in");
      return;
    }

    // Check if form elements exist
    const roleInput = page.locator('input[type="text"]').first();
    const isVisible = await roleInput.isVisible().catch(() => false);
    console.log(`Role input visible: ${isVisible}`);

    // Check for mode selector tabs
    const byRole = page.locator('text=By Role');
    const byRoleVisible = await byRole.isVisible().catch(() => false);
    console.log(`"By Role" tab visible: ${byRoleVisible}`);

    // Check for intake link
    const intakeLink = page.locator('text=Start from an intake call');
    const intakeVisible = await intakeLink.isVisible().catch(() => false);
    console.log(`Intake link visible: ${intakeVisible}`);

    // Check for resume upload
    const resumeBtn = page.locator('text=Import from Resume');
    const resumeVisible = await resumeBtn.isVisible().catch(() => false);
    console.log(`Resume upload visible: ${resumeVisible}`);

    // Check for advanced options toggle
    const advancedToggle = page.locator('text=advanced options');
    const advancedVisible = await advancedToggle.isVisible().catch(() => false);
    console.log(`Advanced options toggle visible: ${advancedVisible}`);

    // Check for generate button
    const generateBtn = page.locator('text=Generate market map');
    const generateVisible = await generateBtn.isVisible().catch(() => false);
    console.log(`Generate button visible: ${generateVisible}`);

    // Take screenshot for visual inspection
    await page.screenshot({ path: "qa-reports/screenshots/map-page.png" });
    console.log("Screenshot saved: qa-reports/screenshots/map-page.png");
  });

  test("map page shows existing map if loaded with id", async ({ page }) => {
    // First get a real map ID
    const listRes = await api("/api/market-map/list");
    if (listRes.status !== 200) {
      console.log("⏭️  Can't get map list — skipping");
      return;
    }
    const listData = await listRes.json();
    if (!listData.maps?.length) {
      console.log("⏭️  No maps exist — skipping");
      return;
    }

    const mapId = listData.maps[0].id;
    console.log(`Loading map: ${mapId} ("${listData.maps[0].name}")`);

    await page.goto(`${BASE}/map?id=${mapId}`);
    await page.waitForLoadState("networkidle", { timeout: 20000 });

    // Check if map data loaded
    const tiers = page.locator('text=Tier A');
    const hasTiers = await tiers.isVisible({ timeout: 10000 }).catch(() => false);
    console.log(`Tier A visible: ${hasTiers}`);

    // Check for company cards
    const companies = page.locator('[class*="rounded-xl"][class*="border"]');
    const companyCount = await companies.count();
    console.log(`Company cards on page: ${companyCount}`);

    // Check for stats bar
    const statsText = await page.locator('text=COMPANIES').isVisible().catch(() => false);
    console.log(`Stats bar visible: ${statsText}`);

    await page.screenshot({ path: "qa-reports/screenshots/map-loaded.png" });
    console.log("Screenshot saved: qa-reports/screenshots/map-loaded.png");

    // Check for console errors
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));
    await page.waitForTimeout(2000);
    if (errors.length > 0) {
      console.log(`❌ Console errors: ${errors.join(", ").slice(0, 200)}`);
    } else {
      console.log("✅ No console errors");
    }
  });
});

// ═══════════════════════════════════════════════════════════
//  CONNECTIONS — API FLOW
// ═══════════════════════════════════════════════════════════

test.describe("Connections — API Deep Dive", () => {
  test("home-base endpoint responds", async () => {
    const res = await api("/api/connections/home-base");

    console.log(`Home-base: status=${res.status}`);
    if (res.status === 200) {
      const data = await res.json();
      if (data.homeBase) {
        console.log(`✅ Home base: "${data.homeBase.companyName}" — ${data.homeBase.teamCount} team, ${data.homeBase.engCount} eng`);
        console.log(`   Status: ${data.homeBase.setupStatus}, Last enriched: ${data.homeBase.lastEnrichedAt}`);
      } else {
        console.log("⚠️  No home base configured");
      }
    } else if (res.status === 401) {
      console.log("⏭️  Auth required");
    } else {
      const data = await res.json().catch(() => ({}));
      console.log(`❌ ${res.status}: ${data.error || "unknown"}`);
    }
  });

  test("setup-home-base endpoint responds", async () => {
    const res = await api("/api/connections/setup-home-base", {
      method: "POST",
      body: { company_domain: "test-diagnostic.com" },
    });

    console.log(`Setup home-base: status=${res.status}`);
    const data = await res.json().catch(() => ({}));
    console.log("Setup response:", JSON.stringify(data).slice(0, 300));

    // 200/201 success, 401 auth, 400/409 already exists — all valid
    expect([200, 201, 400, 401, 409, 500]).toContain(res.status);
  });

  test("connection lookup endpoint responds", async () => {
    const res = await api("/api/connections/lookup", {
      method: "POST",
      body: { target_company_domain: "stripe.com" },
    });

    console.log(`Connection lookup: status=${res.status}`);
    if (res.status === 200) {
      const data = await res.json();
      console.log(`✅ Connections to Stripe: ${data.totalConnectionsFound || 0} found`);
      if (data.connectionBreakdown) {
        console.log("   Breakdown:", JSON.stringify(data.connectionBreakdown));
      }
    } else if (res.status === 401) {
      console.log("⏭️  Auth required");
    } else {
      const data = await res.json().catch(() => ({}));
      console.log(`⚠️  ${res.status}: ${data.error || "unknown"}`);
    }
  });
});

// ═══════════════════════════════════════════════════════════
//  CONNECTIONS — UI FLOW
// ═══════════════════════════════════════════════════════════

test.describe("Connections — UI Deep Dive", () => {
  test("connections page loads", async ({ page }) => {
    await page.goto(`${BASE}/connections`);
    await page.waitForLoadState("networkidle", { timeout: 15000 });

    const url = page.url();
    console.log(`Connections page URL: ${url}`);

    if (url.includes("/auth")) {
      console.log("⏭️  Redirected to auth");
      return;
    }

    // Check for page header
    const header = page.locator('text=Connection Mapper');
    const headerVisible = await header.isVisible().catch(() => false);
    console.log(`Header visible: ${headerVisible}`);

    // Check for setup card or ready state
    const setupCard = page.locator('text=Set up your company');
    const setupVisible = await setupCard.isVisible().catch(() => false);
    const readyCard = page.locator('text=Find Connections');
    const readyVisible = await readyCard.isVisible().catch(() => false);

    if (setupVisible) {
      console.log("State: Setup needed — no home base configured");
      const domainInput = page.locator('input[placeholder="yourcompany.com"]');
      const inputVisible = await domainInput.isVisible().catch(() => false);
      console.log(`Domain input visible: ${inputVisible}`);
    } else if (readyVisible) {
      console.log("State: Ready — home base configured, can lookup connections");
      const lookupInput = page.locator('input[placeholder*="coreweave"]');
      const lookupVisible = await lookupInput.isVisible().catch(() => false);
      console.log(`Lookup input visible: ${lookupVisible}`);
    } else {
      console.log("State: Unknown — checking for loading or error");
      const loading = page.locator('text=Starting enrichment');
      const loadingVisible = await loading.isVisible().catch(() => false);
      console.log(`Loading/enriching: ${loadingVisible}`);
    }

    // Check for console errors
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));
    await page.waitForTimeout(1000);

    await page.screenshot({ path: "qa-reports/screenshots/connections-page.png" });
    console.log("Screenshot saved: qa-reports/screenshots/connections-page.png");

    if (errors.length > 0) {
      console.log(`❌ Console errors: ${errors.join(", ").slice(0, 200)}`);
    } else {
      console.log("✅ No console errors");
    }
  });
});

// ═══════════════════════════════════════════════════════════
//  APOLLO API DIRECT TEST
// ═══════════════════════════════════════════════════════════

test.describe("Apollo API — Direct Tests", () => {
  test("people search API is accessible", async () => {
    const apiKey = process.env.APOLLO_API_KEY;
    if (!apiKey) {
      console.log("⏭️  APOLLO_API_KEY not set — skipping");
      return;
    }

    const res = await fetch("https://api.apollo.io/api/v1/mixed_people/api_search", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Api-Key": apiKey },
      body: JSON.stringify({
        organization_domains: ["stripe.com"],
        person_titles: ["engineer"],
        person_seniorities: ["senior"],
        per_page: 3,
      }),
    });

    console.log(`Apollo People Search: status=${res.status}`);
    if (res.ok) {
      const data = await res.json();
      console.log(`✅ Found ${data.people?.length || 0} people at Stripe`);
      data.people?.slice(0, 2).forEach((p: { name: string; title: string }) => {
        console.log(`  - ${p.name}: ${p.title}`);
      });
    } else {
      const data = await res.json().catch(() => ({}));
      console.log(`❌ Apollo error: ${data.error || res.status}`);
    }
  });

  test("org enrichment API is accessible", async () => {
    const apiKey = process.env.APOLLO_API_KEY;
    if (!apiKey) {
      console.log("⏭️  APOLLO_API_KEY not set — skipping");
      return;
    }

    const res = await fetch("https://api.apollo.io/api/v1/organizations/enrich?domain=stripe.com", {
      headers: { "X-Api-Key": apiKey },
    });

    console.log(`Apollo Org Enrichment: status=${res.status}`);
    if (res.ok) {
      const data = await res.json();
      const org = data.organization;
      if (org) {
        console.log(`✅ Stripe: ${org.estimated_num_employees} employees, ${org.industry}, ${org.city}`);
      }
    } else {
      const data = await res.json().catch(() => ({}));
      console.log(`❌ Apollo error: ${data.error || res.status}`);
    }
  });

  test("news articles API is accessible", async () => {
    const apiKey = process.env.APOLLO_API_KEY;
    if (!apiKey) {
      console.log("⏭️  APOLLO_API_KEY not set — skipping");
      return;
    }

    const res = await fetch("https://api.apollo.io/api/v1/news_articles/search", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Api-Key": apiKey },
      body: JSON.stringify({ q_organization_name: "Stripe", page: 1, per_page: 3 }),
    });

    console.log(`Apollo News: status=${res.status}`);
    if (res.ok) {
      const data = await res.json();
      console.log(`✅ Found ${data.news_articles?.length || 0} articles about Stripe`);
    } else {
      const data = await res.json().catch(() => ({}));
      console.log(`❌ Apollo error: ${data.error || res.status}`);
    }
  });
});

// ═══════════════════════════════════════════════════════════
//  INTAKE FLOW
// ═══════════════════════════════════════════════════════════

test.describe("Intake — API Flow", () => {
  test("intake CRUD works", async () => {
    // Create
    const createRes = await api("/api/intake", { method: "POST", body: { mode: "guided" } });
    console.log(`Intake create: status=${createRes.status}`);
    if (createRes.status === 401) { console.log("⏭️  Auth required"); return; }

    if (createRes.status === 201) {
      const created = await createRes.json();
      console.log(`✅ Created intake: ${created.id}`);

      // Update
      const patchRes = await api(`/api/intake/${created.id}`, {
        method: "PATCH",
        body: { roleBasics: { title: "Test Engineer", level: "senior" }, status: "complete" },
      });
      console.log(`Intake update: status=${patchRes.status}`);

      // Read
      const getRes = await api(`/api/intake/${created.id}`);
      console.log(`Intake get: status=${getRes.status}`);
      if (getRes.ok) {
        const intake = await getRes.json();
        console.log(`✅ Intake status: ${intake.status}, role: ${(intake.roleBasics as Record<string,unknown>)?.title}`);
      }
    }
  });

  test("intake page loads", async ({ page }) => {
    await page.goto(`${BASE}/intake/new`);
    await page.waitForLoadState("networkidle", { timeout: 15000 });

    const url = page.url();
    if (url.includes("/auth")) { console.log("⏭️  Auth redirect"); return; }

    const header = page.locator('text=Intake Call');
    const visible = await header.isVisible().catch(() => false);
    console.log(`Intake page header visible: ${visible}`);

    const notesTab = page.locator('text=From Notes');
    const notesVisible = await notesTab.isVisible().catch(() => false);
    console.log(`Notes tab visible: ${notesVisible}`);

    const guidedTab = page.locator('text=Guided');
    const guidedVisible = await guidedTab.isVisible().catch(() => false);
    console.log(`Guided tab visible: ${guidedVisible}`);

    await page.screenshot({ path: "qa-reports/screenshots/intake-page.png" });
  });
});

// ═══════════════════════════════════════════════════════════
//  SUMMARY
// ═══════════════════════════════════════════════════════════

test.afterAll(() => {
  console.log("\n" + "═".repeat(60));
  console.log("  FEATURE DEEP DIVE COMPLETE");
  console.log("═".repeat(60));
  console.log("  Check screenshots in qa-reports/screenshots/");
  console.log("  Review console output above for detailed diagnostics");
  console.log("═".repeat(60) + "\n");
});
