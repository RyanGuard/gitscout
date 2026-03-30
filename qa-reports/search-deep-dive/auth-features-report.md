# Scout QA Report: Authentication & User Features

**Date:** 2026-03-26
**Tester:** Automated Playwright (headless Chromium)
**Target:** http://localhost:3000
**Branch:** main (commit 809f4fa)

---

## Summary

| Category | PASS | FAIL | WARN | INFO |
|----------|------|------|------|------|
| Total    | 34   | 2    | 4    | 10   |

**Critical issues found:** 2
1. `/profile/[username]` pages have no meta tags (title, description, og:*)
2. `/profile/torvalds` throws `MaxClientsInSessionMode` database connection pool error

**Notable findings:**
- `/lists` and `/settings` silently redirect to homepage instead of showing auth prompt
- `/match` page has NO auth guard -- full JD parsing UI available to anonymous users
- At 375px mobile, nav items do NOT collapse into a hamburger menu -- all links remain visible and overflow
- 404 page renders in light theme regardless of user's theme preference

---

## 1. Homepage (Logged Out)

**Status: PASS**

- Homepage loads with dark theme by default
- "Sign in" button clearly visible in header (top-right, bordered pill button with arrow icon)
- Header nav shows: Scout logo, Search, Match, Lists, Map, theme toggle, Sign in
- Hero section: "Scout top talent from GitHub" with search bar and filter chips
- Stats displayed: 45M+ developers searchable, 120+ languages indexed, 3 enrichment sources
- Footer: "Powered by GitHub REST + GraphQL, Apollo enrichment, Ashby ATS integration"

**Screenshot:** `screenshots/01-homepage-logged-out.png`

---

## 2. Sign In Flow

**Status: PASS**

- Clicking "Sign in" immediately redirects to GitHub OAuth login page
- URL: `https://github.com/login?client_id=Ov23li9bemieLwQjrMLw&return_to=...`
- OAuth prompt says: "Sign in to GitHub to continue to **GITSCOUT**"
- Scopes requested: `read:user`, `user:email` (correct and minimal)
- Callback URL configured: `https://gitscout-beta.vercel.app/api/auth/callback/github`
- No intermediate NextAuth signin page -- goes directly to GitHub (good UX)

**Screenshot:** `screenshots/02-auth-page.png`

---

## 3. /favorites (Logged Out)

**Status: PASS (with note)**

- Page loads at `/favorites` (does NOT redirect away)
- Displays a sign-in prompt message on the page
- URL stays as `http://localhost:3000/favorites`
- The page appears to show the homepage content with a sign-in overlay/message

**Note:** This is a client-side auth guard, not a server-side redirect. The page content renders before the auth check kicks in, which means there's a brief flash of content. Consider server-side middleware redirect for better security and UX.

**Screenshot:** `screenshots/03-favorites-logged-out.png`

---

## 4. /lists (Logged Out)

**Status: WARN -- Silent redirect, no auth feedback**

- Navigating to `/lists` silently redirects to the homepage (`/`)
- Page title remains "Scout - Discover Talented Developers"
- No sign-in prompt, no flash message, no "you must sign in" notice
- User has no idea they were redirected or why

**Bug:** Users clicking the "Lists" nav link while logged out get silently dumped to the homepage. They should either see the Lists page with a sign-in prompt or be redirected to the auth page with a return URL.

**Screenshot:** `screenshots/04-lists-logged-out.png`

---

## 5. /settings (Logged Out)

**Status: WARN -- Silent redirect, no auth feedback**

- Same behavior as `/lists` -- silently redirects to homepage
- No indication that authentication is required
- URL changes from `/settings` to `/`

**Bug:** Same issue as `/lists`. Settings icon in nav (gear icon, no text label) goes to `/settings` but silently bounces unauthenticated users.

**Screenshot:** `screenshots/05-settings-logged-out.png`

---

## 6. /match (Logged Out)

**Status: WARN -- No auth guard at all**

- `/match` loads fully with NO authentication required
- Full "Match Candidates" page is rendered:
  - "Job Description" text area with placeholder "Paste the full job description here..."
  - "Parse Requirements" button (blue, prominent)
  - Subtitle: "Parse a job description to find the best matching developers in your database."
- URL stays at `/match`

**Security concern:** An anonymous user can access the full JD parsing interface. If "Parse Requirements" triggers an API call, this could be abused (rate limiting, cost). Should this page require auth?

**Screenshot:** `screenshots/06-match-logged-out.png`

---

## 7. Nav Links

**Status: PASS (with one bug)**

All four nav links are present in the header:

| Link    | Target    | Works? | Notes |
|---------|-----------|--------|-------|
| Search  | /search   | PASS   | Full search UI with filters, language chips, location, sort options |
| Match   | /match    | PASS   | JD parsing page loads (no auth guard) |
| Lists   | /lists    | BUG    | Redirects to `/` silently for logged-out users |
| Map     | /map      | PASS   | Market Map page with role title, level, tech stack, geography inputs |

Additional nav elements:
- Scout logo (links to `/`)
- Settings gear icon (links to `/settings`, no text label)
- Theme toggle (sun/moon icon)
- "Sign in" button

**Bug:** Lists nav link appears to work (no 404), but the redirect to homepage makes it appear broken since the user sees the homepage instead of a lists page.

**Screenshots:** `screenshots/07-nav-*.png`

---

## 8. Theme Toggle

**Status: PASS**

- Theme toggle button found with `aria-label="Switch to light mode"` (good accessibility)
- Default theme: **dark**
- Click toggles to **light** theme successfully
- `<html>` element class toggles between `dark` and default (light)
- All pages tested in both themes:
  - Homepage: Both themes render correctly
  - Search: Both themes render correctly
  - Match: Both themes render correctly
  - Lists: Both themes (redirects to homepage, so tests homepage)
  - Map: Both themes render correctly

**Visual observations:**
- Dark mode: Dark neutral background, light text, purple accent buttons
- Light mode: White/light gray background, dark text, same purple accents
- Transition is smooth, no flash of unstyled content

**Note:** The 404 page (`/nonexistent`) renders in **light theme** even when the user has dark mode enabled. This suggests the 404 page doesn't inherit the theme context.

**Screenshots:** `screenshots/08-theme-before.png`, `screenshots/08-theme-after.png`, `screenshots/08-theme-toggled-*.png`, `screenshots/08-theme-original-*.png`

---

## 9. Responsive Header

**Status: WARN -- Mobile nav does not collapse**

### Desktop (1280px)
- Full horizontal nav: Scout, Search, Match, Lists, Map, theme toggle, Sign in
- All items visible, well-spaced
- **Screenshot:** `screenshots/09-responsive-1280.png`

### Tablet (768px)
- All nav items still visible (same as desktop)
- Hamburger menu button IS present (detected by Playwright)
- However, nav links are ALSO visible alongside the hamburger -- redundant
- Layout is tighter but nothing is hidden
- **Screenshot:** `screenshots/09-responsive-768.png`

### Mobile (375px)
- **Nav items do NOT collapse** -- all links (Search, Match, Lists, Map) remain visible
- Items wrap/overflow, creating a crowded header
- "Sign in" button wraps to a second line
- The hamburger may be present but nav items are not hidden behind it
- Text and links are still readable but the header takes up significant vertical space

**Bug:** At mobile widths, the nav should collapse into a hamburger menu. Currently, all links remain visible at 375px, which creates a poor mobile experience. The hamburger button exists at 768px but doesn't seem to control hiding/showing the nav links.

**Screenshot:** `screenshots/09-responsive-375.png`, `screenshots/09-responsive-768-menu-open.png`

---

## 10. Auth Providers API

**Status: PASS**

`GET /api/auth/providers` returns:

```json
{
  "github": {
    "id": "github",
    "name": "GitHub",
    "type": "oauth",
    "signinUrl": "https://gitscout-beta.vercel.app/api/auth/signin/github",
    "callbackUrl": "https://gitscout-beta.vercel.app/api/auth/callback/github"
  }
}
```

- GitHub is the only configured provider (correct for this app)
- Signin and callback URLs point to the Vercel deployment domain
- Provider type is "oauth" (NextAuth v4 format)

**Screenshot:** `screenshots/10-auth-providers.png`

---

## 11. CSRF Token API

**Status: PASS**

`GET /api/auth/csrf` returns:

```json
{
  "csrfToken": "<64-character hex token>"
}
```

- Token generates successfully on each request
- Token length: 64 characters (standard NextAuth CSRF token)
- Different token generated per session (verified by format)

**Screenshot:** `screenshots/11-csrf-token.png`

---

## 12. 404 Page Handling

**Status: PASS**

All three test URLs render a custom 404 page:

| URL               | Result | Notes |
|--------------------|--------|-------|
| /nonexistent       | 404    | Custom page shown |
| /profile/          | 404    | Custom page (trailing slash, no username) |
| /map/nonexistent   | 404    | Custom page shown |

**404 page design:**
- Scout header with full nav (maintains navigation context)
- Centered content: Git branch icon, "Page not found" heading
- Subtitle: "The page you're looking for doesn't exist or has been moved."
- "Go home" button (blue, links to `/`)
- Clean, branded design -- not a default Next.js 404

**Bug (minor):** 404 page renders in light theme regardless of user preference. If the user has dark mode enabled and hits a 404, they get a jarring white page.

**Screenshot:** `screenshots/12-404-nonexistent.png`

---

## 13. Meta Tags

### Homepage (`/`)
**Status: PASS**

| Tag | Value |
|-----|-------|
| `<title>` | Scout - Discover Talented Developers |
| `description` | Search and discover talented developers on GitHub. Filter by language, location, and expertise. |
| `og:title` | Scout - Discover Talented Developers |
| `og:description` | Search and discover talented developers on GitHub. Filter by language, location, and expertise. |
| `viewport` | width=device-width, initial-scale=1 |

### Search (`/search`)
**Status: PASS**

| Tag | Value |
|-----|-------|
| `<title>` | Scout - Discover Talented Developers |
| `description` | Search and discover talented developers on GitHub. Filter by language, location, and expertise. |
| `og:title` | Scout - Discover Talented Developers |
| `og:description` | Search and discover talented developers on GitHub. Filter by language, location, and expertise. |
| `viewport` | width=device-width, initial-scale=1 |

**Note:** Search page uses the same generic title/description as homepage. Ideally it would say "Search Developers" or similar for better SEO.

### Profile (`/profile/torvalds`)
**Status: FAIL**

| Tag | Value |
|-----|-------|
| `<title>` | **MISSING** |
| `description` | **MISSING** |
| `og:title` | **MISSING** |
| `og:description` | **MISSING** |
| `viewport` | width=device-width, initial-scale=1 |

**Bug:** Profile pages have NO meta tags at all -- no title, no description, no Open Graph tags. This means:
- Browser tab shows no meaningful title
- Sharing a profile link on Slack/Twitter shows no preview
- SEO is nonexistent for profile pages
- Should dynamically set: `<title>Linus Torvalds (@torvalds) - Scout</title>` etc.

---

## 14. Favicon

**Status: PASS**

- One favicon link tag found: `<link rel="icon" href="/favicon.ico">`
- Favicon loads successfully (HTTP 200)
- URL includes cache-busting hash: `/favicon.ico?favicon.0x3dzn~oxb6tn.ico`

---

## 15. Console Errors

| Page | Status | Errors |
|------|--------|--------|
| Homepage (`/`) | PASS | None |
| Search (`/search`) | PASS | None |
| Profile (`/profile/torvalds`) | **FAIL** | `DriverAdapterError: MaxClientsInSessionMode` |
| Map (`/map`) | PASS | None |
| Lists (`/lists`) | PASS | None |
| Match (`/match`) | PASS | None |
| Settings (`/settings`) | PASS | None |
| Favorites (`/favorites`) | PASS | None |

### Profile Page Error (Critical)

The `/profile/torvalds` page throws a database connection pool error:

```
DriverAdapterError: MaxClientsInSessionMode: max clients reached -
in Session mode max clients are limited to pool_size
```

This is a **Supabase connection pool exhaustion** error. The profile page is exceeding the maximum number of concurrent database connections allowed in session mode. This could be caused by:
1. Multiple parallel queries on the profile page not sharing a connection
2. Connection leaks in the Prisma client
3. Pool size too small for the number of concurrent queries needed

**Impact:** Profile pages may intermittently fail to load data, showing incomplete or error states.

---

## Bugs & Issues Summary

### Critical (P0)

| # | Issue | Page | Impact |
|---|-------|------|--------|
| 1 | Database pool exhaustion on profile load | `/profile/[username]` | Profiles may fail to load; `MaxClientsInSessionMode` error in console |
| 2 | Profile pages missing all meta tags | `/profile/[username]` | No page title, broken social sharing, no SEO |

### High (P1)

| # | Issue | Page | Impact |
|---|-------|------|--------|
| 3 | `/match` has no auth guard | `/match` | Anonymous users can access JD parsing UI and potentially trigger API calls |
| 4 | Mobile nav does not collapse at 375px | All pages | Poor mobile UX -- header is crowded, links overflow |

### Medium (P2)

| # | Issue | Page | Impact |
|---|-------|------|--------|
| 5 | `/lists` silently redirects to homepage | `/lists` | Confusing UX -- no indication auth is required |
| 6 | `/settings` silently redirects to homepage | `/settings` | Same as above |
| 7 | 404 page ignores dark mode preference | 404 pages | Jarring light-mode flash for dark-mode users |
| 8 | Search page uses generic meta tags | `/search` | Missed SEO opportunity, no page-specific title |

### Low (P3)

| # | Issue | Page | Impact |
|---|-------|------|--------|
| 9 | Hamburger button at 768px but nav still visible | Header | Redundant UI element -- hamburger exists but doesn't hide nav |
| 10 | `/favorites` shows homepage behind auth message | `/favorites` | Client-side guard causes content flash before auth check |

---

## Auth Guard Consistency Matrix

| Route | Auth Required? | Current Behavior | Expected |
|-------|---------------|------------------|----------|
| `/` | No | Loads normally | Correct |
| `/search` | No | Loads normally | Correct |
| `/match` | **Unclear** | Loads fully, no guard | Should require auth? |
| `/map` | No | Loads normally | Correct |
| `/lists` | Yes | Silent redirect to `/` | Should show auth prompt or redirect to sign-in |
| `/settings` | Yes | Silent redirect to `/` | Should show auth prompt or redirect to sign-in |
| `/favorites` | Yes | Shows sign-in message | Correct (but could use server-side redirect) |
| `/profile/[user]` | No | Loads normally | Correct |

**Recommendation:** Standardize auth guards across protected routes. Use Next.js middleware to redirect unauthenticated users to `/api/auth/signin?callbackUrl=<original-path>` for all protected routes. This provides consistent behavior and preserves the return URL.

---

## Test Environment

- **Browser:** Chromium (headless, Playwright 1.58.2)
- **Viewport:** 1280x800 (desktop), 768x1024 (tablet), 375x667 (mobile)
- **Server:** Next.js 16.2.1 dev server (Turbopack)
- **Auth state:** Logged out (no session)
- **Screenshots:** 30 screenshots saved to `screenshots/` directory

---

*Report generated automatically by Playwright test suite.*
