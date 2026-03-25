# Search Performance QA Report

**Date:** 2026-03-25
**Environment:** localhost:3000, Next.js 16.2.1 (Turbopack), macOS Darwin 25.3.0
**Test Tool:** curl + Python3 automation
**GitHub Token:** NOT CONFIGURED (unauthenticated rate limits: 10 search/min, 60 core/hr)

---

## Executive Summary

| Category | Verdict | Notes |
|----------|---------|-------|
| API response time | PASS (with caveats) | 0.03-0.79s avg depending on query; first-call cold start up to 1.76s |
| DOM render time | PASS | 0.07-0.53s, consistent ~31KB SSR shell |
| Caching | PARTIAL | 4.8x speedup for result-heavy queries; no benefit for zero-result queries |
| Rapid fire (10) | PASS | 0/10 failures, avg 88ms |
| Rapid fire (30) | PASS | 0/30 failures, 0 rate limit errors surfaced, avg 82ms |
| Error handling | PASS | All malformed inputs return HTTP 200 gracefully |
| XSS / injection | PASS | `<script>` and SQL injection sanitized |
| Memory stability | NEEDS INVESTIGATION | RSS grew from ~54 MB to ~244 MB during testing (4.5x) |
| Server durability | **FAIL** | After ~80 queries, server returns 500 with empty body on all searches |

### Critical Findings

1. **CRIT-1: Server degrades to persistent 500s under sustained load.** After approximately 80 search queries (which trigger GitHub API + Prisma calls), all subsequent searches with a query parameter return HTTP 500 with an empty response body. The empty-query fast path (which skips GitHub/Prisma) continues to work. The server does NOT self-recover. This suggests an unhandled exception path when the GitHub API returns errors (likely 403 rate limit), possibly combined with Prisma connection pool exhaustion.

2. **CRIT-2: No GITHUB_TOKEN configured.** The `.env` file has no `GITHUB_TOKEN` entry. The app falls back to unauthenticated GitHub API access with severe rate limits (10 search requests/min, 60 user-fetch requests/hr). This is the root cause of most observed failures.

3. **HIGH-1: Memory growth under load.** The `next-server` process RSS grew from ~54 MB to ~244 MB (+190 MB, 4.5x) during testing. While some V8 heap expansion under load is normal, this magnitude warrants investigation for retained references (e.g., cached response objects, unclosed connections).

---

## Test 1: API Response Timing (5 Searches x 3 Runs)

Each search was run 3 times via `GET /api/search?q=...` with 0.5s pause between runs.

| Query | Run 1 | Run 2 | Run 3 | Avg | Min | Max | StdDev | Results |
|-------|-------|-------|-------|-----|-----|-----|--------|---------|
| TypeScript SF | 1.755s | 0.265s | 0.336s | **0.785s** | 0.265s | 1.755s | 0.840s | 239 (20 shown) |
| Python Austin | 0.485s | 0.402s | 0.580s | **0.489s** | 0.402s | 0.580s | 0.089s | 1000 (20 shown) |
| Go Seattle | 0.166s | 0.143s | 0.068s | **0.126s** | 0.068s | 0.166s | 0.051s | 0 |
| Empty Search | 0.033s | 0.033s | 0.032s | **0.032s** | 0.032s | 0.033s | 0.001s | 0 |
| Rust Berlin | 0.093s | 0.224s | 0.091s | **0.136s** | 0.091s | 0.224s | 0.076s | 0 |

### Analysis

- **TypeScript SF** has the highest variance (stddev 0.840s). Run 1 was 1.755s (cold start: no cached profiles, 20 individual GitHub user fetches in parallel). Runs 2-3 were 4-6x faster, suggesting either GitHub response caching or local profile caching.
- **Python Austin** is the most consistent performer (stddev 0.089s) despite returning 1000 total results.
- **Go Seattle** and **Rust Berlin** returned 0 results across all runs. These queries ran after TypeScript SF and Python Austin consumed most of the unauthenticated rate limit. The GitHub search API likely returned 403, which the error handler silently swallowed, returning an empty result set.
- **Empty Search** is sub-millisecond server logic -- the fast path returns immediately without hitting GitHub or Prisma.
- **Response sizes**: Result queries are 8-12 KB; empty results are 62-73 bytes.

### Performance Budget Assessment

| Threshold | Target | Actual | Status |
|-----------|--------|--------|--------|
| API p50 | < 500ms | ~300ms (warm) | PASS |
| API p95 | < 2000ms | ~1755ms (cold start) | PASS (barely) |
| Cold start | < 3000ms | 1755ms | PASS |
| Empty query | < 100ms | 32ms | PASS |

---

## Test 2: DOM / Page Render Timing (5 Searches x 3 Runs)

Measured via `curl` to `/search?q=...` (SSR HTML response).

| Query | Run 1 | Run 2 | Run 3 | Avg | Page Size |
|-------|-------|-------|-------|-----|-----------|
| TypeScript SF | 0.414s | 0.198s | 0.527s | **0.380s** | 31,034 B |
| Python Austin | 0.231s | 0.113s | 0.372s | **0.238s** | 31,034 B |
| Go Seattle | 0.211s | 0.121s | 0.074s | **0.135s** | 31,019 B |
| Empty Search | 0.436s | 0.194s | 0.117s | **0.249s** | 30,967 B |
| Rust Berlin | 0.185s | 0.240s | 0.142s | **0.189s** | 31,024 B |

### Analysis

- All pages return a consistent ~31 KB SSR shell. The actual search results are loaded client-side via the API, so the page HTML size is independent of result count.
- DOM render times range from 74ms to 527ms. First-render is typically slower (React SSR compilation), subsequent renders benefit from module caching.
- The search page is a client-side React component that fires the API call on mount -- the SSR shell is effectively static.

---

## Test 3: Cache Behavior

Same query run twice with 0.2s gap. Is the second call faster?

| Query | 1st Call | 2nd Call | Speedup | Cached? |
|-------|----------|----------|---------|---------|
| TypeScript SF | 1.473s | 0.307s | **4.8x** | YES |
| Python Austin | 0.396s | 0.342s | **1.16x** | Marginal |
| Rust Berlin | 0.084s | 0.107s | **0.79x** | NO |

### Analysis

- **TypeScript SF** shows strong caching: the 4.8x speedup indicates the individual user profile fetches (20 calls to `/users/{login}`) are not repeated. GitHub's conditional caching (304 Not Modified) or server-side deduplication is working.
- **Python Austin** shows marginal improvement (1.16x), likely from GitHub CDN-level caching of the search endpoint response.
- **Rust Berlin** shows no caching benefit because both calls return 0 results (GitHub rate limited) -- there's nothing to cache.
- There is no application-level response cache (e.g., Redis or in-memory LRU). All caching is incidental (GitHub CDN, V8 compiled function cache, TCP connection reuse).

---

## Test 4: Rapid Fire -- 10 Sequential Searches

10 searches fired back-to-back with no delay, cycling through 5 different queries.

| Metric | Value |
|--------|-------|
| Total requests | 10 |
| Failures (non-200) | **0** |
| Avg response time | 88ms |
| Min response time | 64ms |
| Max response time | 136ms |
| Results returned | 0 across all (rate limited) |

All 10 returned HTTP 200 with 0 results. The GitHub Search API was exhausted by this point in the test run. The server handled the load gracefully -- no crashes, no timeouts, no connection refused.

---

## Test 5: Rapid Fire -- 30 Sequential Searches (Rate Limit Test)

30 searches fired back-to-back, cycling through 5 queries.

| Metric | Value |
|--------|-------|
| Total requests | 30 |
| Failures (non-200) | **0** |
| Explicit 429 responses | **0** |
| Rate limit messages in body | **0** |
| Avg response time | 82ms |
| Min response time | 56ms |
| Max response time | 208ms |
| Results returned | 0 across all |

### Analysis

- The server survived 30 rapid requests with **zero failures** -- all returned HTTP 200.
- No explicit rate limit errors were surfaced to the client. When GitHub returns 403 (rate limited), the API silently falls through to an empty result set. This is both good (no crashes) and bad (user gets no feedback about rate limiting).
- Response times were very consistent (56-208ms) because the GitHub API call was failing immediately (rate limited), so the only latency was the Prisma lookup (which returned empty since no local data matched).
- **Note:** After the test suite completed (~80+ total queries including all tests), the server began returning 500 with empty bodies on ALL search queries. The rapid fire tests themselves did not cause this -- it happened after the full suite.

---

## Test 6: Error Scenarios

| Scenario | HTTP | Time | Results | Notes |
|----------|------|------|---------|-------|
| Obscure query (`zyxwvut...`) | 200 | 63ms | 0 | Graceful empty response |
| Impossible combo (`Cobol Antarctica`) | 200 | 72ms | 0 | Graceful empty response |
| XSS (`<script>alert(1)</script>`) | 200 | 84ms | 0 | `<>` stripped from query in response; **NOT reflected** |
| SQL injection (`' OR 1=1 --`) | 200 | 122ms | 0 | Handled safely (parameterized Prisma queries) |
| Very long query (500 chars) | 200 | 61ms | 0 | Truncated to 200 chars via `sanitizeQuery()` |
| Unicode/emoji (`\ud83d\udc68\u200d\ud83d\udcbb`) | 200 | 65ms | 0 | No crash, graceful empty |
| Empty + bad language filter | 200 | 86ms | 0 | Fast path: no query, no results |
| Negative page (`page=-1`) | 200 | 93ms | 0 | `Math.max(1, ...)` normalizes to page 1 |
| Huge limit (`limit=99999`) | 200 | 76ms | 0 | `Math.min(30, ...)` caps at 30 |

### Verdict: PASS

All error scenarios return HTTP 200 with a well-formed JSON response. No crashes, no stack traces leaked, no XSS reflection. Input sanitization is working correctly:
- `sanitizeQuery()` strips `<>` and truncates to 200 chars
- `Math.max`/`Math.min` normalize pagination params
- Prisma parameterized queries prevent SQL injection

---

## Test 7: Memory Leak Test (20 Consecutive Searches)

20 searches with diverse queries, monitoring `next-server` process RSS.

| Metric | Value |
|--------|-------|
| RSS before test suite | ~54 MB |
| RSS after full suite (~100 queries) | ~244 MB |
| Growth | +190 MB (4.5x) |
| RSS during leak test (20 queries) | Stable at 0.6 MB* |

*The automated memory test monitored the wrong PID (matched a helper process, not `next-server`). Manual `ps` verification revealed the true next-server PID (16472) at 244 MB RSS post-test.

### Analysis

- The 4.5x RSS growth over ~100 queries is concerning but not definitively a memory leak. Possible explanations:
  - **V8 heap expansion**: Node.js aggressively allocates heap under concurrent async work (20 parallel GitHub fetches per search).
  - **Module caching**: Turbopack in dev mode may retain compiled modules in memory.
  - **Prisma connection pool**: Connections may not be released under rapid-fire conditions.
- To confirm a leak, a longer soak test (1000+ queries over 30+ minutes) with V8 heap snapshots would be needed.
- The server did eventually degrade to 500 errors, which may be related to memory pressure.

---

## Post-Test: Server Degradation (CRIT-1 Details)

After completing the full test suite (~100+ total API calls), the server entered a persistent failure state:

| Query Type | Status | Body |
|------------|--------|------|
| `?q=TypeScript+SF` | 500 | Empty (0 bytes chunked) |
| `?q=test` | 500 | Empty |
| `?q=Go+Seattle` | 500 | Empty |
| `?q=` (empty) | **200** | `{"developers":[],"total":0,...}` |

**Key observation:** The empty-query fast path (which returns immediately without calling GitHub or Prisma) continues to work. Only queries that trigger the GitHub API + Prisma flow return 500.

### Root Cause Hypothesis

The `GET /api/search` handler has a `try/catch` around the GitHub API call (line 450-461) that silently swallows errors. However, the Prisma `findMany` call on line 466 is NOT wrapped in a try/catch. If the Prisma connection pool is exhausted or the database connection times out (possible after ~100 rapid queries), the unhandled rejection propagates as a 500.

The empty response body (no JSON error) confirms Next.js is catching an unhandled exception and returning a generic 500.

---

## Recommendations

### Critical (Fix Before Deploy)

1. **Add GITHUB_TOKEN to .env** -- Without it, the app is limited to 10 search requests/min. With a PAT, this jumps to 30 search/min and 5000 core/hr.

2. **Wrap Prisma calls in try/catch** -- The `prisma.developer.findMany` call at line 466 and the profile-fetch loop should have error handling to prevent cascading 500s when the DB connection is unhealthy.

3. **Surface rate limit errors to the user** -- When GitHub returns 403, the current behavior silently returns 0 results. Add a response field like `"warning": "GitHub API rate limit reached"` so the UI can show a meaningful message.

### High Priority

4. **Add application-level response cache** -- A simple in-memory LRU cache (e.g., `Map` with TTL) for GitHub search results would dramatically reduce API consumption. The 4.8x cache speedup in Test 3 shows the potential.

5. **Investigate memory growth** -- Run a soak test with `--expose-gc` and heap snapshots to determine if the +190 MB growth is a genuine leak or normal V8 behavior.

6. **Add health check endpoint** -- `/api/health` that checks GitHub API rate limit remaining + Prisma connectivity would help detect degraded states before users hit them.

### Medium Priority

7. **Add response time headers** -- Include `X-Response-Time` and `X-GitHub-Rate-Remaining` headers in API responses for client-side monitoring.

8. **Implement request queuing for burst traffic** -- The rapid-fire tests show the server handles bursts gracefully but exhausts GitHub rate limits. A queue with backpressure (e.g., max 5 concurrent GitHub calls) would be more sustainable.

---

## Raw Data

Full test results are available in the companion file: [`/tmp/perf_results.json`](file:///tmp/perf_results.json)

### Test Environment

```
Node.js PID:     16472 (next-server)
Initial RSS:     ~54 MB
Final RSS:       ~244 MB
Total queries:   ~100+ across all tests
GitHub Auth:     Unauthenticated (no GITHUB_TOKEN)
Database:        Prisma + local PostgreSQL
```
