# QA Report: Search Page (`/search`)

**Date:** 2026-03-25
**Environment:** localhost:3000 (Next.js 16.2.1 dev server)
**Tool:** Playwright 1.52.0 + Chromium (headless)
**Test File:** `tests/e2e/search.spec.ts`
**Config:** `playwright-search.config.ts`

---

## Executive Summary

111 tests executed across 3 viewport sizes (desktop 1280px, tablet 768px, mobile 375px). **89.2% pass rate** with 12 failures. The primary issue is intermittent search API timeouts (likely GitHub API rate limiting), followed by a UI bug where the sticky header blocks filter interactions on smaller viewports.

| Metric | Value |
|--------|-------|
| Total tests | 111 |
| Passed | 99 (89.2%) |
| Failed | 12 (10.8%) |
| Skipped | 0 |
| Total runtime | 13m 30s |

---

## Results by Viewport

| Viewport | Width | Passed | Failed | Pass Rate |
|----------|-------|--------|--------|-----------|
| Desktop | 1280px | 32 | 5 | 86.5% |
| Tablet | 768px | 33 | 4 | 89.2% |
| Mobile | 375px | 34 | 3 | 91.9% |

---

## Results by Test Category

| Category | Tests/viewport | Desktop | Tablet | Mobile |
|----------|---------------|---------|--------|--------|
| Page Load | 3 | 3/3 | 3/3 | 3/3 |
| Search Execution | 4 | 0/4 | 3/4 | 3/4 |
| Filters | 6 | 6/6 | 5/6 | 5/6 |
| Empty & Invalid Inputs | 6 | 6/6 | 5/6 | 6/6 |
| Result Card Rendering | 4 | 4/4 | 4/4 | 4/4 |
| Loading Animations | 2 | 2/2 | 2/2 | 2/2 |
| Responsive Layout | 5 | 5/5 | 4/5 | 5/5 |
| Console Errors | 3 | 2/3 | 3/3 | 2/3 |
| Pagination | 2 | 2/2 | 2/2 | 2/2 |
| Performance | 2 | 2/2 | 2/2 | 2/2 |

---

## Bugs Found

### BUG-1 (High): Search API intermittently hangs with no timeout/error handling

**Affected:** All viewports
**Repro:** Type "react" into search bar, click Search. Intermittently, the API call hangs for 60+ seconds with no response.
**Frequency:** 8 of 12 failures were API timeouts. The query "react" timed out on all 3 viewports consistently. Other queries ("python", "torvalds", "typescript", "gibberish") timed out intermittently on desktop.
**Root Cause:** Likely GitHub Search API rate limiting (30 req/min for authenticated users). When rate-limited, the `/api/search` route hangs indefinitely instead of returning an error.
**User Impact:** The user sees the loading spinner ("Scouting 100M+ profiles...") forever. No error message, no timeout, no way to cancel. The page appears frozen.
**Screenshot:** `qa-reports/test-results/search-Search-Execution-basic-search-returns-results-desktop/test-failed-1.png` - shows empty page with filters only, no loading indicator or error.

**Recommendation:**
1. Add a client-side fetch timeout (e.g., 15 seconds) with an AbortController
2. Show an error state when the API fails: "Search timed out. GitHub may be rate-limiting requests. Try again in a moment."
3. Add retry logic with exponential backoff in the API route
4. Display remaining GitHub API rate limit in the UI or at least log it server-side

---

### BUG-2 (Medium): Sticky header blocks "Clear filters" button on tablet/mobile

**Affected:** Tablet (768px), Mobile (375px)
**Repro:** Open /search?q=developer, open filters sidebar, select a language filter (e.g. TypeScript), then try to click the "Clear (1)" button at the top of the filter sidebar.
**Observed:** Click is intercepted by the sticky `<header class="sticky top-0 z-50 ...">` element which overlaps the filter sidebar's scroll position. Playwright error: `<header> subtree intercepts pointer events`.
**Expected:** Clear button should be clickable at all viewports.
**Screenshot:** `qa-reports/test-results/search-Filters-clear-filters-resets-all-mobile/test-failed-1.png`

**Recommendation:**
1. Add `scroll-margin-top` or `scroll-padding-top` to the filter sidebar to account for the sticky header height
2. Or increase the `z-index` of the filter sidebar above the header when the sidebar is open on mobile
3. Or move the Clear button below the header overlap zone

---

### BUG-3 (Low): Filter sidebar overlaps results on mobile (375px)

**Affected:** Mobile (375px)
**Observed:** When the filter sidebar is expanded on mobile, it takes full width but the results area is still partially visible behind it, creating a cluttered overlapping layout. Results text bleeds through on the right edge.
**Screenshot:** `qa-reports/screenshots/results-mobile.png` - filter sidebar and result cards overlap visually.

**Recommendation:**
1. When filter sidebar is open on mobile, hide the results area entirely (e.g., `display: none` or a backdrop overlay)
2. Or use a slide-over panel / bottom sheet pattern for mobile filters

---

### BUG-4 (Low): Search input fill unreliable at tablet width (768px)

**Affected:** Tablet (768px) only
**Repro:** Navigate to /search, programmatically fill the search input with "test", read back the value.
**Observed:** Input value reads back as empty string despite the fill operation.
**Frequency:** 1/1 (only tested once at this viewport).
**Possible Cause:** React controlled component hydration timing issue, or the search input is briefly unmounted/remounted during responsive layout shifts at this breakpoint.
**Screenshot:** `qa-reports/test-results/search-Responsive-Layout-search-input-is-visible-and-usable-tablet/test-failed-1.png` - shows focused but empty input at 768px.

**Recommendation:** Investigate whether the search input component re-renders at the `lg` (1024px) breakpoint boundary. At 768px the "Filters" toggle button appears, which may cause a layout shift that resets the input.

---

## Performance Metrics

### Page Load (localhost, dev server)

| Metric | Desktop | Tablet | Mobile |
|--------|---------|--------|--------|
| Initial page load | 310ms | 168ms | 180ms |
| Full load (networkidle) | 709ms | 693ms | 712ms |
| DOM Content Loaded | 62ms | 52ms | 48ms |
| TTFB | 26ms | 25ms | 26ms |

### Search Execution (when API responds)

| Metric | Desktop | Tablet | Mobile |
|--------|---------|--------|--------|
| Total search time (query to results) | 414ms | 188ms | 569ms |

**Assessment:** Page load performance is excellent. Sub-second full loads across all viewports. Search API response times are good when GitHub responds (under 600ms end-to-end). The problem is entirely when GitHub rate-limits or the API hangs.

---

## Test Details: All Passing Tests

### Page Load (9/9 passed)
- Search page loads with HTTP 200 across all viewports
- Page title is present and non-empty
- Cmd+K / Ctrl+K keyboard shortcut correctly focuses the search input

### Filters (16/18 passed)
- Language pill toggles correctly update URL (`?languages=typescript`)
- Sort option buttons update URL (`?sort=followers`)
- Location text input updates URL on blur (`?location=New%20York`)
- Min stars number input updates URL (`?minStars=100`)
- Hireable checkbox adds `?hireable=true` to URL
- Clear filters button resets URL on desktop (fails on tablet/mobile - see BUG-2)

### Empty & Invalid Inputs (17/18 passed)
- Empty search submission: page stays on /search, no crash
- Whitespace-only search: treated as empty, no crash
- XSS attempt (`<script>alert("xss")</script>`): properly escaped, no injection, page remains functional
- 500-character query: handled gracefully, no crash
- Gibberish query: shows "No developers found" with helpful search tips
- Negative min stars (-50): accepted without validation (potential minor issue)

### Result Card Rendering (12/12 passed)
- Developer cards contain avatar images, usernames, and profile links
- Profile links follow correct format (`/profile/{username}`)
- Avatar images load successfully (after scroll-into-view for lazy loading)
- Result count text ("X developers found") is displayed

### Loading Animations (6/6 passed)
- SearchRadar animated SVG + rotating loading messages appear during search
- Loading state clears completely after results arrive

### Responsive Layout (14/15 passed)
- Search input visible and usable at all widths
- Search button visible and enabled at all widths
- No horizontal overflow at any viewport
- Result cards fit within viewport bounds
- Filter sidebar: visible by default on desktop (1280px), toggle button on tablet/mobile

### Console Errors (7/9 passed)
- No critical console errors on page load (all 3 viewports)
- No unhandled JS exceptions during rapid interaction (fill, search, clear, search again)
- Console errors during search: timed out on desktop/mobile (see BUG-1)

### Pagination (6/6 passed)
- "Page X of Y" text displayed for multi-page results
- Next/Previous buttons navigate between pages

### Performance (6/6 passed)
- Page loads in under 5 seconds at all viewports
- Search completes in under 15 seconds when API responds

---

## Screenshot Inventory

| Screenshot | Description |
|------------|-------------|
| `screenshots/responsive-desktop.png` | Search page at 1280px - clean layout |
| `screenshots/responsive-mobile.png` | Search page at 375px - filters visible |
| `screenshots/results-desktop.png` | Desktop with "go" search - no-results state |
| `screenshots/results-tablet.png` | Tablet with results |
| `screenshots/results-mobile.png` | Mobile with results - filter/results overlap (BUG-3) |
| `screenshots/result-cards.png` | Developer cards rendering (mobile) |
| `screenshots/loading-state.png` | SearchRadar animation + "Scouting 100M+ profiles..." |
| `screenshots/filters-desktop.png` | Filter sidebar on desktop |
| `screenshots/filters-tablet.png` | Filter sidebar on tablet |
| `screenshots/filters-mobile.png` | Filter sidebar on mobile |
| `screenshots/empty-search.png` | Empty search submission state |
| `screenshots/whitespace-search.png` | Whitespace-only search state |
| `screenshots/special-chars-search.png` | XSS attempt - properly escaped |
| `screenshots/long-query-search.png` | 500-char query - handled gracefully |
| `screenshots/gibberish-search.png` | Nonsense query - shows empty state with tips |
| `screenshots/negative-stars.png` | Negative min stars value accepted |
| `test-results/search-*-desktop/test-failed-1.png` | Failure screenshots (auto-captured) |
| `test-results/search-*-tablet/test-failed-1.png` | Failure screenshots (auto-captured) |
| `test-results/search-*-mobile/test-failed-1.png` | Failure screenshots (auto-captured) |

---

## Recommendations

### Priority 1 (Fix Before Release)
1. **Add fetch timeout + error state for search API** - Users currently see an infinite loading spinner when GitHub rate-limits. Add a 15s AbortController timeout and show a user-friendly error.
2. **Fix sticky header z-index overlap on mobile/tablet** - The "Clear filters" button (and potentially other top-of-sidebar elements) are unclickable because the sticky header sits on top.

### Priority 2 (Should Fix)
3. **Fix mobile filter/results overlap** - On 375px, the filter sidebar and results area overlap visually. Use a modal/overlay pattern for mobile filters.
4. **Add input validation for min stars** - Currently accepts negative values. Add `min="0"` to the number input.

### Priority 3 (Nice to Have)
5. **Add rate limit awareness** - Show the user when they're approaching GitHub's rate limit, or queue requests.
6. **Add search cancellation** - Allow users to cancel an in-flight search (e.g., clicking Search again or pressing Escape).
7. **Investigate tablet input reactivity** - The 768px input fill failure may indicate a React hydration edge case at the responsive breakpoint.

---

## Test Artifacts

- **Test source:** `tests/e2e/search.spec.ts` (37 tests x 3 viewports = 111 total)
- **Config:** `playwright-search.config.ts`
- **JSON results:** `qa-reports/results.json`
- **Failure screenshots:** `qa-reports/test-results/search-*/test-failed-1.png`
- **Manual screenshots:** `qa-reports/screenshots/*.png`
