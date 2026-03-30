# CRM Features QA Report

**Date:** 2026-03-26
**Tester:** Automated Playwright (QA Engineer)
**Environment:** http://localhost:3000 (dev server)
**Auth State:** Not signed in (unauthenticated)
**Browser:** Chromium (headless)

---

## Executive Summary

| Feature | Status | Severity |
|---------|--------|----------|
| Lists (`/lists`) | **NOT IMPLEMENTED** — redirects to homepage | HIGH |
| Favorites (`/favorites`) | **NOT IMPLEMENTED** — redirects to homepage | HIGH |
| Match / JD Parsing (`/match`) | **PARTIALLY WORKING** — parsing works, matching fails | MEDIUM |
| Settings (`/settings`) | **NOT IMPLEMENTED** — redirects to homepage | HIGH |
| Cross-Feature Integration | **BLOCKED** — dependent features missing | HIGH |
| Profile Page | **BROKEN** — database connection pool exhausted | CRITICAL |

**Overall:** 1 of 6 feature areas partially functional. 3 pages are stub routes that fall through to the homepage. Profile pages crash under load due to Supabase connection pool limits.

---

## 1. LISTS (`/lists`)

### Test 1: Visit /lists — Empty State
- **Result:** FAIL — No dedicated lists page exists
- **Observed:** Navigating to `/lists` returns HTTP 200 but renders the **homepage** ("Scout top talent from GitHub"). The URL silently falls through to `/` content.
- **Screenshot:** `screenshots/01-lists-page.png`

### Test 2: Create List Button
- **Result:** FAIL — No "Create List", "New List", or "Add List" button found
- **Observed:** Zero create/new buttons on the page. The only interactive elements are the homepage search bar and tag buttons (Rust in SF, ML Engineers, etc.)

### Test 3: Click an Existing List
- **Result:** FAIL — No list items found
- **Observed:** Zero clickable list links (`a[href*="/lists/"]`). No list content of any kind rendered.

### Verdict
The `/lists` route exists in the navigation bar (confirmed: nav link "Lists" → `/lists`) but has **no dedicated page component**. It falls through to the homepage layout. The CRM lists feature (entries, notes, tags, pipeline stages) is entirely unimplemented.

---

## 2. FAVORITES (`/favorites`)

### Test 4: Visit /favorites — Screenshot
- **Result:** FAIL — No dedicated favorites page
- **Observed:** Like `/lists`, navigating to `/favorites` returns HTTP 200 but renders the **homepage**. No favorites-specific UI.
- **Screenshot:** `screenshots/04-favorites-page.png`

### Test 5: Saved Developers with Scores and Profile Links
- **Result:** FAIL — No score elements or profile links found
- **Observed:**
  - Score elements (`[class*="score"]`, `.score`, `[data-score]`): **0 found**
  - Profile links (`a[href*="/profile/"]`): **0 found**

### Verdict
The `/favorites` page existed in a previous version (per CLAUDE.md: "Saved developers (auth required)") but currently renders the homepage. It's possible the page requires authentication and silently redirects unauthenticated users, but there is no sign-in prompt, no "please log in" message — just the homepage.

**Recommendation:** If auth is required, show a clear "Sign in to view favorites" message instead of silently rendering the homepage.

---

## 3. MATCH / JD Matching (`/match`)

### Test 6: Visit /match — Page Loads
- **Result:** PASS
- **Observed:** The `/match` page renders a dedicated "Match Candidates" UI with:
  - Title: "Match Candidates"
  - Subtitle: "Parse a job description to find the best matching developers in your database."
  - A card with "Job Description" heading
  - Instruction text: "Paste a job description or select from Ashby to find matching candidates."
  - A "Parse Requirements" button
- **Screenshot:** `screenshots/06-match-page.png`

### Test 7: JD Textarea Present
- **Result:** PASS
- **Observed:** 1 textarea found with placeholder: "Paste the full job description here..."

### Test 8: Paste Sample JD
- **Result:** PASS
- **Observed:** Successfully pasted "Senior Rust developer, 5+ years experience, distributed systems, San Francisco, 200-300K" into the textarea
- **Screenshot:** `screenshots/08-match-jd-pasted.png`

### Test 9: Parse Requirements
- **Result:** PASS — Parsing works correctly
- **Observed:** After clicking "Parse Requirements", an "Extracted Requirements" panel appears with editable fields:
  - **LANGUAGES:** `Rust` (tag, removable with ×)
  - **FRAMEWORKS:** (empty, with "Add frameworks..." placeholder)
  - **TOOLS:** (empty, with "Add tools..." placeholder)
  - **KEYWORDS:** `distributed systems` (tag, removable with ×)
  - **LOCATION:** `San Francisco`
  - **SENIORITY:** Dropdown with options: Any, Junior, Mid, Senior, Staff, Principal — auto-selected **Senior** ✓
  - **YEARS:** (visible but value not captured)
- **Screenshot:** `screenshots/09-match-results.png`
- **Note:** Extracted `Rust`, `distributed systems`, `San Francisco`, and `Senior` correctly. Did **not** extract salary range (200-300K) — acceptable since salary isn't a matching dimension.

### Test 10: Find Matches — Return Matched Candidates
- **Result:** FAIL — "Failed to find matches. Please try again."
- **Observed:** After clicking "Find Matches", the API call fails. No candidates returned. Error message displayed at the bottom of the extracted requirements panel.
- **Screenshot:** `screenshots/11-match-find-results.png`
- **Likely cause:** Either the matching API endpoint errors (possibly database connection pool exhaustion, same issue as profiles), or there are no developers in the local database to match against.

### Test 11: Match Scores Shown
- **Result:** FAIL — No match scores visible (no `%` patterns or "score" text in results)

### Verdict
The Match feature is **50% functional**. The JD parsing pipeline works well — it correctly extracts languages, keywords, location, and seniority level from free-text job descriptions. However, the actual candidate matching (the core value) fails with a generic error. This needs investigation of the `/api/match` or equivalent endpoint.

---

## 4. SETTINGS (`/settings`)

### Test 12: Visit /settings — Screenshot
- **Result:** FAIL — No dedicated settings page
- **Observed:** Navigating to `/settings` returns HTTP 200 but renders the **homepage**. No settings-specific UI.
- **Screenshot:** `screenshots/12-settings-page.png`
- **Note:** There IS a nav link to `/settings` (the gear/sun icon in the header), but it leads to the homepage.

### Test 13: Ashby Connection UI
- **Result:** PARTIAL — The word "Ashby" appears in the page text (from the footer: "Ashby ATS integration"), but there is no dedicated Ashby connection/configuration UI.

### Test 14: Ashby API Key Input
- **Result:** FAIL — No API key input fields found
- **Observed:** Zero inputs matching `input[type="password"]`, `input[placeholder*="key"]`, `input[placeholder*="api"]`, `input[name*="ashby"]`. The only form input on the page is the homepage search bar.

### Test 15: Other Settings
- **Result:** FAIL — No settings controls found
- **Observed:**
  - Total form inputs: 1 (the homepage search bar)
  - Buttons: 9 (all homepage elements: Sign in, Search, and quick-search tags)

### Verdict
The `/settings` page is entirely unimplemented. No Ashby configuration, no API key management, no user preferences. The nav bar includes an icon link to `/settings` but the route has no dedicated component.

---

## 5. CROSS-FEATURE Integration

### Test 16: Add Developer to List from Search Results
- **Result:** FAIL — No "Add to List" UI on search result cards
- **Observed:** Search results page (`/search?q=developer`) successfully returns 1,000 developers with avatars, names, and usernames. However:
  - Zero "Add to List", "Save to List", or list-related buttons on any result card
  - Result cards are minimal: avatar + name + username only (no scores, no action buttons)
- **Screenshot:** `screenshots/16b-search-developer.png`

### Test 17: Favorite a Developer from Profile
- **Result:** BLOCKED — Profile page crashes
- **Observed:** Navigating to `/profile/dtolnay` triggers a database error:
  ```
  MaxClientsInSessionMode: max clients reached - in Session mode max clients are limited to pool_size
  ```
  The page shows "Something went wrong" with a "Try again" button. No favorite button or profile content visible.
- **Screenshot:** `screenshots/17b-profile-direct.png`

### Test 18: Push to Ashby from Profile
- **Result:** BLOCKED — Same database connection pool error as Test 17
- **Observed:** Zero Ashby-related buttons visible. Profile page did not render.

### Test 19: Full Flow (Search → Profile → Save to List → View List → Verify)
- **Result:** FAIL — Flow cannot be completed
- **Breakdown:**
  1. ✅ Search works — results returned for "rust" query
  2. ❌ Profile view — blocked by database pool error (first run: rate limit; second run: DB pool exhaustion)
  3. ❌ Save to List — no "Add to List" button exists on profiles or search results
  4. ❌ View List — `/lists` page not implemented
  5. ❌ Verify — cannot verify what doesn't exist

---

## 6. Infrastructure Issues Discovered

### CRITICAL: Supabase Connection Pool Exhaustion
- **Error:** `MaxClientsInSessionMode: max clients reached - in Session mode max clients are limited to pool_size`
- **Impact:** Profile pages (`/profile/[username]`) crash entirely
- **Reproduction:** Visit any profile page (e.g., `/profile/dtolnay`) during active testing
- **Root Cause:** Supabase session pooler connection limit exceeded. The Prisma client may be creating too many connections or not releasing them properly.
- **Recommendation:**
  1. Increase `pool_size` in Supabase connection settings
  2. Ensure Prisma singleton (`src/lib/prisma.ts`) properly reuses connections
  3. Add connection pooling parameters to `DATABASE_URL` (e.g., `?pgbouncer=true&connection_limit=10`)

### GitHub API Rate Limiting
- **Error:** "GitHub API rate limit reached. Results may be incomplete. Try again in a minute."
- **Impact:** Search returns 0 results on some queries
- **Note:** The app correctly displays this as a user-friendly warning, which is good. However, some searches still work (e.g., "developer" returned 1,000 results), suggesting the rate limit is per-endpoint or intermittent.

---

## Navigation Audit

The header navigation contains these links:

| Nav Item | Route | Has Dedicated Page? |
|----------|-------|-------------------|
| Scout (logo) | `/` | ✅ Yes — homepage |
| Search | `/search` | ✅ Yes — full search UI |
| Match | `/match` | ✅ Yes — JD parsing UI |
| Lists | `/lists` | ❌ No — renders homepage |
| Map | `/map` | Not tested |
| ☀ (theme toggle / settings) | `/settings` | ❌ No — renders homepage |
| Sign in | (auth flow) | Not tested |

---

## Summary of Findings

### What Works
1. `/match` page loads with proper JD parsing UI
2. JD parsing correctly extracts: languages (Rust), keywords (distributed systems), location (San Francisco), seniority (Senior)
3. Extracted requirements are editable with add/remove tag UI
4. Search page returns results with pagination (1,000 developers, 50 pages)
5. Navigation bar correctly links to all routes
6. "Select from Ashby" option mentioned in Match page copy (integration awareness)

### What's Broken
1. **Profile pages crash** with Supabase connection pool error (CRITICAL)
2. **Match "Find Matches"** fails with generic error after successful parsing
3. GitHub API rate limiting causes intermittent search failures

### What's Missing (Not Yet Implemented)
1. `/lists` page — no UI, no create button, no list management
2. `/favorites` page — no UI, no saved developers display
3. `/settings` page — no Ashby configuration, no API key input, no preferences
4. "Add to List" action on search result cards
5. "Add to List" action on profile pages
6. "Push to Ashby" button on profile pages
7. Favorite button on profile pages (may exist but untestable due to crash)
8. Match scores on matched candidates
9. CRM pipeline stages, notes, tags on lists

### Recommendations (Priority Order)
1. **P0:** Fix Supabase connection pool exhaustion — profiles are completely broken
2. **P1:** Implement `/lists` page with create, view, and manage list functionality
3. **P1:** Implement `/favorites` page (or add auth-gated redirect with sign-in prompt)
4. **P1:** Debug Match "Find Matches" API endpoint — parsing works, matching doesn't
5. **P2:** Implement `/settings` page with Ashby API key configuration
6. **P2:** Add "Add to List" and "Favorite" action buttons to search result cards and profile pages
7. **P2:** Add "Push to Ashby" button to profile pages
8. **P3:** Show match scores when candidates are returned

---

## Screenshots Reference

| # | File | Description |
|---|------|-------------|
| 01 | `01-lists-page.png` | /lists renders homepage (no lists UI) |
| 04 | `04-favorites-page.png` | /favorites renders homepage (no favorites UI) |
| 06 | `06-match-page.png` | /match page — clean JD input UI |
| 08 | `08-match-jd-pasted.png` | JD text pasted into textarea |
| 09 | `09-match-results.png` | Parsed requirements shown (Rust, distributed systems, Senior) |
| 11 | `11-match-find-results.png` | "Find Matches" fails with error |
| 12 | `12-settings-page.png` | /settings renders homepage (no settings UI) |
| 16b | `16b-search-developer.png` | Search results — 1,000 devs, no list/action buttons |
| 17b | `17b-profile-direct.png` | Profile page crashes — DB pool exhausted |
