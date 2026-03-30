# Scout Master QA Report

**Date:** 2026-03-26
**Environment:** localhost:3000 (Next.js 16.2.1 + Turbopack dev server)
**Branch:** main (commit 809f4fa)
**Reports Consolidated:** 9 (search-flow, profile-pages, market-map, auth-features, api-endpoints, scoring-data, performance, visual-a11y, crm-features)

---

## 1. Executive Summary

**Overall Health: 5 / 10**

Scout's core search pipeline works and returns results in ~200ms. The Market Map feature is impressively polished with 94% pass rate. XSS protection is solid, responsive design is mostly excellent, and the app handles edge cases gracefully.

However, the product has **serious structural problems** that would embarrass you in a demo:

- **Profile pages crash** under load due to Supabase connection pool exhaustion — the single most-visited page type is unreliable
- **Pagination is broken** — users cannot see beyond the first 20 search results despite the UI claiming 473 pages exist
- **The scoring engine is fundamentally flawed** — Linus Torvalds scores 36.6/100, sindresorhus scores 44.1/100. The system penalizes exactly the developers recruiters want to find
- **3 of 5 nav links lead to unimplemented pages** (/lists, /favorites, /settings all render the homepage)
- **8 of 20 API endpoints return errors** (500s, hangs, or broken auth)
- **18 WCAG 2.1 AA violations** across the app, driven by a single pervasive contrast failure (`text-neutral-500`)

The app is a strong technical foundation with a broken middle layer. Search in, data out works. Everything between — scoring, CRM, enrichment integration, pagination — needs significant work before sharing externally.

---

## 2. Test Coverage

| Report | Tests Run | Pass | Fail | Warn | Other | Pass Rate |
|--------|-----------|------|------|------|-------|-----------|
| Search Flow | 22 | 14 | 2 | 4 | 2 | 63.6% |
| Profile Pages | 83 | 61 | 5 | 14 | 3 | 73.5% |
| Market Map | 117 | 110 | 1 | 6 | 0 | 94.0% |
| Auth Features | 50 | 34 | 2 | 4 | 10 | 68.0% |
| API Endpoints | 20 | 9 | 8 | 1 | 2 | 45.0% |
| Scoring & Data | 12 | 2 | 7 | 1 | 2 | 16.7% |
| Performance | 15 | 7 | 4 | 2 | 2 | 46.7% |
| Visual & A11y | 80+ | ~62 | 18 violations | — | — | ~77.5% |
| CRM Features | 19 | 4 | 12 | 0 | 3 | 21.1% |
| **TOTAL** | **~418** | **~303** | **~59** | **~32** | **~24** | **~72.5%** |

**Note:** A11y test count is approximate (18 unique WCAG violations across ~80 individual checks). Several tests across reports were blocked by GitHub API rate limiting or DB pool exhaustion, inflating failure counts.

---

## 3. Critical Bugs (Must Fix Before Sharing)

### CRIT-1: Supabase Connection Pool Exhaustion Crashes Profile Pages
- **Severity:** P0 — blocks core functionality
- **Error:** `MaxClientsInSessionMode: max clients reached`
- **Impact:** Profile pages show "Something went wrong" with stack trace. The most important page in the app is unreliable. Also affects `/api/profiles/[username]` (returns empty 500), `/api/stats` (returns empty 500), and `/api/pipeline` (proceeds past broken auth to DB).
- **Observed in:** Profile report (F01), Auth report (#1), API report (Tests 8-9, 13, 19-20), CRM report (Tests 17-18), Performance report
- **Files:** `src/lib/prisma.ts`, `src/app/api/profiles/[username]/route.ts`, `src/app/api/stats/route.ts`
- **Fix:** Increase Supabase pool size, add `?pgbouncer=true&connection_limit=10` to DATABASE_URL, wrap DB queries in try/catch with GitHub API fallback, ensure Prisma singleton properly reuses connections

### CRIT-2: Pagination Returns Duplicate Results
- **Severity:** P0 — users trapped on page 1
- **Impact:** Page 2 returns identical results to page 1. Page 3 returns 0 results. UI shows "Page 1 of 473" but only 20 results are accessible.
- **Observed in:** Search report (BUG-001, Test 13)
- **Files:** `src/app/api/search/route.ts` (page parameter not passed to GitHub API)
- **Fix:** Pass `page` parameter to GitHub `/search/users` API call

### CRIT-3: Scoring Engine Penalizes Top Developers
- **Severity:** P0 — undermines core value proposition
- **Impact:** Linus Torvalds: 36.6/100 ("Limited Data"). Sindresorhus: 44.1/100 ("Emerging"). Contribution pillar = 0 for all maintainer-archetype developers. `totalCommits: 0` and `recentActivity: 0` for extremely active devs — GraphQL contribution data is failing silently.
- **Observed in:** Scoring report (BUG-SCORE-001, BUG-SCORE-003)
- **Files:** `src/lib/scoring.ts`, `src/pipeline/graphql.ts`
- **Fix:** (1) Add maintainer/merge-target signal to Contribution pillar. (2) Debug GraphQL `fetchContributions` — it's returning null/0 for high-profile accounts. (3) Wire package enrichment data into scoring.

### CRIT-4: `/api/search/deep` Hangs Indefinitely
- **Severity:** P0 — will hit Vercel 60s timeout, wastes resources
- **Impact:** Endpoint accepts connection but never responds. Unresolved promise or infinite loop.
- **Observed in:** API report (Test 7)
- **Files:** `src/app/api/search/deep/route.ts`
- **Fix:** Find and fix the unresolved promise/missing return statement

### CRIT-5: `/api/pipeline` Authentication Bypass
- **Severity:** P0 — security vulnerability
- **Impact:** Body validation runs before auth check. Unauthenticated requests with valid body proceed to database access. The `PIPELINE_SECRET` bearer token check is not functioning.
- **Observed in:** API report (Tests 19-20)
- **Files:** `src/app/api/pipeline/route.ts`
- **Fix:** Move `Authorization: Bearer PIPELINE_SECRET` check to be the first operation in the handler

---

## 4. High Priority Issues

### HIGH-1: 3 Nav Pages Are Unimplemented (/lists, /favorites, /settings)
- **Impact:** 3 of 5 main nav links silently redirect to the homepage. No sign-in prompt, no "coming soon" — just the homepage. Users think the app is broken.
- **Observed in:** Auth report (#5-6), CRM report (Tests 1-5, 12-15)
- **Fix:** Either implement the pages or show a "Sign in required" message (like /map/templates does)

### HIGH-2: Profile Actions Missing for Unindexed Profiles
- **Impact:** For profiles loaded live from GitHub (the vast majority), Scouting Report, Outreach Draft, Enrich, Favorite, Ashby, and Add to List buttons are all absent. No CTA to unlock them. Users see a stripped-down profile with only Find Similar and Share Card.
- **Observed in:** Profile report (F03, F04, Tests 5-9)
- **Files:** `src/components/profile/ProfileActions.tsx`
- **Fix:** Show disabled action buttons with "Index to unlock" tooltip, or auto-index on profile view

### HIGH-3: `/match` Has No Auth Guard
- **Impact:** Anonymous users can access the full JD parsing interface and trigger API calls.
- **Observed in:** Auth report (#3), CRM report (Test 6)
- **Files:** `src/app/match/page.tsx`
- **Fix:** Add auth check, redirect to sign-in

### HIGH-4: Mobile Nav Does Not Collapse at 375px
- **Impact:** All nav links remain visible at mobile widths, creating a crowded header. Hamburger button exists at 768px but doesn't control visibility.
- **Observed in:** Auth report (#4, Test 9)
- **Files:** `src/components/layout/Header.tsx`
- **Fix:** Hide nav links behind hamburger menu at `sm` breakpoint

### HIGH-5: Rate-Limited Search Results Degrade to Empty Profiles
- **Impact:** When GitHub token is exhausted, 100% of search results show 0 followers, 0 repos, 0 score. The entire page looks broken.
- **Observed in:** Scoring report (BUG-INFRA-002, Test 11)
- **Files:** `src/app/api/search/route.ts`, `src/pipeline/github.ts`
- **Fix:** Use data from GitHub search API response (which includes basic counts) instead of zeroing out. Cache profiles after first fetch.

### HIGH-6: Profile Pages Missing All Meta Tags
- **Impact:** No `<title>`, no `<meta description>`, no Open Graph tags on `/profile/[username]`. Browser tab is blank, social sharing shows no preview, SEO is zero.
- **Observed in:** Auth report (#2, Test 13)
- **Files:** `src/app/profile/[username]/page.tsx`
- **Fix:** Add dynamic metadata export

### HIGH-7: Match "Find Matches" Fails After Successful Parsing
- **Impact:** JD parsing works perfectly, but the core value — finding matching candidates — fails with a generic error.
- **Observed in:** CRM report (Tests 10-11)
- **Files:** Match API route handler
- **Fix:** Debug the match endpoint (likely DB pool exhaustion or empty local DB)

---

## 5. Medium Priority Issues

| # | Issue | Source | Files |
|---|-------|--------|-------|
| MED-1 | `/api/profiles/[username]` returns empty 500 (no error body) | API report | `src/app/api/profiles/[username]/route.ts` |
| MED-2 | `/api/stats` returns empty 500 | API report | `src/app/api/stats/route.ts` |
| MED-3 | `/api/enrich/compensation` returns 404 for all users | API report | `src/app/api/enrich/compensation/route.ts` |
| MED-4 | Apollo company search returns 502 (Apollo 422) | API report | `src/app/api/apollo/company-search/route.ts` |
| MED-5 | Organization accounts appear in search results as individuals | Scoring report | `src/app/api/search/route.ts` |
| MED-6 | Search "TypeScript SF" top results are not TS developers | Scoring report | `src/app/api/search/route.ts` |
| MED-7 | 404 page ignores dark mode preference | Auth report | `src/app/not-found.tsx` |
| MED-8 | `prefers-color-scheme` system preference ignored | Profile report | Theme provider |
| MED-9 | Market Map horizontal overflow at 375px mobile | Market Map report | `/map` page component |
| MED-10 | Package enrichment data (5.37B downloads) disconnected from scoring | Scoring report | `src/lib/scoring.ts` |
| MED-11 | Score endpoint has no caching, burns API quota | Scoring report | `src/app/api/score/[username]/route.ts` |
| MED-12 | Search API response shape inconsistent (`/api/search` vs `/api/search/quick`) | API report | Both search route handlers |
| MED-13 | Memory leak suspected: +65MB heap over 10 navigation cycles | Performance report | Investigate with production build |

---

## 6. Low Priority & Polish

| # | Issue | Source |
|---|-------|--------|
| LOW-1 | 404 page returns HTTP 200 instead of 404 status | Profile report (F02) |
| LOW-2 | Search page uses generic meta tags (same as homepage) | Auth report (#8) |
| LOW-3 | Sindresorhus repos shown in alphabetical order, not by stars | Profile report (F06) |
| LOW-4 | Compensation seniority caps at "staff" (no "principal" path) | Scoring report |
| LOW-5 | Non-developers (list curators) appear in search results | Scoring report |
| LOW-6 | Linux Foundation classified as "Mid-Market" in comp estimator | Scoring report |
| LOW-7 | Hamburger button visible at 768px but nav links also visible (redundant) | Auth report (#9) |
| LOW-8 | `/favorites` shows homepage behind auth message (content flash) | Auth report (#10) |
| LOW-9 | Company restore on Market Map has UI race condition | Market Map report (BUG-2) |
| LOW-10 | No server-side search caching (identical queries hit full pipeline) | Performance report |
| LOW-11 | Map form label text at 10px (below 12px minimum) | A11y report |
| LOW-12 | Spacing inconsistency between Match and Map page cards | A11y report |

---

## 7. Performance Summary

| Benchmark | Target | Result | Status |
|-----------|--------|--------|--------|
| Homepage load | <500ms | **48ms** avg | PASS |
| Search page load | <500ms | **72ms** avg | PASS |
| Search API "python" | <3s | **324ms** avg (191ms after warmup) | PASS |
| Search API "TS SF" | <3s | **229ms** avg | PASS |
| Profile page load | <1s | **521ms** avg (932ms cold) | OK |
| 5 concurrent searches | All 200 | **66ms** wall time, all 200 | PASS |
| 10 sequential searches | 0 failures | **53ms** avg, 0 failures | PASS |
| DOM stability | Not unbounded | **+13 nodes** then stable | PASS |
| Memory (10 nav cycles) | No growth | **+65MB** heap (DOM stable) | WARN |
| Bundle size (dev) | — | **810KB** transfer / 4.0MB decoded | WARN |
| Render-blocking resources | Minimal | **1 resource** (17KB CSS, 11ms) | PASS |
| `/api/stats` | 200 OK | **500 error** | FAIL |
| `/api/score/[username]` | 200 OK | **429 rate-limited** | FAIL |
| Lighthouse homepage (dev) | >90 | **0** (LCP/TBT unmeasurable in dev) | FAIL* |
| Lighthouse search (dev) | >90 | **46** (LCP 7.2s, TBT 2.0s) | WARN |

*Lighthouse scores heavily penalized by Turbopack dev server. Production build will be significantly better (devtools chunk alone = 729KB removed).*

**Verdict:** The app is fast where it works. Page loads are sub-100ms. Search API responses settle at ~200ms after warmup. The failures are functional (broken endpoints), not performance-related. Memory leak needs investigation in production build.

---

## 8. Accessibility Violations

**WCAG 2.1 AA Compliance: FAIL** — 18 unique violations across 10 pages.

### Critical Violations

| Violation | Pages Affected | Elements | Fix |
|-----------|---------------|----------|-----|
| **Color contrast: `text-neutral-500` (#737373)** | ALL pages | ~40+ elements (labels, subtitles, usernames, pagination, footer) | Replace with `dark:text-neutral-400` (#a3a3a3) — ratio jumps from 4.16:1 to 6.07:1 |
| **Form labels not associated with inputs** | /map | Role title `<input>`, Level `<select>` | Add `id`/`htmlFor` attributes or `aria-label` |
| **Settings nav link has no accessible name** | ALL pages | Gear icon link (icon-only, no `aria-label`) | Add `aria-label="Settings"` |
| **Mobile nav links have no accessible names** | ALL pages at 375px | 5 icon-only nav links | Add `aria-label` to each |

### High Violations

| Violation | Pages | Fix |
|-----------|-------|-----|
| Missing `<h1>` on search pages | /search | Add `<h1 className="sr-only">Search Developers</h1>` |
| Missing `<title>` on profile pages | /profile/[username] | Add dynamic metadata export |
| Missing `<h1>` on /map/templates | /map/templates | Add heading |
| Map form labels at 10px font size | /map | Change `text-[10px]` to `text-xs` (12px) |

### Passing (Notable)

- Image alt text: **10/10 pages** pass
- Focus indicators: **25/25 elements** have visible focus rings
- Keyboard navigation: Logical tab order, all elements reachable
- Color-only information: **0 violations** — all badges use text alongside color

---

## 9. API Reliability Summary

| Endpoint | Method | Status | Response Time | Issue |
|----------|--------|--------|---------------|-------|
| `/api/search?q=...` | GET | **Working** | 200-400ms | Pagination broken (page param ignored) |
| `/api/search` (empty) | GET | **Working** | 7ms | Returns empty gracefully |
| `/api/search/quick` | POST | **Degraded** | 351ms | Returns 0 results; inconsistent response shape |
| `/api/search/deep` | POST | **Broken** | Hangs >60s | Never responds |
| `/api/profiles/[username]` | GET | **Broken** | 956ms | Returns empty 500 |
| `/api/score/[username]` | GET | **Broken** | 59ms | Returns 429 (rate-limited) |
| `/api/stats` | GET | **Broken** | 182ms | Returns empty 500 |
| `/api/enrich/packages` | GET | **Working** | 1.1s | Excellent data quality |
| `/api/enrich/compensation` | GET | **Broken** | 52ms | Returns 404 for all users |
| `/api/market-map/generate` | POST | **Working** | 833ms | Correctly rejects unauth (401) |
| `/api/market-map/list` | GET | **Working** | 323ms | Correctly rejects unauth (401) |
| `/api/apollo/company-search` | GET | **Broken** | 452ms | Apollo returns 422 |
| `/api/auth/providers` | GET | **Working** | 13ms | Correct GitHub OAuth config |
| `/api/auth/csrf` | GET | **Working** | 12ms | Valid 64-char token |
| `/api/pipeline` | POST | **Broken** | 30ms | Auth bypass — body validated before auth check |
| `/api/favorites` | GET/POST | **Unknown** | — | Not tested (requires auth) |

**Summary:** 8 of 16 tested endpoints are working. 7 are broken. 1 is degraded. The broken endpoints cluster around profile/scoring (DB pool) and enrichment (Apollo 422, compensation 404).

---

## 10. Feature Completeness Matrix

| Feature | Status | Notes |
|---------|--------|-------|
| **Search** | **Partial** | Core search works, pagination broken, sort/filter UI works but ordering unverified due to rate limiting |
| **Profiles** | **Partial** | Renders for live GitHub profiles but crashes under DB load; action buttons missing for unindexed profiles; no meta tags |
| **Scoring** | **Broken** | Fundamentally flawed — penalizes maintainers, GraphQL data returns 0, package data disconnected from score |
| **Market Map** | **Working** | 94% pass rate. Tier visualization, candidate management, flight risk, bulk actions, status management all functional. Minor 375px overflow. |
| **Lists** | **Missing** | Nav link exists, page renders homepage. No list CRUD, no list management UI whatsoever |
| **Favorites** | **Missing** | Nav link exists, page renders homepage. API routes exist per CLAUDE.md but page is non-functional |
| **Match (JD Parsing)** | **Partial** | JD parsing works perfectly (extracts language, keywords, location, seniority). "Find Matches" fails with error — matching is broken |
| **Settings** | **Missing** | Nav link exists, page renders homepage. No Ashby config, no API key management, no preferences |
| **Auth (GitHub OAuth)** | **Working** | OAuth flow works, CSRF tokens valid, providers configured. Auth guards inconsistent (3 pages silently redirect, /match has no guard) |
| **Enrichment (Apollo)** | **Broken** | Company search returns 502 (Apollo 422). Compensation returns 404 for all users. Package enrichment is excellent. |
| **Ashby ATS** | **Missing** | No settings UI for API key. "Push to Ashby" button not visible on profiles. Market Map has Ashby footer button (auth-gated). |

**Feature health: 1 Working, 4 Partial, 3 Broken, 3 Missing out of 11 features.**

---

## 11. Top 10 Action Items (Priority Order)

| # | Action | Files | Complexity | Why |
|---|--------|-------|------------|-----|
| 1 | **Fix Supabase connection pool exhaustion** — increase pool size, add `pgbouncer=true` to URL, wrap DB queries in try/catch with GitHub API fallback | `src/lib/prisma.ts`, `.env` (DATABASE_URL), all API route handlers with DB access | **Medium** | Blocks profile pages, stats, pipeline — the most-hit pages in the app |
| 2 | **Fix pagination** — pass `page` parameter to GitHub `/search/users` API call | `src/app/api/search/route.ts` | **Trivial** | Users are trapped on page 1 of results. Likely a one-line fix. |
| 3 | **Fix GraphQL contribution data** — debug `fetchContributions` returning 0 for active developers | `src/pipeline/graphql.ts` | **Medium** | Zeros out 45% of scoring (Contribution + Consistency pillars) for most developers |
| 4 | **Fix `/api/pipeline` auth bypass** — move bearer token check before body validation | `src/app/api/pipeline/route.ts` | **Trivial** | Security vulnerability — unauthenticated requests reach the database |
| 5 | **Fix `/api/search/deep` infinite hang** — find unresolved promise or missing return | `src/app/api/search/deep/route.ts` | **Low** | Will cause 60s timeouts on Vercel, wasting function execution time |
| 6 | **Replace `text-neutral-500` with `dark:text-neutral-400`** across all secondary text | Global search-and-replace across `src/components/`, `src/app/` | **Low** | Single change fixes ~40 WCAG contrast violations — biggest a11y bang for buck |
| 7 | **Add auth-gated placeholders for /lists, /favorites, /settings** — show "Sign in required" message instead of silent homepage redirect | `src/app/lists/page.tsx`, `src/app/favorites/page.tsx`, `src/app/settings/page.tsx` | **Low** | 3 nav links appear broken. Follow the /map/templates pattern. |
| 8 | **Add profile page meta tags** — dynamic `<title>`, description, og:image from developer data | `src/app/profile/[username]/page.tsx` (metadata export) | **Low** | Zero SEO, blank browser tabs, broken social sharing for the page most likely to be shared |
| 9 | **Add "Index to unlock" CTA on unindexed profiles** — show disabled action buttons with explanation | `src/components/profile/ProfileActions.tsx` | **Medium** | Users see a stripped-down profile with no indication that more features exist |
| 10 | **Fix mobile nav collapse** — hide nav links behind hamburger at `sm` breakpoint | `src/components/layout/Header.tsx` | **Medium** | Mobile header is crowded with all links visible at 375px |

---

## Appendix: Source Report Index

| Report | File | Tests | Pass Rate |
|--------|------|-------|-----------|
| Search Flow | `search-flow-report.md` | 22 | 63.6% |
| Profile Pages | `profile-pages-report.md` | 83 | 73.5% |
| Market Map | `market-map-report.md` | 117 | 94.0% |
| Auth Features | `auth-features-report.md` | 50 | 68.0% |
| API Endpoints | `api-endpoints-report.md` | 20 | 45.0% |
| Scoring & Data | `scoring-data-report.md` | 12 | 16.7% |
| Performance | `performance-report.md` | 15 | 46.7% |
| Visual & A11y | `visual-a11y-report.md` | ~80 | ~77.5% |
| CRM Features | `crm-features-report.md` | 19 | 21.1% |

---

*Generated from 9 QA reports covering ~418 test assertions across search, profiles, market map, auth, APIs, scoring, performance, accessibility, and CRM features.*
