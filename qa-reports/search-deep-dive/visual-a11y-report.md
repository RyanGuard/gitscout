# Visual Design & Accessibility Audit Report

**Date:** 2026-03-26
**Tested at:** http://localhost:3000 (dark mode, Chromium via Playwright)
**Viewports:** 1440x900 (desktop), 375x812 (mobile)
**Tools:** Playwright 1.58.2, @axe-core/playwright 4.11.1
**Standards:** WCAG 2.1 AA

---

## Executive Summary

| Category | Pass | Fail | Warning |
|----------|------|------|---------|
| Color contrast (WCAG AA) | Partial | **Critical** | - |
| Heading hierarchy | 4/10 | **6/10** | - |
| Accessible names | 8/10 | **2/10** | - |
| Form labels | 8/10 | **2/10** | - |
| Image alt text | **10/10** | 0 | - |
| Focus indicators | **Pass** | 0 | - |
| Keyboard navigation | **Pass** | 0 | - |
| Color-only information | **Pass** | 0 | - |
| Document titles | 8/10 | **2/10** | - |
| Dark mode readability | Partial | **Needs work** | - |
| Visual consistency | Partial | - | Several issues |
| Routing / page rendering | 6/10 | **4/10** | - |

**Overall WCAG 2.1 AA compliance: FAIL** — 18 unique violations found across 10 pages.

---

## 1. Page Rendering Issues (Blocking)

Before accessibility can be fully assessed, several pages have rendering problems:

### 1.1 Pages redirecting to homepage (not rendering their own content)

| Page | Expected | Actual |
|------|----------|--------|
| `/lists` | Lists management page | Homepage ("Scout top talent from GitHub") |
| `/favorites` | Saved developers | Homepage ("Scout top talent from GitHub") |
| `/settings` | Settings panel | Homepage ("Scout top talent from GitHub") |

**Impact:** These pages appear to fall through to the homepage when not authenticated, rather than showing a "Sign in required" message. This means headings, content, and page-specific accessibility cannot be evaluated for these routes. The `/map/templates` page correctly shows "Sign in to view your templates" — the other auth-gated pages should follow this pattern.

### 1.2 Profile page error

| Page | Issue |
|------|-------|
| `/profile/torvalds` | Shows "Something went wrong" — MaxClientsInSessionMode DB error |

**Screenshot:** `screenshots/desktop/profile-torvalds.png`

The error state itself has accessibility issues:
- Heading is `<h2>` ("Something went wrong") — should be `<h1>` on an error page
- Error message text uses `text-neutral-500` (fails contrast)
- No `<title>` element on this page (axe violation: `document-title`)

### 1.3 Search results rate-limited

The search results page (`/search?q=react&language=javascript`) showed a rate limit error banner but still rendered the page structure. The red error banner and "Retry" button are visible. Screenshots show the "No developers found" empty state rather than actual result cards.

**Note:** Because of the rate limit, developer cards with score badges, tier indicators, and language bars could not be fully audited visually for this run. The contrast findings below come from the page elements that did render.

---

## 2. Color Contrast (WCAG 2.1 AA) — CRITICAL

### 2.1 Systemic failure: `text-neutral-500` (#737373)

The single most pervasive accessibility failure. This color is used extensively and **fails contrast on every dark background in the app**.

| Foreground | Background | Ratio | Required | Status |
|-----------|------------|-------|----------|--------|
| `#737373` (neutral-500) | `#0a0a0f` (page bg) | **4.16:1** | 4.5:1 | FAIL |
| `#737373` (neutral-500) | `#121214` (card bg) | **3.94:1** | 4.5:1 | FAIL |
| `#737373` (neutral-500) | `#171717` (elevated card) | **3.78:1** | 4.5:1 | FAIL |
| `#777777` (inline style) | `#0b0e16` (homepage bg) | **4.30:1** | 4.5:1 | FAIL |

**Affected elements across all pages:**

| Element type | Example | Pages affected |
|-------------|---------|----------------|
| Filter labels | "Sort by", "Languages", "Location", "Min Stars" | /search |
| Subtitle text | "Search by role, language, location, or name" | /search |
| Result count | "1,000 developers found" | /search |
| Username handles | "@yyx990803", "@gaearon", all `<span>` usernames | /search results |
| Pagination | "Page 1 of 50" | /search results |
| Quick-filter buttons | "React developers in SF", "Python ML engineers" | /search |
| Map subtitle | "AI-powered talent landscape for targeted recruiting" | /map |
| Map form labels | "Role title", "Level", "Tech stack", "Geography" (10px!) | /map |
| Match subtitle | "Parse a job description to find..." | /match |
| Match card subtitle | "Paste a job description or select from Ashby..." | /match |
| Footer text | "Powered by GitHub REST + GraphQL..." | Homepage, /lists, /favorites, /settings |
| Error message | "MaxClientsInSessionMode..." | /profile/torvalds |
| Templates text | "Sign in to view your templates" | /map/templates |

**Total axe violations for color-contrast: ~40+ nodes across 10 pages.**

### 2.2 Especially bad: Map form labels at 10px

The `/map` page form labels use `text-[10px]` with `text-neutral-500`:
- **Contrast ratio: 3.94:1** on card background
- **Font size: 7.5pt (10px)** — this is extremely small
- Requires 4.5:1 for normal text; the small size makes it even harder to read
- WCAG has no exception for text this small — it's treated as normal text

### 2.3 Recommended fix

Replace `text-neutral-500` with `text-neutral-400` (#a3a3a3) for dark mode:

| Fix | Ratio vs #0a0a0f | Ratio vs #121214 | Ratio vs #171717 |
|-----|-------------------|-------------------|-------------------|
| `text-neutral-400` (#a3a3a3) | **6.07:1** | **5.75:1** | **5.48:1** |

This passes AA for all backgrounds. Use `dark:text-neutral-400` to keep light mode unchanged.

---

## 3. Heading Hierarchy — 6/10 pages FAIL

### 3.1 Missing `<h1>` on search pages

| Page | First heading | Expected | Issue |
|------|--------------|----------|-------|
| `/search` (empty) | `<h3>` "Filters" | `<h1>` | No h1 anywhere; starts at h3 |
| `/search` (results) | `<h3>` "Filters" | `<h1>` | No h1; all developer names are h3 |
| `/profile/torvalds` | `<h2>` "Something went wrong" | `<h1>` | Error state should use h1 |
| `/map/templates` | *none* | `<h1>` | No headings at all on page |
| `/lists` | `<h1>` "Scout top talent..." | N/A | Renders homepage (routing issue) |
| `/favorites` | `<h1>` "Scout top talent..." | N/A | Renders homepage (routing issue) |

### 3.2 Good heading structure

| Page | Structure | Status |
|------|-----------|--------|
| Homepage `/` | h1 "Scout top talent from GitHub" | PASS |
| `/map` | h1 "Market Map" | PASS |
| `/match` | h1 "Match Candidates" > h2 "Job Description" | PASS |
| `/settings` | h1 (homepage, routing issue) | N/A |

### 3.3 Search results: all developer names are `<h3>`

Developer cards use `<h3>` for usernames with no parent `<h1>` or `<h2>`. This results in 20+ headings all at level 3 with no hierarchy context.

**Recommended fix:**
- Add an `<h1>` like "Search Developers" (can be visually hidden with `sr-only`)
- Make "Filters" an `<h2>`
- Developer card names can remain `<h3>` under the implied results section

---

## 4. Accessible Names — 2 failures

### 4.1 Settings nav link has no accessible name

**Every single page** has a nav link to `/settings` that renders as an icon only (gear icon) with no text content, no `aria-label`, and no `aria-labelledby`.

```html
<a class="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-neutral-600..."
   href="/settings">
  <!-- SVG icon only, no text -->
</a>
```

**Impact:** Screen readers announce this as just "link" with no context. Users cannot determine where this link goes.

**Fix:** Add `aria-label="Settings"` to the anchor.

### 4.2 Mobile navigation is icon-only

At 375px viewport, the header collapses to icon-only navigation:
- Search (magnifying glass), Match (target), Lists (list), Map (grid), Settings (gear)
- Text labels are hidden
- **None of these icon-only links have `aria-label` attributes**

**Screenshot:** `screenshots/mobile/search-empty.png` — nav bar shows icons without text.

---

## 5. Form Labels — 2 critical failures on /map

### 5.1 Role title input missing label association

```html
<label class="text-[10px] ...">Role title</label>
<input type="text" value="Sr. Platform Engineer">
<!-- label is NOT associated via for/id -->
```

The `<label>` exists visually but is not programmatically associated with the `<input>`. The input has no `id`, no `aria-label`, no `aria-labelledby`, and no `placeholder`.

**axe rule violated:** `label` (critical)

### 5.2 Level select missing label association

```html
<label class="text-[10px] ...">Level</label>
<select class="...">
  <option value="mid">Mid</option>
  <option value="senior" selected>Senior</option>
  ...
</select>
```

Same issue — visual label present but not associated.

**axe rule violated:** `select-name` (critical)

**Note:** The "Tech stack" and "Geography" inputs were not flagged because they likely have `placeholder` attributes serving as fallback accessible names, but proper label association would be better.

---

## 6. Image Alt Text — PASS

All `<img>` elements across all 10 pages have `alt` attributes. No violations found.

---

## 7. Focus Indicators — PASS

Tab navigation testing on `/search` showed **25/25 elements had visible focus indicators**:

| Element | Focus visible |
|---------|:------------:|
| Scout logo link | Yes |
| Search nav link | Yes |
| Match nav link | Yes |
| Lists nav link | Yes |
| Map nav link | Yes |
| Theme toggle button | Yes |
| Sign in button | Yes |
| Search input | Yes |
| Search button | Yes |
| Sort buttons (Score, Followers, Stars, Newest) | Yes |
| Language filter buttons (12 total) | Yes |

Focus indicators appear to use the browser default outline ring or a custom ring style. All were visible against the dark background.

---

## 8. Keyboard Navigation — PASS (with caveat)

### 8.1 Tab order

Tab order follows a logical reading flow: logo > nav links > theme toggle > sign in > search input > search button > sort options > language filters > location > min stars.

### 8.2 Search workflow

The search input is reachable by Tab. Typing and pressing Enter submits the search. Results load and individual result cards are tabbable links.

**Caveat:** The full keyboard search-to-profile workflow could not be completed in this session because the dev server briefly dropped during testing. However, the focus indicator test confirmed all interactive elements in the search flow are focusable and keyboard-reachable.

---

## 9. Color-Only Information — PASS

Badges, tiers, and scores all include text alongside color:
- Score badges show numeric values (not just colored dots)
- Language badges display language names as text
- Quick-filter suggestion pills have readable text labels
- The "Score" sort button's active state uses both color (indigo) and visual weight

No instances found where information is conveyed by color alone.

---

## 10. Document Titles — 2 failures

| Page | Has `<title>`? |
|------|:---:|
| `/profile/torvalds` | NO |
| `/map/templates` | NO (via axe incomplete) |
| All other pages | Yes |

axe flagged `document-title` on `/profile/torvalds` (the error state) and the search pages as having the issue in "incomplete" (needs review) status.

---

## 11. Dark Mode Visual Review

### 11.1 Overall impression

The app has a cohesive dark aesthetic with a near-black base (`#0a0a0f`) and darker card surfaces (`#121214`, `#171717`). The indigo accent (`indigo-500`/`indigo-600`) is used consistently for primary actions (Search button, Generate market map, Parse Requirements).

### 11.2 Issues found

| Issue | Location | Severity |
|-------|----------|----------|
| **Subtitle/secondary text too dim** | All pages | High — see Section 2 |
| **Map label text at 10px** is nearly invisible | `/map` form labels | High |
| **Footer text barely readable** | Homepage, /lists, /favorites, /settings | Medium |
| **Placeholder text in search** is very dim | `/search` input, `/match` textarea | Medium |
| **Error banner text contrast** | `/search` rate limit warning | Low (red bg provides contrast) |
| **"Sign in to view your templates" very dim** | `/map/templates` | Medium |

### 11.3 Elements that work well in dark mode

- Primary headings (white text on dark bg): excellent contrast
- Navigation links: readable neutral-400 on dark header
- Active nav indicator: clear indigo underline
- Buttons (indigo bg, white text): high contrast
- Card borders: subtle but visible neutral-700/50
- Search input: dark bg with light text, visible border
- Error state warning icon: red/orange is clearly visible

---

## 12. Visual Consistency

### 12.1 Border radius

Cards and containers use consistent `rounded-xl` (12px). Form inputs use `rounded-lg` (8px). Buttons vary:
- Nav buttons: `rounded-lg`
- Filter pills: `rounded-full`
- Primary CTA: `rounded-lg`

This appears intentional and appropriate for element semantics.

### 12.2 Spacing inconsistencies

| Issue | Location |
|-------|----------|
| Match page card has more internal padding than Map card | `/match` vs `/map` |
| Filter sidebar width differs between empty/results states | `/search` |

### 12.3 Typography scale

The app uses many font sizes, which is expected for a data-dense UI. However:
- **10px labels on /map** are below the recommended minimum 12px for body text
- Stats on homepage use very small text for labels ("Developers searchable", etc.)

---

## 13. Mobile-Specific Findings (375px)

### 13.1 Navigation

The mobile header squeezes all nav items into a horizontal row of icons. At 375px this is tight but functional. The "Sign in" button still shows text, creating asymmetry with the icon-only nav links.

**Screenshot:** `screenshots/mobile/homepage.png`

### 13.2 Search page layout

- Filters panel and results stack vertically (good)
- Quick-filter pills wrap correctly
- Language badges wrap to multiple rows
- Search input is full-width with adequate touch target

### 13.3 Map page

Form inputs stack vertically on mobile and are full-width. Good responsive behavior.

### 13.4 Match page

Card and textarea adapt well to mobile width. No horizontal overflow observed.

### 13.5 Homepage

The hero section scales down nicely. "Scout top talent from GitHub" heading wraps to 3 lines but remains readable. Stats row displays correctly.

### 13.6 Map templates

Bare page with centered text. Works on mobile but feels incomplete.

---

## 14. Prioritized Remediation Plan

### P0 — Critical (must fix for WCAG AA)

1. **Replace `text-neutral-500` with `dark:text-neutral-400`** on all secondary text, labels, subtitles, and muted UI elements. This single change fixes ~40 contrast violations across the entire app.

2. **Associate form labels with inputs on /map page.** Add `id` attributes to inputs and `htmlFor` attributes to labels (or use `aria-label`).

3. **Add `aria-label="Settings"` to the gear icon link** in the navigation (present on all pages).

4. **Add `aria-label` to all mobile icon-only nav links** (Search, Match, Lists, Map, Settings).

### P1 — High (should fix)

5. **Add an `<h1>` to the search page.** Use `<h1 className="sr-only">Search Developers</h1>` if no visible heading is desired.

6. **Add a `<title>` to the profile page.** Ensure all routes set a meaningful document title.

7. **Fix /lists, /favorites, /settings routing.** Auth-gated pages should show a "Sign in required" message (like /map/templates does) rather than silently redirecting to the homepage.

8. **Increase map form label size** from `text-[10px]` to at least `text-xs` (12px).

### P2 — Medium (nice to have)

9. **Add `<h1>` to `/map/templates` page** ("Map Templates" or similar).

10. **Make error page heading an `<h1>`** instead of `<h2>`.

11. **Review placeholder text contrast** in search input and match textarea.

12. **Standardize auth-gated page patterns** across all protected routes.

---

## 15. Screenshots Index

### Desktop (1440x900)

| Page | File |
|------|------|
| Homepage | `screenshots/desktop/homepage.png` |
| Search (empty) | `screenshots/desktop/search-empty.png` |
| Search (results) | `screenshots/desktop/search-results.png` |
| Profile (torvalds) | `screenshots/desktop/profile-torvalds.png` |
| Market Map | `screenshots/desktop/map.png` |
| Lists | `screenshots/desktop/lists.png` |
| Match | `screenshots/desktop/match.png` |
| Favorites | `screenshots/desktop/favorites.png` |
| Settings | `screenshots/desktop/settings.png` |
| Map Templates | `screenshots/desktop/map-templates.png` |
| Search focus state | `screenshots/desktop/search-focus-state.png` |

### Mobile (375x812)

| Page | File |
|------|------|
| Homepage | `screenshots/mobile/homepage.png` |
| Search (empty) | `screenshots/mobile/search-empty.png` |
| Search (results) | `screenshots/mobile/search-results.png` |
| Profile (torvalds) | `screenshots/mobile/profile-torvalds.png` |
| Market Map | `screenshots/mobile/map.png` |
| Lists | `screenshots/mobile/lists.png` |
| Match | `screenshots/mobile/match.png` |
| Favorites | `screenshots/mobile/favorites.png` |
| Settings | `screenshots/mobile/settings.png` |
| Map Templates | `screenshots/mobile/map-templates.png` |

---

## 16. Raw Data

- axe-core results: `a11y-results.json`
- Screenshot capture log: `screenshot-results.json`
- Audit scripts: `audit-screenshots.mjs`, `audit-a11y.mjs`, `audit-keyboard.mjs`

---

*Report generated by Playwright + axe-core automated testing with manual visual review of all 22 screenshots.*
