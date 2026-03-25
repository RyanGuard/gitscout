# GitScout QA Report: Navigation & Visual Quality

**Date:** 2026-03-25
**Environment:** localhost:3000 (Next.js dev server)
**Browser:** Chromium (Playwright 1.x, Desktop 1280x800)
**Auth state:** Logged out (unauthenticated)
**Test suite:** 53 tests | **52 passed** | **1 failed**

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Test Results Overview](#test-results-overview)
3. [Navigation Testing](#navigation-testing)
4. [Full-Page Screenshots](#full-page-screenshots)
5. [Dashboard & Landing Page](#dashboard--landing-page)
6. [Dark Theme Consistency](#dark-theme-consistency)
7. [Accessibility Audit (WCAG 2.1 AA)](#accessibility-audit)
8. [Page Load Performance](#page-load-performance)
9. [Visual & Layout Bug Check](#visual--layout-bug-check)
10. [Bugs & Issues Found](#bugs--issues-found)
11. [Recommendations](#recommendations)

---

## Executive Summary

GitScout's navigation and visual quality are **generally solid**. The top nav is consistent across all routes, dark theme adapts cleanly, and page load times are excellent (sub-1s for most routes). Two accessibility violations were found (color contrast), and one navigation bug was discovered with browser back/forward behavior. Several UX observations worth addressing are noted below.

**Severity breakdown:**
- **P1 (Bug):** 1 -- Browser back/forward skips intermediate history entries
- **P2 (A11y):** 2 -- Color contrast violations on /search and /profile pages
- **P3 (UX):** 3 -- Auth-gated pages show landing hero instead of login prompt; /lists shows loading then empty state for logged-out users; no "Favorites" link in top nav

---

## Test Results Overview

| Suite | Tests | Passed | Failed |
|-------|-------|--------|--------|
| Screenshots (light + dark) | 12 | 12 | 0 |
| Navigation - nav links | 8 | 8 | 0 |
| Navigation - back/forward | 1 | 0 | 1 |
| Dashboard content | 2 | 2 | 0 |
| Dark theme consistency | 6 | 6 | 0 |
| Accessibility audit | 6 | 6 | 0 |
| Performance metrics | 6 | 6 | 0 |
| Visual/layout checks | 12 | 12 | 0 |
| **Total** | **53** | **52** | **1** |

---

## Navigation Testing

### Top Nav Links

The header contains three nav links (Search, Match, Lists) plus the GitScout logo (links to /) and a Sign In button. All were tested on every route.

| Route | Search link | Match link | Lists link | Logo link | Header visible |
|-------|------------|------------|------------|-----------|----------------|
| `/` (home) | PASS | PASS | PASS | PASS | PASS |
| `/search` | PASS | PASS | PASS | PASS | PASS |
| `/lists` | PASS | PASS | PASS | PASS | PASS |
| `/match` | PASS | PASS | PASS | PASS | PASS |
| `/favorites` | PASS | PASS | PASS | PASS | PASS |
| `/profile/torvalds` | PASS | PASS | PASS | PASS | PASS |

**Click navigation:** All nav link clicks correctly navigate to their target routes. Logo click from `/search` returns to `/`.

**Observation:** There is no "Favorites" link in the top nav. Users must discover `/favorites` through the dashboard sidebar or by URL. Consider adding it to the nav (perhaps behind auth).

### Browser Back/Forward -- FAILED

**Bug:** When navigating `/` -> `/search` -> `/match` -> `/lists` and pressing Back, the browser skips `/match` and goes directly from `/lists` to `/`. The expected behavior is to step back through each page in order.

**Reproduction:**
1. Navigate to `/` -> `/search` -> `/match` -> `/lists` using `page.goto()`
2. Press browser Back button
3. **Expected:** lands on `/match`
4. **Actual:** lands on `/` (skipping `/match` and `/search`)

**Root cause hypothesis:** Using `page.goto()` for programmatic navigation may replace history entries rather than pushing. However, this also manifests with Next.js client-side navigation in some configurations. Worth verifying with real user click-through navigation.

**Severity:** P1 -- This affects core browser navigation UX.

---

## Full-Page Screenshots

All 12 screenshots captured successfully (6 routes x 2 themes). Files are in `qa-reports/screenshots/`.

| Route | Light | Dark |
|-------|-------|------|
| `/` (home) | `home-light.png` | `home-dark.png` |
| `/search` | `search-light.png` | `search-dark.png` |
| `/lists` | `lists-light.png` | `lists-dark.png` |
| `/match` | `match-light.png` | `match-dark.png` |
| `/favorites` | `favorites-light.png` | `favorites-dark.png` |
| `/profile/torvalds` | `profile-torvalds-light.png` | `profile-torvalds-dark.png` |

### Screenshot Observations

- **`/lists`** and **`/favorites`** both render the home landing hero page for logged-out users. `/favorites` does a server-side redirect to `/`. `/lists` renders client-side and shows a brief loading state then empty state, but screenshots captured the session-check loading phase which resolved to the landing hero.
- **`/match`** renders its own page (Match Candidates) even when logged out -- good, accessible to all users.
- **`/search`** renders its full filter UI (sort, languages, location, min stars, hireable checkbox) even without a query -- clean empty state.
- **`/profile/torvalds`** renders a complete profile with avatar, score badge (84.0), languages bar, and top repositories. Loads correctly from GitHub API.

---

## Dashboard & Landing Page

Tested in **logged-out** state (the Dashboard view with greeting/role cards requires authentication).

### Landing Hero (logged-out `/`)

| Element | Status | Notes |
|---------|--------|-------|
| "GitScout" heading (h1) | PASS | Centered, with GitBranch icon |
| Tagline text | PASS | "Source engineering talent from GitHub..." |
| Search input | PASS | Placeholder: "Search developers by name, language, or location..." |
| "Live GitHub search" feature | PASS | With Globe icon |
| "Apollo enrichment" feature | PASS | With Zap icon |
| "Push to Ashby" feature | PASS | With Shield icon |
| Sample search: "rust developers in San Francisco" | PASS | Clickable pill button |
| Sample search: "python machine learning" | PASS | Clickable pill button |
| Sample search: "TypeScript React" | PASS | Clickable pill button |
| Sample search: "go engineers in Berlin" | PASS | Clickable pill button |

### Role Cards (Dashboard -- logged-in only)

The following role preset buttons exist in the Dashboard component but are **not visible** to logged-out users (by design):

- Frontend Engineer, Backend Engineer, ML Engineer, DevOps / Infra, Rust Systems, Mobile Developer

**Observation:** These are not testable without authentication. Consider adding a demo/preview mode or testing with a mock session.

---

## Dark Theme Consistency

All 6 routes were tested with `prefers-color-scheme: dark`. No contrast issues or theme inconsistencies were detected by the automated checks.

| Route | Dark bg applied | Text contrast | Header border | Verdict |
|-------|----------------|---------------|---------------|---------|
| `/` | PASS | PASS | PASS | Clean |
| `/search` | PASS | PASS | PASS | Clean |
| `/lists` | PASS | PASS | PASS | Clean |
| `/match` | PASS | PASS | PASS | Clean |
| `/favorites` | PASS | PASS | PASS | Clean |
| `/profile/torvalds` | PASS | PASS | PASS | Clean |

**Visual review notes:**
- Header uses `bg-neutral-950/80` with `backdrop-blur-md` in dark mode -- looks polished.
- Search input, filter chips, cards all transition cleanly between themes.
- Match page's job description textarea has appropriate dark background (`dark:bg-neutral-900` border area).
- Profile page repo cards and language bars render well in dark mode.

---

## Accessibility Audit

Ran axe-core with WCAG 2.0 A, 2.0 AA, 2.1 A, and 2.1 AA rule sets.

| Route | Violations | Impact | Details |
|-------|-----------|--------|---------|
| `/` | 0 | -- | Clean |
| `/search` | **1** | **Serious** | Color contrast on `<kbd>` element (keyboard shortcut indicator) |
| `/lists` | 0 | -- | Clean |
| `/match` | 0 | -- | Clean |
| `/favorites` | 0 | -- | Clean |
| `/profile/torvalds` | **1** | **Serious** | Color contrast on 6 elements (`.text-neutral-400.text-xs` in repo cards) |

### Violation Details

#### 1. `/search` -- Color Contrast (kbd element)

- **Rule:** `color-contrast` (WCAG 2 AA 4.5:1 minimum ratio)
- **Impact:** Serious
- **Element:** `<kbd>` -- the keyboard shortcut hint (likely "Cmd+K") in the search bar
- **Fix:** Increase text color contrast or darken the `<kbd>` background. Consider using `text-neutral-600` instead of lighter shades.

#### 2. `/profile/torvalds` -- Color Contrast (repo metadata)

- **Rule:** `color-contrast` (WCAG 2 AA 4.5:1 minimum ratio)
- **Impact:** Serious
- **Affected:** 6 nodes -- the `.text-neutral-400.text-xs` spans inside repository cards (likely star count, language, or date metadata)
- **Fix:** Change `text-neutral-400` to `text-neutral-500` for these small text elements to meet the 4.5:1 ratio against white backgrounds.

---

## Page Load Performance

All metrics measured via the Performance API (local dev server, Chromium).

| Route | TTFB | FCP | DOM Content Loaded | Load Complete | Network Idle |
|-------|------|-----|-------------------|---------------|-------------|
| `/` | 37ms | 64ms | 58ms | 193ms | 750ms |
| `/search` | 48ms | 104ms | 97ms | 242ms | 868ms |
| `/lists` | 33ms | 64ms | 60ms | 225ms | 861ms |
| `/match` | 30ms | 64ms | 57ms | 248ms | 809ms |
| `/favorites` | 74ms | 100ms | 95ms | 229ms | 778ms |
| `/profile/torvalds` | 53ms | 76ms | **714ms** | **953ms** | **1525ms** |

### Performance Observations

- **All pages load under 1 second** (network idle) except `/profile/torvalds` at 1.5s, which involves a live GitHub API fetch -- acceptable.
- **TTFB is excellent** across the board (30-74ms), indicating healthy server-side performance.
- **FCP is fast** (64-104ms) -- users see content almost immediately.
- **`/profile/torvalds`** has a notably higher DOM Content Loaded (714ms) due to the GitHub API call for profile data + repos. This is expected for live-fetched profiles.
- **`/favorites`** has a higher TTFB (74ms) likely due to the server-side session check + redirect.

**Verdict:** Performance is excellent for a dev server. Production (Vercel) with CDN caching should be even faster for static pages.

---

## Visual & Layout Bug Check

Automated checks for horizontal overflow, z-index issues, viewport overflow, broken images, and empty interactive elements.

| Route | Horizontal Scroll | Header z-index | Viewport Overflow | Broken Images | Empty Links |
|-------|-------------------|----------------|-------------------|---------------|-------------|
| `/` | PASS | PASS | PASS | PASS | PASS |
| `/search` | PASS | PASS | PASS | PASS | PASS |
| `/lists` | PASS | PASS | PASS | PASS | PASS |
| `/match` | PASS | PASS | PASS | PASS | PASS |
| `/favorites` | PASS | PASS | PASS | PASS | PASS |
| `/profile/torvalds` | PASS | PASS | PASS | PASS | PASS |

**No layout bugs, z-index issues, or broken elements detected on any route.**

---

## Bugs & Issues Found

### P1: Browser Back/Forward Navigation Skips History Entries

- **Severity:** P1 (functional bug)
- **Route:** Cross-route navigation
- **Description:** Pressing the browser Back button after navigating through multiple pages skips intermediate entries. From `/lists`, Back goes to `/` instead of stepping through `/match` then `/search`.
- **Impact:** Users who navigate via top nav links and then use Back/Forward will have unpredictable navigation.
- **Likely cause:** Next.js App Router client-side navigation may be coalescing or replacing history entries in certain transition patterns. Needs investigation in Next.js 16 history handling.

### P2: Color Contrast - Search Page kbd Element

- **Severity:** P2 (accessibility, WCAG 2 AA)
- **Route:** `/search`
- **Element:** `<kbd>` keyboard shortcut hint
- **Fix:** Darken text or add background contrast to meet 4.5:1 ratio.

### P2: Color Contrast - Profile Page Repo Card Metadata

- **Severity:** P2 (accessibility, WCAG 2 AA)
- **Route:** `/profile/[username]`
- **Elements:** 6 instances of `.text-neutral-400.text-xs` in repo cards
- **Fix:** Use `text-neutral-500` instead of `text-neutral-400` for small metadata text.

### P3: Auth-Gated Pages Show Landing Hero for Logged-Out Users

- **Severity:** P3 (UX)
- **Routes:** `/favorites`, `/lists`
- **Description:** `/favorites` redirects to `/` (server-side). `/lists` renders a loading spinner then empty state but visually appears as the landing page during session check. Neither shows a "Please sign in to access this feature" message.
- **Recommendation:** Add a logged-out state for these pages with a sign-in prompt and explanation of the feature.

### P3: No "Favorites" Link in Top Navigation

- **Severity:** P3 (UX/discoverability)
- **Description:** The top nav has Search, Match, Lists but no Favorites link. The Favorites page is only accessible via the Dashboard sidebar (logged-in) or direct URL.
- **Recommendation:** Add Favorites to the nav (conditionally shown when authenticated), or merge it into Lists.

### P3: `/lists` Empty State for Logged-Out Users

- **Severity:** P3 (UX)
- **Description:** The Lists page client-side checks session and shows loading/empty state to logged-out users. It eventually renders but provides no indication that authentication is needed.

---

## Recommendations

1. **Investigate Next.js 16 history behavior** for the back/forward bug. Test with `router.push()` click-based navigation (not `page.goto()`) to determine if this is a Playwright artifact or a real app bug.

2. **Fix color contrast violations:**
   - `/search`: Darken the `<kbd>` shortcut indicator text
   - `/profile`: Change repo card metadata from `text-neutral-400` to `text-neutral-500`

3. **Add logged-out states** for `/lists` and `/favorites` with a "Sign in to access" prompt instead of redirecting to home or showing empty states.

4. **Consider adding Favorites to the top nav** for authenticated users, or surface it more prominently.

5. **Test with authenticated session** to validate:
   - Dashboard greeting (time-of-day based)
   - Role preset cards (Frontend Engineer, Backend Engineer, etc.)
   - Daily Briefing and City Grid components
   - Saved Developers sidebar section

---

## Files Generated

```
qa-reports/
  navigation-report.md          -- This report
  qa-full-data.json             -- Raw accessibility, performance, visual bug data
  qa-data.json                  -- Navigation test data
  results.json                  -- Full Playwright test results (JSON)
  screenshots/
    home-light.png              -- Landing page (light)
    home-dark.png               -- Landing page (dark)
    search-light.png            -- Search page (light)
    search-dark.png             -- Search page (dark)
    lists-light.png             -- Lists page (light)
    lists-dark.png              -- Lists page (dark)
    match-light.png             -- Match page (light)
    match-dark.png              -- Match page (dark)
    favorites-light.png         -- Favorites page (light)
    favorites-dark.png          -- Favorites page (dark)
    profile-torvalds-light.png  -- Profile page (light)
    profile-torvalds-dark.png   -- Profile page (dark)
```

---

*Report generated by Playwright automated QA suite on 2026-03-25.*
