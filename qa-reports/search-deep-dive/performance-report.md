# GitScout Performance Benchmark Report

**Date:** 2026-03-26
**Environment:** localhost:3000 (Next.js 16 + Turbopack dev server)
**Tool:** Playwright 1.58.2, Lighthouse 13.0.3
**Browser:** Chromium (headless)

---

## Executive Summary

| Area | Verdict | Notes |
|------|---------|-------|
| Page load times | **PASS** | Homepage 48ms avg, search 72ms avg — well under 500ms target |
| Search API | **PASS** | 324ms avg for "python" — well under 3s target |
| Stats API | **FAIL** | Returns HTTP 500 on all requests |
| Score API | **FAIL** | Returns HTTP 429 (rate-limited) on all requests |
| Concurrent load | **PASS** | 5 parallel searches complete in 66ms total wall time |
| Sequential load | **PASS** | 10 sequential searches, 0 failures, negligible memory growth |
| DOM stability | **PASS** | Node count stable at ~206 after searches — no unbounded growth |
| Memory leaks | **WARN** | JS heap grew ~65MB over 10 navigation cycles (DOM stable) |
| Bundle size | **WARN** | 810KB transferred / 4.0MB decoded (dev mode, 22 JS chunks) |
| Lighthouse (homepage) | **FAIL** | Score: 0 — LCP/TBT unmeasurable on dev server |
| Lighthouse (search) | **WARN** | Score: 46 — LCP 7.2s, TBT 2.0s, 408KB unused JS |
| Caching | **NEUTRAL** | ~1% speedup on repeat query — no meaningful server-side cache |

**Overall: 7 of 15 benchmarks pass. 2 API endpoints are broken (500/429). Heap memory warrants investigation. Lighthouse scores are heavily penalized by dev-mode overhead.**

---

## Benchmark 1: Homepage Load Time

**Target:** < 500ms | **Result: PASS**

| Run | Time (ms) |
|-----|-----------|
| 1 | 62 |
| 2 | 43 |
| 3 | 38 |
| **Avg** | **48** |
| Min | 38 |
| Max | 62 |
| Median | 43 |

Homepage loads extremely fast — 10x under the 500ms target.

---

## Benchmark 2: Search Page Load Time

| Run | Time (ms) |
|-----|-----------|
| 1 | 64 |
| 2 | 61 |
| 3 | 92 |
| **Avg** | **72** |
| Min | 61 |
| Max | 92 |

Search page loads comparably to homepage. No heavy initial data fetching.

---

## Benchmark 3: Search "python" API Response

**Target:** < 3s | **Result: PASS**

| Run | Time (ms) | Status |
|-----|-----------|--------|
| 1 | 767 | 200 |
| 2 | 247 | 200 |
| 3 | 220 | 200 |
| 4 | 191 | 200 |
| 5 | 195 | 200 |
| **Avg** | **324** | |
| Min | 191 | |
| Max | 767 | |
| Median | 220 | |

First request is significantly slower (767ms) — likely cold-start for GitHub API connection or server-side module initialization. Subsequent requests settle around ~200ms.

---

## Benchmark 4: Search "TypeScript San Francisco" API

| Run | Time (ms) | Status |
|-----|-----------|--------|
| 1 | 315 | 200 |
| 2 | 190 | 200 |
| 3 | 191 | 200 |
| 4 | 207 | 200 |
| 5 | 243 | 200 |
| **Avg** | **229** | |
| Min | 190 | |
| Max | 315 | |

Multi-term search performs similarly to single-term. No significant penalty for compound queries.

---

## Benchmark 5: Profile Page `/profile/torvalds`

| Run | Time (ms) |
|-----|-----------|
| 1 | 932 |
| 2 | 416 |
| 3 | 214 |
| **Avg** | **521** |
| Min | 214 |
| Max | 932 |

First load is nearly 1 second — expected for a profile with many repos that may require GitHub API calls. Subsequent loads benefit from DB caching, dropping to ~200ms.

---

## Benchmark 6: Score API `/api/score/torvalds`

**Result: FAIL — HTTP 429 on all requests**

| Run | Time (ms) | Status |
|-----|-----------|--------|
| 1 | 59 | 429 |
| 2 | 50 | 429 |
| 3 | 51 | 429 |

The score endpoint is rate-limited and rejecting all requests. This may indicate:
- Rate limiter is too aggressive for the test context
- The endpoint depends on GitHub API tokens that are exhausted
- Misconfigured rate limiting middleware

**Action:** Investigate rate limiting configuration for `/api/score/[username]`.

---

## Benchmark 7: Stats API `/api/stats`

**Target:** < 500ms | **Result: FAIL (HTTP 500 errors)**

| Run | Time (ms) | Status |
|-----|-----------|--------|
| 1 | 180 | 500 |
| 2 | 193 | 500 |
| 3 | 172 | 500 |
| **Avg** | **182** | |

Response times are fast (under 500ms target), but the endpoint is returning **500 Internal Server Error** on every request. The API is broken.

**Action:** Debug `/api/stats` — likely a DB query error or missing table/field.

---

## Benchmark 8: Concurrent Searches (5 parallel)

**Result: PASS — all succeeded**

| Query | Time (ms) | Status |
|-------|-----------|--------|
| python | 54 | 200 |
| rust | 61 | 200 |
| go | 60 | 200 |
| typescript | 66 | 200 |
| frontend | 64 | 200 |
| **Wall time** | **66** | |

Server handles 5 concurrent searches effortlessly. Wall time roughly equals single-request time, indicating good parallel handling.

---

## Benchmark 9: Sequential Searches (10 queries)

**Result: PASS — 0 failures**

| # | Query | Time (ms) | Status |
|---|-------|-----------|--------|
| 1 | python | 51 | 200 |
| 2 | rust | 57 | 200 |
| 3 | go | 61 | 200 |
| 4 | typescript | 57 | 200 |
| 5 | frontend | 52 | 200 |
| 6 | react | 49 | 200 |
| 7 | node | 50 | 200 |
| 8 | django | 49 | 200 |
| 9 | kubernetes | 48 | 200 |
| 10 | machine learning | 51 | 200 |

- **Failures:** 0
- **Memory growth:** 17KB (negligible)
- **Avg response:** 53ms

Consistent ~50ms response times across all queries. No degradation over 10 sequential requests.

---

## Benchmark 10: Caching Behavior

| Metric | Value |
|--------|-------|
| First request | 50ms |
| Second request (same query) | 49ms |
| Speedup | 1% |

Effectively no caching benefit. Both requests hit the same speed, suggesting results are served from GitHub API cache or DB on every request without an application-level cache layer.

**Recommendation:** Consider adding server-side response caching (e.g., 60-second TTL) for search results to reduce GitHub API load.

---

## Benchmark 11: DOM Node Count

| State | Nodes |
|-------|-------|
| After page load | 193 |
| After 1 search | 206 |
| After 5 searches | 206 |
| **Growth** | **13 (7%)** |

DOM is stable. Searches replace results in-place rather than appending. No unbounded DOM growth detected.

---

## Benchmark 12: JS Bundle Size

**Total Transfer:** 810 KB | **Total Decoded:** 4,084 KB | **Chunks:** 22

### Top 5 Largest Bundles (decoded)

| Bundle | Decoded | Transfer | Load (ms) |
|--------|---------|----------|-----------|
| react-dom | 1,033 KB | 180 KB | 692 |
| next-devtools | 729 KB | 213 KB | 517 |
| next/dist/client | 725 KB | 148 KB | 526 |
| node_modules (misc) | 489 KB | 84 KB | 719 |
| next/dist (core) | 240 KB | 45 KB | 287 |
| **App source (src/)** | **273 KB** | **26 KB** | — |

**Analysis:**
- **Framework overhead dominates:** React DOM + Next.js client = 1,758 KB (43% of decoded)
- **Dev tooling in bundle:** next-devtools (729 KB) is dev-only and won't be in production
- **App code is small:** Only ~273 KB decoded across 2 src/ chunks (6.7% of total)
- **Good compression:** 810 KB transfer for 4,084 KB decoded = ~80% compression ratio

**Production estimate:** Removing devtools chunk would save ~213 KB transfer. Production build with tree-shaking will be significantly smaller.

---

## Benchmark 13: Render-Blocking Resources

| Resource | Type | Duration | Size |
|----------|------|----------|------|
| Root CSS stylesheet | link | 11ms | 17 KB |

Only 1 render-blocking resource — the root CSS file at 17KB loading in 11ms. This is acceptable and expected (critical CSS must block render).

---

## Benchmark 14: Lighthouse Performance Scores

### Homepage

| Metric | Value | Score |
|--------|-------|-------|
| **Overall Performance** | — | **0/100** |
| First Contentful Paint | 1.3s | 0.98 |
| Largest Contentful Paint | N/A | null |
| Total Blocking Time | N/A | null |
| Cumulative Layout Shift | 0.002 | 1.00 |
| Speed Index | 2.8s | 0.96 |

| Diagnostic | Value |
|------------|-------|
| Server Response Time | 190ms |
| Main Thread Work | 1.5s |
| JS Execution Time | 0.9s |
| Total Byte Weight | 904 KB |

**Why score is 0:** LCP and TBT returned null — Lighthouse could not measure these metrics. This is a known issue with dev servers (Turbopack HMR client interferes with metric collection). The measurable metrics (FCP 0.98, CLS 1.00, SI 0.96) are all excellent.

### Search Page

| Metric | Value | Score |
|--------|-------|-------|
| **Overall Performance** | — | **46/100** |
| First Contentful Paint | 1.3s | — |
| Largest Contentful Paint | 7.2s | — |
| Total Blocking Time | 2,000ms | — |
| Cumulative Layout Shift | 0.002 | — |
| Speed Index | 4.5s | — |
| Time to Interactive | 9.4s | — |

| Diagnostic | Value |
|------------|-------|
| Server Response Time | 130ms |
| Main Thread Work | 6.4s |
| JS Execution Time | 5.1s |
| Unused JS | 408 KB potential savings |

**Top unused JS sources:**
| Bundle | Wasted |
|--------|--------|
| next-devtools | 111 KB |
| node_modules (misc) | 92 KB |
| next/dist/client | 76 KB |
| react-dom | 58 KB |
| node_modules (misc) | 48 KB |

**Note:** These scores reflect dev mode with Turbopack. Production builds will be significantly faster due to:
- No HMR client
- No devtools bundle (729 KB removed)
- Minification + tree-shaking
- Static page generation where applicable

---

## Benchmark 15: Memory Leak Detection

**10 navigation cycles: search → profile → back → search → profile → back**

| Cycle | Heap (KB) | DOM Nodes |
|-------|-----------|-----------|
| 1 | 20,874 | 122 |
| 2 | 28,652 | 122 |
| 3 | 36,116 | 122 |
| 4 | 42,281 | 122 |
| 5 | 49,603 | 122 |
| 6 | 55,620 | 122 |
| 7 | 69,972 | 122 |
| 8 | 69,505 | 122 |
| 9 | 83,746 | 122 |
| 10 | 86,128 | 122 |

| Metric | Value |
|--------|-------|
| DOM growth | **0 nodes** |
| Heap growth | **+65,254 KB (~64 MB)** |
| Leak suspected | **Yes** |

**Analysis:**
- **DOM is perfectly stable** — 122 nodes throughout all cycles. No detached DOM elements accumulating.
- **Heap grows monotonically** from 20 MB to 86 MB — a 4x increase over 10 cycles.
- Growth rate is roughly linear (~6.5 MB/cycle), suggesting a consistent leak rather than one-time allocation.
- Slight dip at cycle 8 (69,505 vs 69,972) suggests GC is running but not reclaiming most memory.

**Likely causes:**
1. **Event listeners not cleaned up** on navigation (React effects without cleanup)
2. **Closure-retained state** from search results or profile data persisting across navigations
3. **Dev-mode overhead** — Turbopack HMR, React dev warnings, and Next.js devtools may retain references
4. **Router cache** — Next.js App Router caches page data in memory by design

**Recommendation:** Re-test in production build to distinguish framework overhead from app-level leaks. If heap still grows, profile with Chrome DevTools heap snapshots to identify retained objects.

---

## Summary Scoreboard

| # | Benchmark | Result | Target | Actual | Status |
|---|-----------|--------|--------|--------|--------|
| 1 | Homepage load | 48ms avg | <500ms | 48ms | **PASS** |
| 2 | Search page load | 72ms avg | — | 72ms | **PASS** |
| 3 | Search "python" API | 324ms avg | <3s | 324ms | **PASS** |
| 4 | Search "TS SF" API | 229ms avg | — | 229ms | **PASS** |
| 5 | Profile page load | 521ms avg | — | 521ms | **OK** |
| 6 | Score API | HTTP 429 | 200 OK | 429 | **FAIL** |
| 7 | Stats API | HTTP 500 | <500ms | 500 err | **FAIL** |
| 8 | 5 concurrent searches | 66ms total | All 200 | All 200 | **PASS** |
| 9 | 10 sequential searches | 0 failures | No failures | 0 | **PASS** |
| 10 | Caching | 1% speedup | Noticeable | ~0% | **NEUTRAL** |
| 11 | DOM node count | +13 nodes | Not unbounded | Stable | **PASS** |
| 12 | Bundle size | 810KB xfer | — | 810KB | **WARN** |
| 13 | Render-blocking | 1 resource | Minimal | 1 (11ms) | **PASS** |
| 14a | Lighthouse homepage | Score 0 | >90 | 0* | **FAIL*** |
| 14b | Lighthouse search | Score 46 | >90 | 46 | **FAIL** |
| 15 | Memory leaks | +65MB heap | No growth | Growing | **WARN** |

*\*Homepage Lighthouse score is 0 due to unmeasurable LCP/TBT on dev server — not representative of production.*

---

## Critical Issues

### P0 — Broken Endpoints
1. **`/api/stats` returns 500** on all requests — likely a database query error
2. **`/api/score/[username]` returns 429** on all requests — rate limiter is too restrictive or GitHub token is exhausted

### P1 — Performance Concerns
3. **Memory leak suspected** — 65MB heap growth over 10 navigation cycles. DOM is stable, so this is JS object retention. Needs production-build profiling to confirm.
4. **No server-side search caching** — identical queries hit the full pipeline every time. A short TTL cache would reduce GitHub API usage and improve response times.

### P2 — Lighthouse / Production Readiness
5. **Lighthouse scores poor on dev server** — expected, but production build should be validated with Lighthouse CI to establish real baselines.
6. **408KB unused JavaScript** on search page — mostly framework/devtools code. Verify production tree-shaking eliminates this.
7. **Profile page cold-start** at ~930ms — first load is nearly 1s. Consider prefetching or streaming SSR for profile data.

---

## Recommendations

1. **Fix `/api/stats`** — Debug the 500 error (likely Prisma query or schema mismatch)
2. **Fix `/api/score/[username]` rate limiting** — Review rate limiter config; may need per-IP or per-session limits rather than global
3. **Add search response caching** — 30-60s TTL on `/api/search` responses to reduce GitHub API pressure
4. **Profile memory in production build** — Run this same benchmark against `next build && next start` to isolate dev-mode overhead from real leaks
5. **Set up Lighthouse CI** — Run Lighthouse on production builds in CI to track performance regressions
6. **Consider profile data prefetching** — When hovering over search results, prefetch profile data to reduce perceived load time

---

*Raw data: [perf-raw-results.json](./perf-raw-results.json) | [lighthouse-homepage.json](./lighthouse-homepage.json) | [lighthouse-search.json](./lighthouse-search.json)*
