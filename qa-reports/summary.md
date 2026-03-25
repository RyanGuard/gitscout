# GitScout QA Executive Summary

**Date:** 2026-03-25
**Environment:** localhost:3000 (Next.js 16.2.1 dev, Chromium/Playwright)
**Auth State:** Unauthenticated (all tests)
**Reports Consolidated:** API, Search, Profiles, Navigation, Features

---

## Overall Health Score: 5/10

The core infrastructure (API routes, auth gates, database, page rendering, performance) is solid. However, **8 feature components are fully built but never rendered**, making roughly a third of the app's interactive surface area invisible to users. The search API lacks timeout handling, and a security issue (XSS reflection) needs attention. Until the unwired components are mounted and the search reliability is addressed, the app is not release-ready.

---

## Test Summary

| Report | Tests | Passed | Failed | Skipped | Pass Rate |
|--------|-------|--------|--------|---------|-----------|
| API | 57 | 53 | 4 | 0 | 93.0% |
| Search | 111 | 99 | 12 | 0 | 89.2% |
| Profiles | 20 | 20 | 0 | 0 | 100% |
| Navigation | 53 | 52 | 1 | 0 | 98.1% |
| Features | 44 | 23 | 14 | 7 | 52.3% |
| **Total** | **285** | **247** | **31** | **7** | **86.7%** |

---

## Critical Bugs

### CRIT-1: 8 feature components built but never rendered

**Impact:** Users cannot access keyboard shortcuts, sound effects, celebrations, scouting reports, outreach drafts, find-similar, or share cards. All are fully implemented with zero render paths.

| Component | File | Where It Should Be |
|-----------|------|--------------------|
| `KeyboardOverlay` | `src/components/features/KeyboardOverlay.tsx` | Root layout / Providers |
| `SoundToggle` | `src/components/ui/SoundToggle.tsx` | `src/components/layout/Header.tsx` |
| `SoundProvider` | `src/components/ui/SoundToggle.tsx` | `src/components/auth/Providers.tsx` |
| `CelebrationProvider` | `src/components/features/Celebrations.tsx` | `src/components/auth/Providers.tsx` |
| `ScoutingReport` | `src/components/features/ScoutingReport.tsx` | `src/app/profile/[username]/page.tsx` |
| `OutreachDraft` | `src/components/features/OutreachDraft.tsx` | `src/app/profile/[username]/page.tsx` |
| `FindSimilar` | `src/components/features/FindSimilar.tsx` | `src/app/profile/[username]/page.tsx` |
| `ShareCard` | `src/components/features/ShareCard.tsx` | `src/app/profile/[username]/page.tsx` |

**Repro:** Press `?` on any page — no keyboard overlay appears. Visit any profile — no Scouting Report, Outreach Draft, Find Similar, or Share Card buttons exist.

**Source:** features-report.md, profiles-report.md

### CRIT-2: Search API hangs indefinitely when GitHub rate-limits

**Impact:** Users see an infinite loading spinner ("Scouting 100M+ profiles...") with no error, no timeout, and no way to cancel. Caused 8 of 12 search test failures.

**Repro:** Search for "react" repeatedly until GitHub rate-limits. The loading spinner runs forever.

**Fix:**
1. Add `AbortController` with 15s client-side timeout in search page
2. Show error state: "Search timed out. Try again in a moment."
3. In `/api/search`, check for 429 responses from GitHub and return a proper error

**Source:** search-report.md (BUG-1)

---

## High Priority Issues

### HIGH-1: XSS payload reflected in `/api/search` response

The `query` field in the search JSON response echoes raw user input including `<script>` tags. While JSON APIs don't directly execute scripts, any client rendering this field via `dangerouslySetInnerHTML` or DOM injection becomes vulnerable.

**Repro:** `GET /api/search?q=<script>alert(1)</script>` — response contains unescaped `<script>` in `query` field.

**Fix:** Sanitize or HTML-escape the `query` field before including in response.

**File:** `src/app/api/search/route.ts`
**Source:** api-report.md

### HIGH-2: GitHub 429 (rate limit) returned as 404 "not found"

`/api/score/[username]` checks `if (!userRes.ok)` and returns 404 regardless of whether GitHub returned 404 or 429. Users see "Developer not found" when the real issue is rate limiting.

**Repro:** Exhaust GitHub API rate limit, then `GET /api/score/torvalds` — returns 404 "Developer not found on GitHub".

**Fix:** Check `userRes.status` explicitly: 404 -> "not found", 429 -> "rate limit exceeded", other -> "GitHub API error".

**File:** `src/app/api/score/[username]/route.ts`
**Source:** api-report.md

### HIGH-3: No `GITHUB_TOKEN` configured — 60 req/hr limit

The environment is running at GitHub's unauthenticated rate limit (60 req/hr) instead of the authenticated limit (5,000 req/hr). This directly causes CRIT-2 and HIGH-2 to trigger frequently.

**Fix:** Set `GITHUB_TOKEN` environment variable with a GitHub PAT.

**Source:** api-report.md

---

## Medium Priority Issues

| ID | Issue | Route | Source |
|----|-------|-------|--------|
| MED-1 | Sticky header (`z-50`) blocks "Clear filters" button on tablet/mobile | `/search` (768px, 375px) | search-report.md (BUG-2) |
| MED-2 | Browser back/forward skips intermediate history entries | Cross-route | navigation-report.md |
| MED-3 | Keyboard chord nav uses `window.location.href` (full reload) instead of `router.push()` | All pages | features-report.md |

**MED-1 Repro:** Open `/search?q=developer` on tablet, open filters, select a language, try clicking "Clear (1)" — click intercepted by sticky header.
**Fix:** Add `scroll-margin-top` to filter sidebar or raise its `z-index` when open.

**MED-2 Repro:** Navigate `/` -> `/search` -> `/match` -> `/lists` via nav links, press Back — lands on `/` instead of `/match`.
**Note:** May be a Playwright `page.goto()` artifact. Verify with real click navigation.

---

## Low Priority Issues

| ID | Issue | Route | Source |
|----|-------|-------|--------|
| LOW-1 | Filter sidebar overlaps results on mobile (375px) | `/search` | search-report.md (BUG-3) |
| LOW-2 | Search input fill unreliable at 768px tablet breakpoint | `/search` | search-report.md (BUG-4) |
| LOW-3 | WCAG 2 AA color contrast violation on `<kbd>` shortcut hint | `/search` | navigation-report.md |
| LOW-4 | WCAG 2 AA color contrast on `.text-neutral-400.text-xs` repo metadata (6 nodes) | `/profile/[username]` | navigation-report.md |
| LOW-5 | Auth-gated pages (`/lists`, `/favorites`) show landing hero instead of "sign in" prompt | `/lists`, `/favorites` | navigation-report.md |
| LOW-6 | No "Favorites" link in top navigation | Header | navigation-report.md |
| LOW-7 | Invalid JSON body to `POST /api/search` returns 200 SSE instead of 400 | `/api/search` | api-report.md |
| LOW-8 | Invalid JSON body to `POST /api/match` returns 500 instead of 400 | `/api/match` | api-report.md |
| LOW-9 | Negative values accepted in min stars filter (`min="0"` missing) | `/search` | search-report.md |
| LOW-10 | Inconsistent 404 pages (custom vs Next.js default) for different error types | `/profile/*` | profiles-report.md |

---

## Performance Summary

Performance is excellent across the board.

| Metric | Best | Worst | Threshold | Verdict |
|--------|------|-------|-----------|---------|
| TTFB | 25ms | 74ms | <200ms | PASS |
| FCP | 48ms | 104ms | <1000ms | PASS |
| Full Page Load | 193ms | 953ms | <3000ms | PASS |
| Network Idle | 693ms | 1525ms | <5000ms | PASS |
| Search (when API responds) | 188ms | 569ms | <15000ms | PASS |
| API: `/api/stats` | 75ms | 458ms | <2000ms | PASS |

**Slowest route:** `/profile/torvalds` at 1.5s network idle — expected due to live GitHub API fetch + score computation.

**Performance concern:** Search has no timeout. When GitHub rate-limits, the search hangs for 60+ seconds. This is a reliability issue, not a speed issue.

---

## Features: Working vs Broken

### Working (13 features)
- Live GitHub search with filters (language, location, stars, hireable, sort)
- Search pagination
- Result card rendering with avatars, links, metadata
- Developer profile pages (live GitHub fetch + local DB)
- Score breakdown with 5 pillars
- Repository, language, and organization sections on profiles
- Match candidates from job description (`/match`)
- JD parsing API (`/api/match/parse`)
- Auth gates on all protected routes (401s correct)
- Dark theme across all routes
- Responsive layout (desktop/tablet/mobile)
- Developer card SVG generation (`/api/developer-card`)
- Landing page with sample search pills

### Broken / Not Accessible (8 features)
- Keyboard shortcuts overlay (`?` key) — component not mounted
- Keyboard chord navigation (`g+h`, `g+s`, `g+l`) — component not mounted
- `/` key to focus search — depends on unmounted hook
- Sound effects toggle — component not rendered in header
- Celebration animations (Konami code, milestones) — provider not mounted
- Scouting report generation — component not wired to profile page
- Outreach draft generation — component not wired to profile page
- Find Similar developers — component not wired to profile page

### Not Testable (auth required)
- Favorites CRUD (save/unsave developers)
- Saved lists CRUD (create, rename, delete lists)
- List entries (add developers, notes, stages, tags)
- CSV export from lists
- Enrich developer (Apollo.io)
- Push to Ashby ATS
- Dashboard (greeting, role cards, daily briefing)

---

## Top 5 Recommendations (Priority Order)

### 1. Wire up all 8 unmounted components
**Files to modify:**
- `src/components/auth/Providers.tsx` — wrap children with `SoundProvider` and `CelebrationProvider`
- `src/components/layout/Header.tsx` — add `<SoundToggle />` and `<KeyboardOverlay />`
- `src/app/profile/[username]/page.tsx` — import and render `ScoutingReport`, `OutreachDraft`, `FindSimilar`, `ShareCard`

**Why first:** This single fix resolves all 14 feature test failures, makes 8 built features accessible, and dramatically improves the pass rate. The components are already implemented — they just need imports.

### 2. Add search timeout + error states
**Files to modify:**
- `src/app/search/page.tsx` (or search hook) — add `AbortController` with 15s timeout
- `src/components/search/SearchResults.tsx` — add error/timeout UI state

**Why second:** An infinite loading spinner is the worst user experience. This is the most common failure mode under real usage.

### 3. Fix rate limit handling across API routes
**Files to modify:**
- `src/app/api/score/[username]/route.ts` — differentiate 404 vs 429 vs other errors
- `src/app/api/search/route.ts` — sanitize `query` field in response (XSS), handle GitHub 429

**Why third:** Correct error messages prevent user confusion and fix the XSS reflection. Configure `GITHUB_TOKEN` in the environment to move from 60 to 5,000 req/hr.

### 4. Fix mobile/tablet UI issues
**Files to modify:**
- `src/components/search/SearchFilters.tsx` — add `scroll-margin-top` or increase `z-index` when filter sidebar is open on mobile
- `src/components/search/SearchFilters.tsx` — use overlay/backdrop pattern on mobile to prevent results bleed-through

**Why fourth:** The sticky header blocking filter interactions affects real user workflows on mobile/tablet.

### 5. Fix accessibility color contrast violations
**Files to modify:**
- `src/components/ui/SearchInput.tsx` (or wherever `<kbd>` is styled) — darken the keyboard shortcut hint text
- `src/components/profile/RepoCard.tsx` — change `text-neutral-400` to `text-neutral-500` for metadata text

**Why fifth:** WCAG 2 AA compliance. Two "serious" violations affecting readability of small text elements.

---

## Security Summary

| Check | Result |
|-------|--------|
| Secret leaks in API responses | None found (57 responses scanned) |
| SQL injection | Protected (Prisma parameterized queries) |
| XSS in rendered pages | Safe (Next.js escaping) |
| XSS in API JSON response | **`query` field reflects raw input** (MED severity) |
| Path traversal | Safe (404 on `../etc/passwd`) |
| Auth bypass | None found (all protected routes return 401) |
| Method enforcement | Correct (405 on wrong HTTP methods) |

---

*Consolidated from 5 QA reports: api-report.md, search-report.md, profiles-report.md, navigation-report.md, features-report.md*
