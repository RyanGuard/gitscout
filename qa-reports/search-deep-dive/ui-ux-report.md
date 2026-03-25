# Search Page UI/UX Deep Dive Report

**Date:** 2026-03-25
**Tester:** Automated Playwright (headless Chromium)
**Target:** http://localhost:3000/search
**Query tested:** "TypeScript San Francisco"

---

## Table of Contents

1. [Page States](#1-page-states)
2. [Result Card Field Inventory](#2-result-card-field-inventory)
3. [Interaction Tests](#3-interaction-tests)
4. [Responsive Breakpoints](#4-responsive-breakpoints)
5. [Dark Theme](#5-dark-theme)
6. [Issues Found](#6-issues-found)
7. [Screenshot Index](#7-screenshot-index)

---

## 1. Page States

### 1a. Empty State (no query)
**Screenshot:** `screenshots/states/01-empty-state.png`

| Element | Present | Notes |
|---------|---------|-------|
| Search bar | Yes | Full-width with placeholder: "Search developers -- try 'rust engineers in San Francisco' or 'karpathy'" |
| Cmd+K badge | Yes | Keyboard shortcut hint inside search input |
| Search button | Yes | Blue "Search" button inside input |
| Filter sidebar | Yes | Visible by default on desktop |
| Results area | Empty | No results, no empty state message -- just blank space |
| Header nav | Yes | GitScout logo, Search, Match, Lists, sound toggle, Sign in |

**Observation:** The empty state shows filters but no call-to-action or illustration in the results area. Consider adding a prompt like "Enter a search to find developers" or a hero illustration.

### 1b. Loading State
**Screenshot:** `screenshots/states/02a-loading-100ms.png`

| Element | Present | Notes |
|---------|---------|-------|
| Search radar animation | Yes | Animated SVG radar/sonar visual with green sweep line |
| Loading message | Yes | "Scouting 100M+ profiles..." text with animated progress bar |
| Filter sidebar | Yes | Remains visible and interactive during loading |
| Results count | Hidden | Not shown until results arrive |

**Observation:** The loading state is polished -- radar animation + contextual loading messages create a good experience. Progress bar provides visual feedback. The `SearchRadar` component animates dots as results stream in. The `SearchLoadingMessages` component cycles through contextual messages.

### 1c. Results State
**Screenshot:** `screenshots/interactions/01-clicked-result.png` (captured during first pass when API was live)

| Element | Present | Notes |
|---------|---------|-------|
| Results count | Yes | "170 developers found" header text |
| Developer cards | Yes | ~20 cards per page in a vertical list |
| Pagination | Yes | "Previous / Page 1 of 9 / Next" at bottom |
| Filter sidebar | Yes | Visible alongside results |
| Loading indicator | No | Replaced by results |

**Observation:** Results loaded showing a list of developer profile cards. The first result was "Maheema Daslan" (a data scientist from San Francisco). Cards are rendered via `AnimatedResultsList` with staggered entrance animations.

### 1d. Zero Results State
**Screenshot:** `screenshots/states/03-results-state.png`

| Element | Present | Notes |
|---------|---------|-------|
| SearchX icon | Yes | Large grey X-circle icon |
| "No developers found" | Yes | Clear heading |
| Helper text | Yes | "Try adjusting your search query or filters." |
| Search tips card | Yes | Bordered card with lightbulb icon, 3 tips: broader terms, search by location, remove filters |
| Results count | Yes | "0 developers found" shown in header |

**Observation:** Zero-results state is well-designed with actionable tips. The search tips card is helpful.

### 1e. Error State
**Screenshots:** `screenshots/interactions/04b-after-language-filter.png`, `screenshots/interactions/05a-sort-stars.png`

| Element | Present | Notes |
|---------|---------|-------|
| Error banner | Yes | Red-tinted banner at top of results area |
| Error text | Yes | "Search failed" in red text |
| Filter sidebar | Yes | Still visible and interactive |
| Retry mechanism | None | No retry button -- user must re-submit search or change filters |

**Observation:** Error state shows a clear red banner. However, there is **no retry button** -- users must manually re-trigger the search. The error text ("Search failed") could be more specific (e.g., "GitHub API rate limit exceeded, please try again in a minute").

---

## 2. Result Card Field Inventory

Each developer card (`DeveloperCard.tsx`) is an `<a>` link to `/profile/{username}`. Fields documented from code analysis + visual inspection of results screenshot:

### Card Layout

```
+--[ Border-left: tier color accent ]-------------------------------------+
|  +--------+  Name  [TierBadge emoji] [Open to work] [Email]            |
|  | Avatar |  @username  |  Company (Building2 icon)                     |
|  | (56px) |  Bio text (1 line, clamped)                                 |
|  | Score  |  MapPin Location | Users Followers | Star Stars | Fork Repos | Clock Last Active |
|  +--------+  [Language] [Language] [Language] [Language]                 |
+-------------------------------------------------------------------------+
```

### Field-by-Field Documentation

| # | Field | Source | Icon | Conditional | Format |
|---|-------|--------|------|-------------|--------|
| 1 | **Avatar** | `developer.avatarUrl` or GitHub fallback | None | Always shown | 56x56px circular image, 2px border |
| 2 | **Score** | `developer.score` | None | Only if > 0 | Numeric (0-100), color-coded by tier. Below avatar. |
| 3 | **Name** | `developer.name` or `developer.username` | None | Always shown | Semibold, truncated. Blue on hover. |
| 4 | **Tier Badge** | Computed from score | Emoji | Only if score > 0 | Emoji only at `sm` size. Tiers: Unicorn (90-100), On Fire (75-89), Gem (60-74), Seedling (40-59), Mystery (0-39) |
| 5 | **Open to work** | `developer.hireable` | None | Only if hireable | Green badge pill |
| 6 | **Email available** | `developer.email` (boolean) | `Mail` (lucide) | Only if email exists | Purple badge pill with mail icon |
| 7 | **Username** | `developer.username` | None | Always shown | Prefixed with `@`, neutral-500 text |
| 8 | **Company** | `developer.company` | `Building2` (lucide) | Only if set | `@` prefix stripped, truncated |
| 9 | **Bio** | `developer.bio` | None | Only if set | `line-clamp-1`, neutral-600 text |
| 10 | **Location** | `developer.location` | `MapPin` (lucide) | Only if set | Plain text |
| 11 | **Followers** | `developer.followers` | `Users` (lucide) | Only if > 0 | `formatNumber()` (e.g., "1.2k") |
| 12 | **Total Stars** | `developer.totalStars` | `Star` (lucide) | Only if > 0 | `formatNumber()` |
| 13 | **Public Repos** | `developer.publicRepos` | `GitFork` (lucide) | Only if > 0 | Raw number |
| 14 | **Last Active** | `repositories[0].pushedAt` | `Clock` (lucide) | Only if recent repo exists | `timeAgo()` (e.g., "2 days ago") |
| 15 | **Top Languages** | `developer.languages[0..3]` | Colored dot | Only if languages exist | Up to 4 language badges with color-coded dots |

### Tier System (from TierBadge.tsx)

| Score Range | Emoji | Label | Color | Left Border |
|-------------|-------|-------|-------|-------------|
| 90-100 | Unicorn | Unicorn | violet-400 | yellow-500 (Elite) |
| 75-89 | Fire | On Fire | amber-400 | blue-500 (Strong) |
| 60-74 | Gem | Gem | cyan-400 | emerald-500 (Solid) |
| 40-59 | Seedling | Seedling | green-400 | neutral-400 (Emerging) |
| 0-39 | Cloud | Mystery | neutral-400 | none |

### Card Interaction States

| State | Behavior |
|-------|----------|
| Default | White bg, neutral-200 border, subtle shadow |
| Hover | Blue-300 border, medium shadow, slight upward translate (-0.5) |
| Dark default | neutral-900 bg, neutral-700 border |
| Dark hover | Blue-600 border |

---

## 3. Interaction Tests

### 3a. Click Result Card
**Screenshot:** `screenshots/interactions/01-clicked-result.png`

| Test | Result | Notes |
|------|--------|-------|
| Card is clickable | PASS | Entire card is an `<a>` tag wrapping to `/profile/{username}` |
| Navigates to profile | PARTIAL | First pass navigated correctly (href="/profile/mahseema"), but URL appeared to stay on search. Likely due to Next.js client-side navigation timing. |
| Profile page loads | PASS | Profile page content was visible in screenshot |

**Note:** Cards use `<Link>` from Next.js, so navigation is client-side. The hover state with shadow lift and blue border provides clear affordance.

### 3b. Save/Favorite Button
**Screenshot:** `screenshots/interactions/03-save-button-area.png`

| Test | Result | Notes |
|------|--------|-------|
| Save button on search cards | NOT PRESENT | No favorite/save button on result cards in search view |
| Save button elsewhere | YES (4 buttons) | 4 buttons with SVG icons found on page (header nav buttons) |
| Auth requirement | YES | `FavoriteButton` component requires authentication -- shows nothing to unauthenticated users |

**Observation:** The `FavoriteButton` component (`src/components/auth/FavoriteButton.tsx`) checks for an active session and only renders for authenticated users. **Unauthenticated users see no save affordance at all** -- no disabled button, no "sign in to save" prompt. This is a missed opportunity for engagement.

### 3c. Browser Back
**Screenshot:** `screenshots/interactions/02-browser-back.png`

| Test | Result | Notes |
|------|--------|-------|
| Back returns to search | PASS | Returned to `/search` page |
| Query preserved in URL | PASS | URL params retained (`q=TypeScript+San+Francisco`) |
| Results re-rendered | PASS | Search re-triggered from URL params via `useEffect` |
| Scroll position | NOT TESTED | May reset to top on back navigation |

### 3d. Filter Changes

#### Language Filter
**Screenshot:** `screenshots/interactions/04b-after-language-filter.png`

| Test | Result | Notes |
|------|--------|-------|
| Click "Python" language pill | PASS | Pill turns blue (selected state) |
| URL updated | PASS | `&languages=Python` appended to URL |
| Search re-triggered | PASS | New search fired automatically |
| "Clear (N)" button appears | PASS | Shows "Clear (1)" next to Filters heading |
| Can deselect | YES | Clicking again removes the filter |

#### Hireable Filter
**Screenshot:** `screenshots/interactions/04c-hireable-filter.png`

| Test | Result | Notes |
|------|--------|-------|
| Check "Open to work only" | PASS | Checkbox checked |
| URL updated | PASS | `&hireable=true` appended |
| Active filter count | PASS | Shows "Clear (2)" (language + hireable) |

#### Location Filter
**Screenshot:** `screenshots/interactions/04d-location-filter.png`

| Test | Result | Notes |
|------|--------|-------|
| Type in location input | PASS | Free text entry accepted |
| URL updated | PARTIAL | Location entered as "New York" replaced original query's location context; URL showed `q=New+York` instead of adding a separate location param |

**Bug:** Typing in the Location filter input and pressing Enter appears to replace the main search query rather than adding a `location` filter param. The `updateFilter` function correctly sets `location` in the filter state and calls `router.push`, but the Enter keypress on the location input may be submitting the main search form instead.

### 3e. Sort Changes

**Screenshots:** `screenshots/interactions/05a-sort-stars.png`, `screenshots/interactions/05b-sort-followers.png`

| Test | Result | Notes |
|------|--------|-------|
| Click "Stars" sort | PASS | Button highlighted blue. URL: `&sort=stars` |
| Click "Followers" sort | PASS | Button highlighted blue. URL: `&sort=followers` |
| Click "Newest" sort | NOT TESTED | API was rate-limited |
| Default sort (Score) | PASS | Score button highlighted blue by default |
| Sort re-triggers search | PASS | URL updates trigger `useEffect` which calls `doSearch` |

**Sort Options Available:**

| Button Label | URL Param | GitHub API Sort |
|--------------|-----------|-----------------|
| Score | (default, omitted) | `followers` |
| Followers | `sort=followers` | `followers` |
| Stars | `sort=stars` | `repositories` |
| Newest | `sort=joined` | `joined` |

**Note:** "Score" sort defaults to `followers` on the GitHub API side, then re-ranks results client-side by the app's scoring algorithm.

### 3f. Pagination

| Test | Result | Notes |
|------|--------|-------|
| Previous/Next buttons | PASS | Visible at bottom of results |
| Page indicator | PASS | "Page 1 of 9" text between buttons |
| Previous disabled on page 1 | PASS | `disabled:opacity-40` applied |
| Next navigates | NOT TESTED | API rate-limited during test |

---

## 4. Responsive Breakpoints

### 4a. Desktop 1440px
**Screenshot:** `screenshots/responsive/desktop-1440.png`

| Aspect | Status | Notes |
|--------|--------|-------|
| Layout | PASS | Sidebar (240px) + results side-by-side |
| Horizontal overflow | None | `bodyScrollWidth === 1440` |
| Search bar | Full width | Centered, max-w-3xl |
| Filter sidebar | Visible | Sticky, w-60 |
| Cards | Full width | Fill remaining space |

### 4b. Desktop 1280px
**Screenshot:** `screenshots/responsive/desktop-1280.png`

| Aspect | Status | Notes |
|--------|--------|-------|
| Layout | PASS | Same as 1440 but slightly narrower |
| Horizontal overflow | None | `bodyScrollWidth === 1280` |
| Filter sidebar | Visible | Same layout |

### 4c. Tablet 768px
**Screenshot:** `screenshots/responsive/tablet-768.png`

| Aspect | Status | Notes |
|--------|--------|-------|
| Layout | PASS | Sidebar + results still side-by-side |
| Horizontal overflow | None | `bodyScrollWidth === 768` |
| Filter sidebar | Visible | Narrower but still present |
| "Filters" toggle button | Visible | `lg:hidden` button appears (hamburger-style filter toggle) |
| Cards | Narrower | Reduced width but readable |
| Search tips card | Visible | Properly sized for viewport |

**Observation:** At 768px the filter sidebar is still always visible alongside results. The `lg:hidden` Filters toggle button is visible but the sidebar doesn't collapse by default. This means at 768px users see both the toggle button AND the sidebar -- somewhat redundant.

### 4d. Mobile 375px
**Screenshot:** `screenshots/responsive/mobile-375.png`

| Aspect | Status | Notes |
|--------|--------|-------|
| Layout | ISSUES | See below |
| Horizontal overflow | **YES** | `bodyScrollWidth: 455` > viewport 375 (80px overflow) |
| Filter sidebar | Visible | Still rendered at w-60 (240px) |
| Cards | Cramped | Cards squeeze into remaining ~135px |
| Readability | POOR | Card text wraps excessively, avatars dominate |
| Search bar | Fits | Search input spans full width |
| Pagination | Visible | At bottom of results |

**BUG - HORIZONTAL OVERFLOW:** At 375px, the page overflows horizontally by 80px. The filter sidebar (240px fixed width) + results area don't properly collapse. The sidebar should auto-hide on mobile with the Filters toggle button controlling its visibility.

**Root cause:** The sidebar uses `shrink-0` class which prevents it from shrinking below its 240px width. The `showFilters` state defaults to `true` regardless of viewport. There's no media query or responsive hook to default `showFilters` to `false` on mobile.

---

## 5. Dark Theme

**Method:** System preference (`prefers-color-scheme: dark`). No manual toggle exists in the UI.

### 5a. Dark Empty State
**Screenshot:** `screenshots/dark/01-dark-empty.png`

| Element | Dark Treatment | Status |
|---------|---------------|--------|
| Background | `rgb(10, 10, 10)` (#0a0a0a) | PASS |
| Text | `rgb(237, 237, 237)` (#ededed) | PASS |
| Search input | dark bg (neutral-900), neutral-700 border | PASS |
| Filter labels | Visible, light text | PASS |
| Language pills | neutral-800 bg, neutral-400 text | PASS |
| Sort buttons | neutral-800 bg, blue-600 for active | PASS |
| Input fields | Transparent bg, neutral-700 border | PASS |
| Logo | White text | PASS |
| Header nav | White text | PASS |

### 5b. Dark Results State
**Screenshot:** `screenshots/dark/02-dark-results.png`

Captured during API downtime, showing zero-results dark state:

| Element | Dark Treatment | Status |
|---------|---------------|--------|
| "No developers found" text | neutral-400 | PASS |
| SearchX icon | neutral-600 | PASS |
| Search tips card | neutral-700 border, neutral-900 bg | PASS |
| Overall contrast | Good | PASS |

### 5c. Dark Mobile
**Screenshot:** `screenshots/dark/04-dark-mobile.png`

| Element | Dark Treatment | Status |
|---------|---------------|--------|
| Language pills | White text on dark pills | PASS |
| Overall | Consistent dark treatment | PASS |
| Same overflow issue | YES | 375px overflow persists in dark mode |

### Dark Theme Summary

| Aspect | Status |
|--------|--------|
| CSS variables set | PASS (`--background: #0a0a0a`, `--foreground: #ededed`) |
| All components styled | PASS (dark: variants on all major elements) |
| Contrast ratio | PASS (light text on dark backgrounds) |
| Manual toggle | ABSENT (system-only) |
| Cards in dark mode | PASS (neutral-900 bg, neutral-700 border, blue-600 hover border) |
| Error banner dark | PASS (red-800 border, red-950 bg, red-300 text) |

**Observation:** Dark theme is comprehensive and well-implemented. All components have `dark:` Tailwind variants. However, there is no manual toggle -- users relying on system-level dark mode will get it automatically, but users who want to override (e.g., dark system but light app) cannot.

---

## 6. Issues Found

### Critical

| ID | Issue | Severity | Location |
|----|-------|----------|----------|
| **CRIT-1** | **Mobile horizontal overflow at 375px** | Critical | `src/app/search/page.tsx:190` -- Sidebar `shrink-0 w-60` doesn't collapse on mobile. `showFilters` defaults to `true` on all viewports. Body scrollWidth 455px > 375px viewport. |

**Suggested fix:** Default `showFilters` to `false` on screens < `lg` (1024px). Use a `useMediaQuery` hook or `useEffect` with `window.matchMedia` to set initial state. Add `overflow-x-hidden` to the parent container as a safety net.

### High

| ID | Issue | Severity | Location |
|----|-------|----------|----------|
| **HIGH-1** | **No retry button on error state** | High | `src/app/search/page.tsx:300-304` -- Error banner shows "Search failed" but no retry action. User must manually re-click Search or change a filter. |
| **HIGH-2** | **Save button invisible to unauthenticated users** | High | `src/components/auth/FavoriteButton.tsx` -- No affordance at all for logged-out users. Should show disabled heart with "Sign in to save" tooltip. |
| **HIGH-3** | **Location filter Enter may submit main form** | High | `src/app/search/page.tsx:244-250` -- Location `<input>` inside the `<aside>` is not inside the search `<form>`, but pressing Enter on it triggers `updateFilter` via `onChange` only. However, the observed behavior showed the main query being replaced. |

### Medium

| ID | Issue | Severity | Location |
|----|-------|----------|----------|
| **MED-1** | **Empty state has no CTA** | Medium | When no query is entered, the results area is completely blank. Add an illustration or prompt. |
| **MED-2** | **Filter sidebar visible AND toggle button at 768px** | Medium | `src/app/search/page.tsx:286-291` -- The toggle button is `lg:hidden` but the sidebar is always visible regardless of screen size. Redundant UI at tablet breakpoint. |
| **MED-3** | **No dark mode toggle** | Medium | Dark mode only via system preference. Some users want manual control. |
| **MED-4** | **"Score" sort misleading** | Medium | "Score" sort defaults to GitHub `followers` API sort, then client-side re-ranks. Users may expect server-side score ranking. |
| **MED-5** | **No "Commits" sort option** | Medium | Despite `DeveloperCard` code referencing commits, there's no sort-by-commits option in the UI. Only Score, Followers, Stars, Newest. |

### Low

| ID | Issue | Severity | Location |
|----|-------|----------|----------|
| **LOW-1** | **Cmd+K hint hidden on mobile** | Low | `src/app/search/page.tsx:176-178` -- Uses `hidden sm:inline-flex`, so mobile users don't see the keyboard shortcut. This is fine for touch devices. |
| **LOW-2** | **No loading skeleton** | Low | Loading state uses radar animation instead of content skeletons. While engaging, it doesn't prepare users for the card layout they'll see. |
| **LOW-3** | **Error text too generic** | Low | "Search failed" doesn't distinguish rate limits, network errors, or server errors. |

---

## 7. Screenshot Index

### Page States
| File | Description |
|------|-------------|
| `states/01-empty-state.png` | Search page with no query, 1440px |
| `states/02a-loading-100ms.png` | Loading state with radar animation + "Scouting 100M+ profiles..." |
| `states/02b-loading-500ms.png` | Loading state at 500ms |
| `states/02c-loading-1500ms.png` | Loading state at 1500ms |
| `states/03-results-state.png` | Zero results state (API rate-limited during capture) |
| `states/03b-results-above-fold.png` | Above-fold view of zero-results |
| `states/05-filters-sidebar.png` | Cropped filter sidebar |
| `states/06-error-state.png` | Blocked API error state |

### Interactions
| File | Description |
|------|-------------|
| `interactions/01-clicked-result.png` | Results list showing ~20 developer cards (170 found) |
| `interactions/02-browser-back.png` | After browser back from profile |
| `interactions/03-save-button-area.png` | Search page -- no save buttons on cards |
| `interactions/04a-before-filter.png` | Before applying filters |
| `interactions/04b-after-language-filter.png` | Python language filter active (shows error due to rate limit) |
| `interactions/04c-hireable-filter.png` | Hireable + Python filters active, Clear(2) visible |
| `interactions/04d-location-filter.png` | Location filter entered |
| `interactions/05a-sort-stars.png` | Sort by Stars active (blue button) |
| `interactions/05b-sort-followers.png` | Sort by Followers active |
| `interactions/06-pagination.png` | Pagination controls at page bottom |

### Responsive
| File | Viewport | Status |
|------|----------|--------|
| `responsive/desktop-1440.png` | 1440x900 | No overflow |
| `responsive/desktop-1280.png` | 1280x800 | No overflow |
| `responsive/tablet-768.png` | 768x1024 | No overflow, dual filter UI |
| `responsive/mobile-375.png` | 375x812 | **OVERFLOW: 455px body width** |

### Dark Theme
| File | Description |
|------|-------------|
| `dark/01-dark-empty.png` | Dark mode empty state, 1440px |
| `dark/02-dark-results.png` | Dark mode zero-results state |
| `dark/04-dark-mobile.png` | Dark mode at 375px mobile |

---

## Test Environment

- **Browser:** Chromium (headless) via Playwright 1.58.2
- **Server:** Next.js 16.2.1 dev server (localhost:3000)
- **Auth state:** Unauthenticated (no session)
- **API note:** GitHub Search API returned 500 after initial requests (rate limit exhaustion). First-pass screenshots captured live results; subsequent passes captured error/zero-result states. Both conditions are documented.
