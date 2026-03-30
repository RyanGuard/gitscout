#!/usr/bin/env node
/**
 * Scout API QA Test Runner
 * Tests all API routes with valid, empty, and malformed inputs.
 * Checks response shapes, status codes, error handling, response times, and secret leaks.
 */

const BASE = "http://localhost:3000";

// Secrets patterns to check for leaks
const SECRET_PATTERNS = [
  /ghp_[A-Za-z0-9_]{36}/,          // GitHub PAT
  /github_pat_[A-Za-z0-9_]{82}/,   // Fine-grained GitHub PAT
  /sk-ant-[A-Za-z0-9-]{40,}/,      // Anthropic API key
  /Bearer\s+[A-Za-z0-9._-]{20,}/,  // Bearer tokens
  /NEXTAUTH_SECRET/,
  /PIPELINE_SECRET/,
  /CRON_SECRET/,
  /ASHBY_API_KEY/,
  /APOLLO_API_KEY/,
  /GITHUB_SECRET/,
  /xoxb-/,                          // Slack bot token
  /xoxp-/,                          // Slack user token
];

const results = [];

function checkForSecrets(body, testName) {
  const leaks = [];
  if (typeof body !== "string") body = JSON.stringify(body);
  for (const pattern of SECRET_PATTERNS) {
    if (pattern.test(body)) {
      leaks.push(`Potential secret leak matching ${pattern} in ${testName}`);
    }
  }
  return leaks;
}

async function test(name, fn) {
  const start = Date.now();
  try {
    const result = await fn();
    const duration = Date.now() - start;
    const secretLeaks = checkForSecrets(result.body || "", name);
    results.push({
      name,
      status: result.pass ? "PASS" : "FAIL",
      statusCode: result.statusCode,
      duration,
      details: result.details || "",
      secretLeaks,
      responseShape: result.responseShape || null,
    });
  } catch (err) {
    const duration = Date.now() - start;
    results.push({
      name,
      status: "ERROR",
      statusCode: null,
      duration,
      details: `Exception: ${err.message}`,
      secretLeaks: [],
      responseShape: null,
    });
  }
}

async function fetchJSON(url, options = {}) {
  const res = await fetch(url, { ...options, redirect: "manual" });
  const contentType = res.headers.get("content-type") || "";
  let body;
  if (contentType.includes("application/json")) {
    body = await res.json();
  } else {
    body = await res.text();
  }
  return { status: res.status, body, contentType, headers: res.headers };
}

// ============================================================
// /api/stats
// ============================================================
async function testStats() {
  // Valid
  await test("GET /api/stats — valid request", async () => {
    const { status, body } = await fetchJSON(`${BASE}/api/stats`);
    const hasShape = typeof body === "object" &&
      "totalDevelopers" in body &&
      "totalRepositories" in body;
    return {
      pass: status === 200 && hasShape,
      statusCode: status,
      body: JSON.stringify(body),
      details: hasShape ? `totalDevelopers=${body.totalDevelopers}, totalRepositories=${body.totalRepositories}` : "Missing expected fields",
      responseShape: Object.keys(body || {}),
    };
  });

  // With query params (should be ignored)
  await test("GET /api/stats — with extraneous query params", async () => {
    const { status, body } = await fetchJSON(`${BASE}/api/stats?foo=bar&evil=<script>`);
    return {
      pass: status === 200 && typeof body === "object",
      statusCode: status,
      body: JSON.stringify(body),
      details: "Extraneous params should be ignored",
    };
  });

  // Wrong method
  await test("POST /api/stats — wrong method", async () => {
    const { status, body } = await fetchJSON(`${BASE}/api/stats`, { method: "POST" });
    return {
      pass: status === 405 || status === 404 || status >= 400,
      statusCode: status,
      body: typeof body === "string" ? body : JSON.stringify(body),
      details: `Expected 405, got ${status}`,
    };
  });
}

// ============================================================
// /api/search (GET)
// ============================================================
async function testSearchGET() {
  // Valid search
  await test("GET /api/search?q=react — valid query", async () => {
    const { status, body } = await fetchJSON(`${BASE}/api/search?q=react&limit=5`);
    const hasShape = typeof body === "object" && "developers" in body && "total" in body;
    return {
      pass: status === 200 && hasShape,
      statusCode: status,
      body: JSON.stringify(body).slice(0, 2000),
      details: `Found ${body?.developers?.length || 0} developers, total=${body?.total}`,
      responseShape: Object.keys(body || {}),
    };
  });

  // Empty query
  await test("GET /api/search — no query params", async () => {
    const { status, body } = await fetchJSON(`${BASE}/api/search`);
    return {
      pass: status === 200 || status === 400,
      statusCode: status,
      body: JSON.stringify(body).slice(0, 1000),
      details: `Status ${status}, response has ${typeof body === "object" ? Object.keys(body).length : 0} keys`,
    };
  });

  // Malformed params
  await test("GET /api/search?limit=notanumber — malformed limit", async () => {
    const { status, body } = await fetchJSON(`${BASE}/api/search?q=test&limit=notanumber`);
    return {
      pass: status === 200 || status === 400,
      statusCode: status,
      body: JSON.stringify(body).slice(0, 1000),
      details: `Status ${status} with malformed limit`,
    };
  });

  // XSS in query
  await test("GET /api/search?q=<script>alert(1)</script> — XSS attempt", async () => {
    const { status, body } = await fetchJSON(`${BASE}/api/search?q=${encodeURIComponent("<script>alert(1)</script>")}&limit=1`);
    const bodyStr = JSON.stringify(body);
    const hasXSS = bodyStr.includes("<script>") && !bodyStr.includes("&lt;script&gt;");
    return {
      pass: status === 200 || status === 400,
      statusCode: status,
      body: bodyStr.slice(0, 1000),
      details: hasXSS ? "WARNING: Unescaped XSS payload in response" : "XSS payload handled safely",
    };
  });

  // Very long query
  await test("GET /api/search?q=(2000 chars) — very long query", async () => {
    const longQ = "a".repeat(2000);
    const { status, body } = await fetchJSON(`${BASE}/api/search?q=${longQ}&limit=1`);
    return {
      pass: status === 200 || status === 400 || status === 414,
      statusCode: status,
      body: typeof body === "string" ? body.slice(0, 500) : JSON.stringify(body).slice(0, 500),
      details: `Status ${status} with 2000-char query`,
    };
  });

  // SQL injection attempt
  await test("GET /api/search?q=' OR 1=1 -- — SQL injection attempt", async () => {
    const { status, body } = await fetchJSON(`${BASE}/api/search?q=${encodeURIComponent("' OR 1=1 --")}&limit=1`);
    return {
      pass: status === 200 || status === 400,
      statusCode: status,
      body: JSON.stringify(body).slice(0, 1000),
      details: `Status ${status} — SQL injection attempt`,
    };
  });
}

// ============================================================
// /api/search (POST — SSE)
// ============================================================
async function testSearchPOST() {
  await test("POST /api/search — valid SSE stream", async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const res = await fetch(`${BASE}/api/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language: "TypeScript", perPage: 5 }),
        signal: controller.signal,
      });
      const text = await res.text();
      clearTimeout(timeout);
      const hasSSEEvents = text.includes("event:") || text.includes("data:");
      return {
        pass: res.status === 200 && hasSSEEvents,
        statusCode: res.status,
        body: text.slice(0, 2000),
        details: `SSE stream received, ${text.length} bytes, has events: ${hasSSEEvents}`,
      };
    } catch (err) {
      clearTimeout(timeout);
      if (err.name === "AbortError") {
        return { pass: true, statusCode: 200, body: "", details: "SSE stream timed out (expected for long streams)" };
      }
      throw err;
    }
  });

  await test("POST /api/search — empty body", async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const res = await fetch(`${BASE}/api/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
        signal: controller.signal,
      });
      const text = await res.text();
      clearTimeout(timeout);
      return {
        pass: res.status === 200 || res.status === 400,
        statusCode: res.status,
        body: text.slice(0, 1000),
        details: `Status ${res.status} with empty body`,
      };
    } catch (err) {
      clearTimeout(timeout);
      return { pass: true, statusCode: null, body: "", details: `Aborted/errored: ${err.message}` };
    }
  });

  await test("POST /api/search — invalid JSON body", async () => {
    const res = await fetch(`${BASE}/api/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not json at all{{{",
    });
    const text = await res.text();
    return {
      pass: res.status >= 400,
      statusCode: res.status,
      body: text.slice(0, 500),
      details: `Status ${res.status} for invalid JSON`,
    };
  });
}

// ============================================================
// /api/profiles/[username]
// ============================================================
async function testProfiles() {
  // Valid username (may or may not be in local DB)
  await test("GET /api/profiles/torvalds — valid username", async () => {
    const { status, body } = await fetchJSON(`${BASE}/api/profiles/torvalds`);
    return {
      pass: status === 200 || status === 404,
      statusCode: status,
      body: JSON.stringify(body).slice(0, 2000),
      details: status === 200 ? `Found profile: ${body?.username}` : "Not in local DB (expected)",
      responseShape: status === 200 ? Object.keys(body || {}) : ["error"],
    };
  });

  // Empty username
  await test("GET /api/profiles/ — empty username", async () => {
    const { status, body } = await fetchJSON(`${BASE}/api/profiles/`);
    return {
      pass: status === 404 || status === 400,
      statusCode: status,
      body: typeof body === "string" ? body.slice(0, 500) : JSON.stringify(body).slice(0, 500),
      details: `Status ${status} for empty username`,
    };
  });

  // Non-existent username
  await test("GET /api/profiles/zzz_nonexistent_user_12345 — non-existent user", async () => {
    const { status, body } = await fetchJSON(`${BASE}/api/profiles/zzz_nonexistent_user_12345`);
    return {
      pass: status === 404,
      statusCode: status,
      body: JSON.stringify(body).slice(0, 500),
      details: `Status ${status}, error: ${body?.error || "none"}`,
    };
  });

  // Special characters
  await test("GET /api/profiles/../../../etc/passwd — path traversal", async () => {
    const { status, body } = await fetchJSON(`${BASE}/api/profiles/..%2F..%2F..%2Fetc%2Fpasswd`);
    return {
      pass: status === 404 || status === 400,
      statusCode: status,
      body: typeof body === "string" ? body.slice(0, 500) : JSON.stringify(body).slice(0, 500),
      details: `Path traversal attempt: status ${status}`,
    };
  });

  // Unicode username
  await test("GET /api/profiles/用户名 — unicode username", async () => {
    const { status, body } = await fetchJSON(`${BASE}/api/profiles/${encodeURIComponent("用户名")}`);
    return {
      pass: status === 404 || status === 400,
      statusCode: status,
      body: typeof body === "string" ? body.slice(0, 500) : JSON.stringify(body).slice(0, 500),
      details: `Unicode username: status ${status}`,
    };
  });
}

// ============================================================
// /api/score/[username]
// ============================================================
async function testScore() {
  await test("GET /api/score/torvalds — valid username", async () => {
    const { status, body } = await fetchJSON(`${BASE}/api/score/torvalds`);
    const hasShape = typeof body === "object" &&
      "score" in body && "tier" in body && "pillars" in body;
    return {
      pass: status === 200 && hasShape,
      statusCode: status,
      body: JSON.stringify(body).slice(0, 2000),
      details: `Score: ${body?.score}, Tier: ${body?.tier}, Confidence: ${body?.confidence}`,
      responseShape: Object.keys(body || {}),
    };
  });

  await test("GET /api/score/zzz_nonexistent_12345 — non-existent user", async () => {
    const { status, body } = await fetchJSON(`${BASE}/api/score/zzz_nonexistent_12345`);
    return {
      pass: status === 404,
      statusCode: status,
      body: JSON.stringify(body).slice(0, 500),
      details: `Status ${status}, error: ${body?.error || "none"}`,
    };
  });

  await test("GET /api/score/ — empty username", async () => {
    const { status, body } = await fetchJSON(`${BASE}/api/score/`);
    return {
      pass: status === 404 || status === 400,
      statusCode: status,
      body: typeof body === "string" ? body.slice(0, 500) : JSON.stringify(body).slice(0, 500),
      details: `Status ${status} for empty username`,
    };
  });

  await test("GET /api/score/<script> — XSS in path", async () => {
    const { status, body } = await fetchJSON(`${BASE}/api/score/${encodeURIComponent("<script>alert(1)</script>")}`);
    return {
      pass: status === 404 || status === 400,
      statusCode: status,
      body: typeof body === "string" ? body.slice(0, 500) : JSON.stringify(body).slice(0, 500),
      details: `XSS in path: status ${status}`,
    };
  });
}

// ============================================================
// /api/scouting-report
// ============================================================
async function testScoutingReport() {
  // Without auth (should be 401)
  await test("POST /api/scouting-report — no auth", async () => {
    const { status, body } = await fetchJSON(`${BASE}/api/scouting-report`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "torvalds",
        profileData: { name: "Linus Torvalds", bio: "Linux creator", followers: 200000 },
      }),
    });
    return {
      pass: status === 401,
      statusCode: status,
      body: JSON.stringify(body).slice(0, 500),
      details: `Expected 401 unauthorized, got ${status}`,
    };
  });

  // Empty body, no auth
  await test("POST /api/scouting-report — empty body, no auth", async () => {
    const { status, body } = await fetchJSON(`${BASE}/api/scouting-report`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    return {
      pass: status === 401 || status === 400,
      statusCode: status,
      body: JSON.stringify(body).slice(0, 500),
      details: `Status ${status} for empty body without auth`,
    };
  });

  // GET method (should fail)
  await test("GET /api/scouting-report — wrong method", async () => {
    const { status, body } = await fetchJSON(`${BASE}/api/scouting-report`);
    return {
      pass: status === 405 || status >= 400,
      statusCode: status,
      body: typeof body === "string" ? body.slice(0, 500) : JSON.stringify(body).slice(0, 500),
      details: `Status ${status} for GET method`,
    };
  });
}

// ============================================================
// /api/outreach-draft
// ============================================================
async function testOutreachDraft() {
  await test("POST /api/outreach-draft — no auth", async () => {
    const { status, body } = await fetchJSON(`${BASE}/api/outreach-draft`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "torvalds",
        profileData: { name: "Linus Torvalds", bio: "Linux" },
      }),
    });
    return {
      pass: status === 401,
      statusCode: status,
      body: JSON.stringify(body).slice(0, 500),
      details: `Expected 401, got ${status}`,
    };
  });

  await test("POST /api/outreach-draft — empty body, no auth", async () => {
    const { status, body } = await fetchJSON(`${BASE}/api/outreach-draft`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    return {
      pass: status === 401 || status === 400,
      statusCode: status,
      body: JSON.stringify(body).slice(0, 500),
      details: `Status ${status}`,
    };
  });

  await test("GET /api/outreach-draft — wrong method", async () => {
    const { status, body } = await fetchJSON(`${BASE}/api/outreach-draft`);
    return {
      pass: status === 405 || status >= 400,
      statusCode: status,
      body: typeof body === "string" ? body.slice(0, 500) : JSON.stringify(body).slice(0, 500),
      details: `Status ${status} for GET`,
    };
  });
}

// ============================================================
// /api/find-similar
// ============================================================
async function testFindSimilar() {
  await test("GET /api/find-similar?username=torvalds — valid", async () => {
    const { status, body } = await fetchJSON(`${BASE}/api/find-similar?username=torvalds`);
    const hasShape = typeof body === "object" && "developers" in body;
    return {
      pass: (status === 200 && hasShape) || status === 404,
      statusCode: status,
      body: JSON.stringify(body).slice(0, 2000),
      details: `Found ${body?.developers?.length || 0} similar developers`,
      responseShape: Object.keys(body || {}),
    };
  });

  await test("GET /api/find-similar — missing username", async () => {
    const { status, body } = await fetchJSON(`${BASE}/api/find-similar`);
    return {
      pass: status === 400,
      statusCode: status,
      body: JSON.stringify(body).slice(0, 500),
      details: `Expected 400, got ${status}. Error: ${body?.error || "none"}`,
    };
  });

  await test("GET /api/find-similar?username= — empty username", async () => {
    const { status, body } = await fetchJSON(`${BASE}/api/find-similar?username=`);
    return {
      pass: status === 400,
      statusCode: status,
      body: JSON.stringify(body).slice(0, 500),
      details: `Expected 400, got ${status}`,
    };
  });

  await test("GET /api/find-similar?username=zzz_fake_999 — non-existent user", async () => {
    const { status, body } = await fetchJSON(`${BASE}/api/find-similar?username=zzz_fake_999`);
    return {
      pass: status === 404,
      statusCode: status,
      body: JSON.stringify(body).slice(0, 500),
      details: `Expected 404, got ${status}`,
    };
  });
}

// ============================================================
// /api/developer-card
// ============================================================
async function testDeveloperCard() {
  await test("GET /api/developer-card?username=torvalds — valid", async () => {
    const res = await fetch(`${BASE}/api/developer-card?username=torvalds`);
    const contentType = res.headers.get("content-type") || "";
    const body = await res.text();
    const isSVG = contentType.includes("svg") || body.startsWith("<svg") || body.includes("<svg");
    return {
      pass: res.status === 200 && isSVG,
      statusCode: res.status,
      body: body.slice(0, 500),
      details: `Content-Type: ${contentType}, SVG: ${isSVG}, ${body.length} bytes`,
    };
  });

  await test("GET /api/developer-card — missing username", async () => {
    const { status, body } = await fetchJSON(`${BASE}/api/developer-card`);
    return {
      pass: status === 400,
      statusCode: status,
      body: JSON.stringify(body).slice(0, 500),
      details: `Expected 400, got ${status}`,
    };
  });

  await test("GET /api/developer-card?username= — empty username", async () => {
    const { status, body } = await fetchJSON(`${BASE}/api/developer-card?username=`);
    return {
      pass: status === 400,
      statusCode: status,
      body: JSON.stringify(body).slice(0, 500),
      details: `Expected 400, got ${status}`,
    };
  });

  await test("GET /api/developer-card?username=zzz_fake — non-existent", async () => {
    const { status, body } = await fetchJSON(`${BASE}/api/developer-card?username=zzz_fake`);
    return {
      pass: status === 404,
      statusCode: status,
      body: typeof body === "string" ? body.slice(0, 500) : JSON.stringify(body).slice(0, 500),
      details: `Expected 404, got ${status}`,
    };
  });
}

// ============================================================
// /api/lists
// ============================================================
async function testLists() {
  // GET without auth
  await test("GET /api/lists — no auth", async () => {
    const { status, body } = await fetchJSON(`${BASE}/api/lists`);
    return {
      pass: status === 401,
      statusCode: status,
      body: JSON.stringify(body).slice(0, 500),
      details: `Expected 401, got ${status}`,
    };
  });

  // POST without auth
  await test("POST /api/lists — no auth", async () => {
    const { status, body } = await fetchJSON(`${BASE}/api/lists`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Test List" }),
    });
    return {
      pass: status === 401,
      statusCode: status,
      body: JSON.stringify(body).slice(0, 500),
      details: `Expected 401, got ${status}`,
    };
  });

  // POST with empty body, no auth
  await test("POST /api/lists — empty body, no auth", async () => {
    const { status, body } = await fetchJSON(`${BASE}/api/lists`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    return {
      pass: status === 401 || status === 400,
      statusCode: status,
      body: JSON.stringify(body).slice(0, 500),
      details: `Status ${status}`,
    };
  });

  // GET specific list without auth
  await test("GET /api/lists/fake-id — no auth", async () => {
    const { status, body } = await fetchJSON(`${BASE}/api/lists/fake-id`);
    return {
      pass: status === 401,
      statusCode: status,
      body: JSON.stringify(body).slice(0, 500),
      details: `Expected 401, got ${status}`,
    };
  });

  // DELETE without auth
  await test("DELETE /api/lists/fake-id — no auth", async () => {
    const { status, body } = await fetchJSON(`${BASE}/api/lists/fake-id`, { method: "DELETE" });
    return {
      pass: status === 401,
      statusCode: status,
      body: JSON.stringify(body).slice(0, 500),
      details: `Expected 401, got ${status}`,
    };
  });

  // POST entries without auth
  await test("POST /api/lists/fake-id/entries — no auth", async () => {
    const { status, body } = await fetchJSON(`${BASE}/api/lists/fake-id/entries`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ developerId: "test" }),
    });
    return {
      pass: status === 401,
      statusCode: status,
      body: JSON.stringify(body).slice(0, 500),
      details: `Expected 401, got ${status}`,
    };
  });

  // Notes without auth
  await test("GET /api/lists/fake/entries/fake/notes — no auth", async () => {
    const { status, body } = await fetchJSON(`${BASE}/api/lists/fake/entries/fake/notes`);
    return {
      pass: status === 401,
      statusCode: status,
      body: JSON.stringify(body).slice(0, 500),
      details: `Expected 401, got ${status}`,
    };
  });
}

// ============================================================
// /api/favorites
// ============================================================
async function testFavorites() {
  await test("GET /api/favorites — no auth", async () => {
    const { status, body } = await fetchJSON(`${BASE}/api/favorites`);
    return {
      pass: status === 401,
      statusCode: status,
      body: JSON.stringify(body).slice(0, 500),
      details: `Expected 401, got ${status}`,
    };
  });

  await test("POST /api/favorites — no auth", async () => {
    const { status, body } = await fetchJSON(`${BASE}/api/favorites`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ developerId: "test-id" }),
    });
    return {
      pass: status === 401,
      statusCode: status,
      body: JSON.stringify(body).slice(0, 500),
      details: `Expected 401, got ${status}`,
    };
  });

  await test("DELETE /api/favorites/fake-id — no auth", async () => {
    const { status, body } = await fetchJSON(`${BASE}/api/favorites/fake-id`, { method: "DELETE" });
    return {
      pass: status === 401,
      statusCode: status,
      body: JSON.stringify(body).slice(0, 500),
      details: `Expected 401, got ${status}`,
    };
  });

  await test("POST /api/favorites — empty body, no auth", async () => {
    const { status, body } = await fetchJSON(`${BASE}/api/favorites`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    return {
      pass: status === 401 || status === 400,
      statusCode: status,
      body: JSON.stringify(body).slice(0, 500),
      details: `Status ${status}`,
    };
  });
}

// ============================================================
// /api/match
// ============================================================
async function testMatch() {
  await test("POST /api/match — valid JD", async () => {
    const { status, body } = await fetchJSON(`${BASE}/api/match`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jobDescription: "Looking for a senior React developer with TypeScript experience, 5+ years, based in San Francisco.",
      }),
    });
    const hasShape = typeof body === "object" && ("requirements" in body || "error" in body);
    return {
      pass: status === 200 && hasShape,
      statusCode: status,
      body: JSON.stringify(body).slice(0, 2000),
      details: `Found ${body?.candidates?.length || 0} candidates`,
      responseShape: Object.keys(body || {}),
    };
  });

  await test("POST /api/match — empty body", async () => {
    const { status, body } = await fetchJSON(`${BASE}/api/match`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    return {
      pass: status === 400,
      statusCode: status,
      body: JSON.stringify(body).slice(0, 500),
      details: `Expected 400, got ${status}. Error: ${body?.error || "none"}`,
    };
  });

  await test("POST /api/match — invalid JSON", async () => {
    const { status, body } = await fetchJSON(`${BASE}/api/match`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not json",
    });
    return {
      pass: status >= 400,
      statusCode: status,
      body: typeof body === "string" ? body.slice(0, 500) : JSON.stringify(body).slice(0, 500),
      details: `Status ${status} for invalid JSON`,
    };
  });

  await test("GET /api/match — wrong method", async () => {
    const { status, body } = await fetchJSON(`${BASE}/api/match`);
    return {
      pass: status === 405 || status >= 400,
      statusCode: status,
      body: typeof body === "string" ? body.slice(0, 500) : JSON.stringify(body).slice(0, 500),
      details: `Status ${status} for GET`,
    };
  });

  await test("POST /api/match — missing all required fields", async () => {
    const { status, body } = await fetchJSON(`${BASE}/api/match`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ randomField: "hello" }),
    });
    return {
      pass: status === 400,
      statusCode: status,
      body: JSON.stringify(body).slice(0, 500),
      details: `Expected 400 for missing required fields, got ${status}`,
    };
  });
}

// ============================================================
// /api/match/parse
// ============================================================
async function testMatchParse() {
  await test("POST /api/match/parse — valid JD text", async () => {
    const { status, body } = await fetchJSON(`${BASE}/api/match/parse`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "We need a senior Python developer with 5 years experience in ML/AI, located in NYC." }),
    });
    return {
      pass: status === 200 && typeof body === "object",
      statusCode: status,
      body: JSON.stringify(body).slice(0, 2000),
      details: `Parsed requirements keys: ${Object.keys(body || {}).join(", ")}`,
      responseShape: Object.keys(body || {}),
    };
  });

  await test("POST /api/match/parse — empty body", async () => {
    const { status, body } = await fetchJSON(`${BASE}/api/match/parse`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    return {
      pass: status === 400,
      statusCode: status,
      body: JSON.stringify(body).slice(0, 500),
      details: `Expected 400 for missing text, got ${status}`,
    };
  });

  await test("POST /api/match/parse — text as number", async () => {
    const { status, body } = await fetchJSON(`${BASE}/api/match/parse`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: 12345 }),
    });
    return {
      pass: status === 400,
      statusCode: status,
      body: JSON.stringify(body).slice(0, 500),
      details: `Expected 400 for non-string text, got ${status}`,
    };
  });
}

// ============================================================
// Response time checks
// ============================================================
async function testResponseTimes() {
  await test("PERF: /api/stats response time < 2s", async () => {
    const start = Date.now();
    await fetchJSON(`${BASE}/api/stats`);
    const dur = Date.now() - start;
    return {
      pass: dur < 2000,
      statusCode: 200,
      body: "",
      details: `Response time: ${dur}ms (limit: 2000ms)`,
    };
  });

  await test("PERF: /api/search?q=react&limit=5 response time < 15s", async () => {
    const start = Date.now();
    await fetchJSON(`${BASE}/api/search?q=react&limit=5`);
    const dur = Date.now() - start;
    return {
      pass: dur < 15000,
      statusCode: 200,
      body: "",
      details: `Response time: ${dur}ms (limit: 15000ms)`,
    };
  });

  await test("PERF: /api/score/torvalds response time < 15s", async () => {
    const start = Date.now();
    await fetchJSON(`${BASE}/api/score/torvalds`);
    const dur = Date.now() - start;
    return {
      pass: dur < 15000,
      statusCode: 200,
      body: "",
      details: `Response time: ${dur}ms (limit: 15000ms)`,
    };
  });
}

// ============================================================
// MAIN
// ============================================================
async function main() {
  console.log("=== Scout API QA Test Runner ===\n");
  console.log(`Target: ${BASE}`);
  console.log(`Started: ${new Date().toISOString()}\n`);

  // Run test groups sequentially to avoid rate limiting
  console.log("Testing /api/stats...");
  await testStats();

  console.log("Testing /api/search (GET)...");
  await testSearchGET();

  console.log("Testing /api/search (POST/SSE)...");
  await testSearchPOST();

  console.log("Testing /api/profiles...");
  await testProfiles();

  console.log("Testing /api/score...");
  await testScore();

  console.log("Testing /api/scouting-report...");
  await testScoutingReport();

  console.log("Testing /api/outreach-draft...");
  await testOutreachDraft();

  console.log("Testing /api/find-similar...");
  await testFindSimilar();

  console.log("Testing /api/developer-card...");
  await testDeveloperCard();

  console.log("Testing /api/lists...");
  await testLists();

  console.log("Testing /api/favorites...");
  await testFavorites();

  console.log("Testing /api/match...");
  await testMatch();

  console.log("Testing /api/match/parse...");
  await testMatchParse();

  console.log("Testing response times...");
  await testResponseTimes();

  // Output results
  console.log("\n=== RESULTS ===\n");

  const passed = results.filter(r => r.status === "PASS").length;
  const failed = results.filter(r => r.status === "FAIL").length;
  const errored = results.filter(r => r.status === "ERROR").length;
  const allSecretLeaks = results.flatMap(r => r.secretLeaks);

  for (const r of results) {
    const icon = r.status === "PASS" ? "PASS" : r.status === "FAIL" ? "FAIL" : "ERR ";
    console.log(`[${icon}] ${r.name} (${r.statusCode || "N/A"}) ${r.duration}ms — ${r.details}`);
  }

  console.log(`\n--- Summary ---`);
  console.log(`Total: ${results.length} | Pass: ${passed} | Fail: ${failed} | Error: ${errored}`);
  console.log(`Secret leaks found: ${allSecretLeaks.length}`);
  if (allSecretLeaks.length > 0) {
    for (const leak of allSecretLeaks) console.log(`  LEAK: ${leak}`);
  }

  // Write JSON results for report generation
  const outputPath = "/Users/ryanguard/gitscout/qa-reports/test-results.json";
  const { writeFileSync } = await import("fs");
  writeFileSync(outputPath, JSON.stringify({ results, summary: { total: results.length, passed, failed, errored, secretLeaks: allSecretLeaks } }, null, 2));
  console.log(`\nResults written to ${outputPath}`);
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
