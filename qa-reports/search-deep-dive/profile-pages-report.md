# Profile Pages QA Report

**Date:** 2026-03-26
**Tester:** Automated (Playwright + manual screenshot review)
**Environment:** localhost:3000 (Next.js 16 dev server, Chromium headless)
**Auth State:** Unauthenticated

---

## Executive Summary

| Category | PASS | FAIL | WARN | INFO |
|----------|------|------|------|------|
| Profile: torvalds | 17 | 1 | 4 | 1 |
| Profile: sindresorhus | 7 | 0 | 3 | 0 |
| 404 Page | 3 | 0 | 1 | 0 |
| XSS Protection | 5 | 0 | 0 | 0 |
| Action Buttons | 7 | 3 | 1 | 0 |
| Enrich / Favorite / Ashby / List | 0 | 0 | 4 | 0 |
| Responsive | 16 | 0 | 0 | 0 |
| Dark Mode | 3 | 1 | 1 | 2 |
| External Links | 3 | 0 | 0 | 0 |
| **TOTAL** | **61** | **5** | **14** | **3** |

**Overall: 61 PASS / 5 FAIL / 14 WARN across 83 test assertions.**

### Critical Issues (3)
1. **[BUG-P1]** Database pool exhaustion causes full-page crash (see Finding F01)
2. **[BUG-P2]** AI features (Scouting Report, Outreach Draft) and action buttons (Enrich, Favorite, Ashby, Add to List) do not render for unindexed (live-from-GitHub) profiles with no fallback UI (see Finding F03)
3. **[BUG-P2]** Score Breakdown (5 pillars) does not render for unindexed profiles (see Finding F04)

### Notable Positives
- XSS protection is solid across all 4 attack vectors tested
- Responsive design is flawless at all 4 breakpoints (0 overflow, 0 clipped elements)
- External links properly use `target="_blank"` with `rel="noopener noreferrer"`
- Share Card modal is well-designed with Copy Image, Download PNG, and Copy Profile Link
- Find Similar navigates to search with intelligent pre-filled query
- 404 page is clean with helpful messaging and navigation

---

## Test 1: /profile/torvalds -- Full Page Audit

**Screenshot:** `screenshots/profile/01-torvalds-full-page.png`

### Header Section
| Element | Status | Details |
|---------|--------|---------|
| Avatar | PASS | Circular avatar from GitHub, properly sized |
| Full name | PASS | "Linus Torvalds" in H1 |
| Username | PASS | "@torvalds" displayed below name |
| Score badge | PASS | "Score: 36.6" in blue pill badge |
| Company | PASS | "Linux Foundation" shown with building icon |
| Location | PASS | "Portland, OR" with map pin icon |
| Bio | N/A | Torvalds has no GitHub bio set |
| Stats row | PASS | 236.7K stars, 292.9K followers, 11 repos |
| GitHub link | PASS | Blue "GitHub" button, `target="_blank"` with `rel="noopener noreferrer"` |
| Hireable badge | N/A | Not applicable (torvalds is not marked hireable) |

### Action Toolbar
| Button | Status | Details |
|--------|--------|---------|
| GitHub | PASS | Links to github.com/torvalds, opens in new tab |
| Find Similar | PASS | Navigates to `/search?q=C&similarTo=torvalds&similarName=Linus+Torvalds&locationSkipped=true` |
| Share Card | PASS | Opens full-screen modal overlay with card preview |

### Score Breakdown (5 Pillars)
| Element | Status | Details |
|---------|--------|---------|
| Section visible | **FAIL** | Score breakdown section does not render |
| Impact pillar | FAIL | Not visible |
| Contribution pillar | FAIL | Not visible |
| Consistency pillar | FAIL | Not visible |
| Technical pillar | FAIL | Not visible |
| Reputation pillar | FAIL | Not visible |
| Bar animations | N/A | Section not rendered |

> **Note:** ScoreBreakdown is an async server component that only renders for profiles stored in the local database. Since torvalds is fetched live from GitHub, the entire section is absent. See Finding F04.

### Languages Bar
| Element | Status | Details |
|---------|--------|---------|
| Languages section | PASS | "Languages" heading with horizontal bar |
| Language breakdown | PASS | C 99.8%, OpenSCAD 0.2% |
| Color-coded bar | PASS | Visual bar with color segments |
| Language percentages | PASS | Accurate percentages displayed |

### Repository Grid
| Element | Status | Details |
|---------|--------|---------|
| Grid layout | PASS | 2-column grid on desktop |
| Repo count | PASS | 6 repositories shown (all public repos) |
| linux repo | PASS | 225.1K stars, 61.2K forks, description, language tag, last update |
| AudioNoise | PASS | Properly formatted card |
| uemacs | PASS | Properly formatted card |
| test-tlb | PASS | Properly formatted card |
| pesconvert | PASS | Properly formatted card |
| HunspellColorize | PASS | Properly formatted card |
| Star/fork counts | PASS | Abbreviated with K suffix |
| Last updated | PASS | Relative time (e.g., "Updated 1d ago") |
| Language badges | PASS | "C" badge on each repo card |

---

## Test 2: /profile/sindresorhus -- Full Page Audit

**Screenshot:** `screenshots/profile/02-sindresorhus-full-page.png`

### Header Section
| Element | Status | Details |
|---------|--------|---------|
| Avatar | PASS | Circular avatar (dog photo) |
| Full name | PASS | "Sindre Sorhus" in H1 |
| Username | PASS | "@sindresorhus" |
| Score badge | PASS | Score displayed in blue pill |
| Bio | PASS | "Full-Time Open-Sourcerer. Focused on Swift & JavaScript. Makes macOS apps, CLI tools, npm packages" |
| Website link | PASS | Links to sindresorhus.com/apps, `target="_blank"` |
| Twitter link | PASS | Links to twitter.com/sindresorhus, `target="_blank"` |
| Email | PASS | Email displayed with icon |
| Location | WARN | Not visible (sindresorhus may not have location set on GitHub currently) |

### Languages & Repos
| Element | Status | Details |
|---------|--------|---------|
| Languages section | PASS | Multi-language bar (JavaScript, Swift, TypeScript, and more) |
| Repository grid | PASS | 21 repos displayed in 2-column grid |
| Repo cards | PASS | All with name, stars, forks, description, language, last update |

### External Links (sindresorhus)
| Link | Target | Status |
|------|--------|--------|
| sindresorhus.com/apps | `_blank` | PASS |
| twitter.com/sindresorhus | `_blank` | PASS |
| github.com/sindresorhus | `_blank` | PASS |

---

## Test 3: /profile/nonexistent-user-xyz -- 404 Page

**Screenshot:** `screenshots/profile/03-404-page.png`

| Test | Status | Details |
|------|--------|---------|
| Error message | PASS | "Developer not found" with X-in-circle icon |
| Explanation text | PASS | "This developer hasn't been indexed yet, or the username is incorrect." |
| Back navigation | PASS | "Search developers" blue button links to search |
| No leaked profile content | PASS | Clean error page, no broken profile UI |
| HTTP status code | **WARN** | Returns HTTP 200 instead of 404 |

> **Finding F02:** The 404 page returns HTTP 200 status. This is a soft 404 -- the UI is correct, but search engines and bots will index this as a valid page. The `notFound()` function in Next.js should normally return a 404 status; this may be a dev-mode behavior or a configuration issue.

---

## Test 4: XSS Protection

**Screenshot:** `screenshots/profile/04-xss-attempt.png`

| Vector | Status | Details |
|--------|--------|---------|
| `<script>alert(1)</script>` | PASS | No script execution; 404 page shown |
| `"><img src=x onerror=alert(1)>` | PASS | No script execution |
| `javascript:alert(1)` | PASS | No script execution |
| `' onmouseover='alert(1)` | PASS | No script execution |
| Script tag in DOM | PASS | Not rendered as HTML |

All XSS vectors are properly handled. The app treats malicious usernames as invalid paths and shows the 404 page. No JavaScript execution, no unescaped HTML rendering.

---

## Test 5: Action Button Interactions

### Generate Scouting Report
| Test | Status | Details |
|------|--------|---------|
| Button present | **FAIL** | Button does not render for unindexed profiles |
| Content generated | N/A | Cannot test |
| Analytical content | N/A | Cannot test |

### Draft Outreach
| Test | Status | Details |
|------|--------|---------|
| Button present | **FAIL** | Button does not render for unindexed profiles |
| 2 variants generated | N/A | Cannot test |

### Find Similar
| Test | Status | Details |
|------|--------|---------|
| Button present | PASS | "Find Similar" button in action toolbar |
| Click behavior | PASS | Navigates to search page |
| Query params | PASS | Pre-fills `q=C`, `similarTo=torvalds`, `similarName=Linus Torvalds` |
| Search results | PASS | Returns relevant C developers (antirez, Salvatore Sanfilippo, etc.) |
| locationSkipped param | PASS | Correctly skips location filter when location may not match |

**Screenshot:** `screenshots/profile/05c-find-similar-results.png`

### Share Card
| Test | Status | Details |
|------|--------|---------|
| Button present | PASS | "Share Card" button in action toolbar |
| Modal opens | PASS | Full-screen overlay with `z-index: 50`, dark backdrop |
| Card preview | PASS | Shows developer avatar, name, score (36.6), stats, languages |
| Copy Image button | PASS | Green button for clipboard copy |
| Download PNG button | PASS | Export to file |
| Copy Profile Link | PASS | Copy shareable URL |
| Modal design | PASS | Clean dark card design with score prominently displayed |

**Screenshot:** `screenshots/profile/05d-share-card-detail.png`

### GitHub Link
| Test | Status | Details |
|------|--------|---------|
| Link present | PASS | Blue "GitHub" button in toolbar |
| Opens in new tab | PASS | `target="_blank"` |
| Security attrs | PASS | `rel="noopener noreferrer"` |

---

## Test 6: Enrich Button

| Test | Status | Details |
|------|--------|---------|
| Button visible | **WARN** | Not rendered -- profile not indexed |
| Index-first flow | N/A | No "Index to unlock" button visible either |

> The Enrich button is part of ProfileActions, which only renders after a profile is indexed into the local database. For live-from-GitHub profiles, no enrichment controls appear. See Finding F03.

---

## Test 7: Save/Favorite Button (Auth Required)

| Test | Status | Details |
|------|--------|---------|
| Button visible | **WARN** | Not rendered -- profile not indexed |
| Auth prompt | N/A | Cannot test without button |

---

## Test 8: Push to Ashby Button (Auth Required)

| Test | Status | Details |
|------|--------|---------|
| Button visible | **WARN** | Not rendered -- profile not indexed |
| Auth/config prompt | N/A | Cannot test without button |

---

## Test 9: Add to List Button (Auth Required)

| Test | Status | Details |
|------|--------|---------|
| Button visible | **WARN** | Not rendered -- profile not indexed |
| List selection | N/A | Cannot test without button |

---

## Test 10: Responsive Design

**Screenshots:** `screenshots/profile/10-responsive-{viewport}.png`

### Desktop 1440px
| Test | Status | Details |
|------|--------|---------|
| No horizontal overflow | PASS | body=1440px, viewport=1440px |
| Avatar visible | PASS | |
| Buttons within viewport | PASS | 0 clipped |
| Text within viewport | PASS | 0 overflow |
| Layout | PASS | 2-column repo grid, spacious header |

### Laptop 1024px
| Test | Status | Details |
|------|--------|---------|
| No horizontal overflow | PASS | body=1024px, viewport=1024px |
| Avatar visible | PASS | |
| Buttons within viewport | PASS | 0 clipped |
| Text within viewport | PASS | 0 overflow |
| Layout | PASS | 2-column repo grid maintained |

### Tablet 768px
| Test | Status | Details |
|------|--------|---------|
| No horizontal overflow | PASS | body=768px, viewport=768px |
| Avatar visible | PASS | |
| Buttons within viewport | PASS | 0 clipped |
| Text within viewport | PASS | 0 overflow |
| Layout | PASS | Graceful stack, buttons wrap well |

### Mobile 375px
| Test | Status | Details |
|------|--------|---------|
| No horizontal overflow | PASS | body=375px, viewport=375px |
| Avatar visible | PASS | |
| Buttons within viewport | PASS | 0 clipped |
| Text within viewport | PASS | 0 overflow |
| Layout | PASS | Single-column, name wraps, buttons stack vertically |

> Responsive design is excellent. Zero issues across all 4 breakpoints. The mobile layout handles the profile header, action buttons, language bar, and repo grid gracefully without any overflow or clipping.

---

## Test 11: Dark Mode Consistency

**Screenshots:** `screenshots/profile/11-dark-mode.png`, `screenshots/profile/11-light-mode.png`, `screenshots/profile/11b-after-toggle-light.png`

| Test | Status | Details |
|------|--------|---------|
| Dark mode default | PASS | App defaults to dark theme (HTML class="dark") |
| Dark mode background | PASS | `rgb(10, 10, 15)` -- deep dark |
| Dark mode text | PASS | White text (`rgb(255, 255, 255)`) on dark background |
| No white backgrounds in dark | PASS | All elements properly themed |
| Theme toggle button | PASS | Accessible via `aria-label="Switch to light mode"` |
| Toggle switches to light | PASS | Body becomes `rgb(255, 255, 255)`, HTML class removes "dark" |
| prefers-color-scheme support | **FAIL** | System preference is ignored -- app always starts in dark mode |
| Light mode contrast issues | **WARN** | Minor: stats text (`rgb(23, 23, 23)`) on transparent bg inherits correctly, but OpenSCAD language text uses `lab(27.036 0 0)` which may have reduced contrast |

> **Finding F05:** The app ignores the `prefers-color-scheme` media query. Both `colorScheme: 'light'` and `colorScheme: 'dark'` browser contexts render the same dark background (`rgb(10, 10, 15)`). The user must manually toggle via the sun/moon button. This means users who prefer light mode will always get dark mode on first visit.

> The manual toggle works correctly and the light mode is well-designed overall.

---

## Test 12: External Links -- New Tab Audit

| Link | Target | rel | Status |
|------|--------|-----|--------|
| github.com/torvalds | `_blank` | `noopener noreferrer` | PASS |
| sindresorhus.com/apps | `_blank` | (present) | PASS |
| twitter.com/sindresorhus | `_blank` | (present) | PASS |
| github.com/sindresorhus | `_blank` | (present) | PASS |

All external links open in new tabs with proper security attributes.

---

## Findings & Recommendations

### F01 -- Database Pool Exhaustion Crashes Profile Page [P1-Critical]

**Observed:** When the Prisma connection pool is exhausted (`MaxClientsInSessionMode`), the entire profile page shows "Something went wrong" with a stack trace. No graceful fallback.

**Expected:** The page should fallback to the GitHub API path (which it does for non-indexed profiles) even when the database is unavailable. The error boundary should not expose internal error details.

**Recommendation:**
- Wrap the DB query in try/catch and fallback to GitHub API on DB failure
- Ensure the error boundary displays a user-friendly message without stack traces
- Consider increasing the Supabase session pool size or adding connection retry logic

### F02 -- 404 Page Returns HTTP 200 [P3-Low]

**Observed:** `/profile/nonexistent-user-xyz` returns HTTP 200 with a "Developer not found" UI.

**Expected:** Should return HTTP 404 status code for SEO and bot behavior.

**Recommendation:** Verify that Next.js `notFound()` is being called correctly and that the response status is being set. This may be a dev-mode quirk.

### F03 -- No UI for Unindexed Profile Actions [P2-High]

**Observed:** For profiles loaded live from GitHub (not in local DB), the following are completely absent from the page:
- Scouting Report (Generate button)
- Outreach Draft (Draft button)
- Enrich button
- Favorite/Save button
- Push to Ashby button
- Add to List button
- "Index to unlock actions" button

The user sees the profile with only Find Similar and Share Card buttons. There is no indication that more actions are available or how to unlock them.

**Expected:** Either:
1. Show an "Index this profile to unlock actions" CTA, or
2. Show disabled/grayed-out action buttons with tooltips explaining they require indexing, or
3. Auto-index on profile view and show actions after loading

**Recommendation:** Add a visible CTA or placeholder for gated actions so users understand the full feature set exists.

### F04 -- Score Breakdown Missing for Unindexed Profiles [P2-High]

**Observed:** The 5-pillar score breakdown (Impact, Contribution, Consistency, Technical, Reputation) does not render at all for profiles fetched live from GitHub.

**Expected:** Since a score IS computed and displayed (Score: 36.6), the breakdown of how that score was calculated should also be visible.

**Recommendation:** Either compute and display the breakdown for live-fetched profiles, or add a placeholder section explaining that detailed breakdown requires indexing.

### F05 -- prefers-color-scheme System Preference Ignored [P3-Low]

**Observed:** The app always starts in dark mode regardless of the user's system color scheme preference. The HTML element has `class="dark"` hardcoded.

**Expected:** Respect `prefers-color-scheme` on first visit, then persist the user's manual toggle choice.

**Recommendation:** Initialize theme from `prefers-color-scheme` media query on first visit, then store preference in localStorage for subsequent visits.

### F06 -- Sindresorhus Repository Selection [P4-Info]

**Observed:** The repos shown for sindresorhus include many small/recent utilities (css-extras, chunk-data, wsl-utils) rather than his most popular packages (awesome, ora, got, p-limit, etc.).

**Expected:** Repos should be sorted by stars (most popular first) for the best recruiter experience.

**Recommendation:** Verify that the repository sort order is by star count descending. The current display suggests alphabetical or recent-update ordering.

---

## Console Errors Observed

| Error | Count | Severity |
|-------|-------|----------|
| `DriverAdapterError: MaxClientsInSessionMode` | Variable | High -- causes page crash |
| `429 Too Many Requests` (GitHub API) | 23 | Medium -- rate limiting during rapid test execution |

---

## Screenshots Index

| File | Description |
|------|-------------|
| `01-torvalds-full-page.png` | Torvalds profile -- desktop 1440px |
| `02-sindresorhus-full-page.png` | Sindresorhus profile -- desktop 1440px |
| `03-404-page.png` | 404 error page for nonexistent user |
| `04-xss-attempt.png` | XSS vector attempt result |
| `05c-find-similar.png` | Find Similar navigation result |
| `05c-find-similar-results.png` | Find Similar search results page |
| `05d-share-card.png` | Share Card modal overlay |
| `05d-share-card-detail.png` | Share Card modal with Copy/Download options |
| `05d-share-card-modal.png` | Share Card viewport screenshot |
| `06-no-enrich.png` | Profile without Enrich button |
| `07-no-favorite.png` | Profile without Favorite button |
| `08-no-ashby.png` | Profile without Ashby button |
| `09-no-list-btn.png` | Profile without Add to List button |
| `10-responsive-desktop-1440.png` | Responsive -- 1440px |
| `10-responsive-laptop-1024.png` | Responsive -- 1024px |
| `10-responsive-tablet-768.png` | Responsive -- 768px |
| `10-responsive-mobile-375.png` | Responsive -- 375px |
| `11-dark-mode.png` | Dark mode (default) |
| `11-light-mode.png` | Light mode via prefers-color-scheme (renders dark -- bug) |
| `11b-after-toggle-light.png` | Light mode via manual toggle (correct) |

---

## Test Configuration

- **Browser:** Chromium (Playwright 1.58.2)
- **Viewports tested:** 1440x900, 1024x768, 768x1024, 375x812
- **Color schemes tested:** light, dark, manual toggle
- **Auth state:** Unauthenticated
- **XSS vectors tested:** 4 (script injection, img onerror, javascript: URI, onmouseover)
- **Profiles tested:** torvalds (high-profile, few repos), sindresorhus (prolific OSS, many repos), nonexistent-user-xyz (404)
- **Test duration:** ~3 minutes
- **Test script:** `qa-reports/search-deep-dive/test-profile-pages.mjs`
- **Raw results:** `qa-reports/search-deep-dive/profile-pages-results.json`
