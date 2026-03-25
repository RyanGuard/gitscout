# Search Pipeline Audit Report

**Date:** 2026-03-25
**Auditor:** Backend QA Engineer (automated)
**Scope:** Full search flow from `/api/search` through GitHub API, scoring, caching, and all supporting modules
**Environment:** localhost:3000 (dev), no GITHUB_TOKEN configured

---

## 1. Search Flow Documentation

### 1.1 Architecture Overview

GitScout has **three search endpoints** that serve different use cases:

| Endpoint | Method | Purpose | Speed | Quality |
|----------|--------|---------|-------|---------|
| `/api/search` (GET) | GET | Live GitHub user search + local DB merge | 1-5s | Medium |
| `/api/search` (POST) | POST | SSE orchestrator: quick + deep in parallel | 5-30s | High |
| `/api/search/quick` | POST | Fast GitHub Search Users API path | 1-2s | Low |
| `/api/search/deep` | POST | Seed repo contributor mining + GraphQL enrichment + 5-pillar scoring | 5-15s | High |

### 1.2 GET `/api/search` Flow (Primary)

```
User query (e.g., "typescript san francisco")
    |
    v
1. parseNaturalQuery(q) --> extracts languages, location, role, filler words
    |
    v
2. buildGitHubQuery() --> constructs GitHub search syntax
   e.g., "language:typescript location:\"san francisco\" followers:>=5"
    |
    v
3. GET https://api.github.com/search/users?q=...&sort=followers&per_page=20
    |
    v
4. For each result, check Prisma DB: Developer.findMany({ where: { githubId: { in: ids } } })
    |--- Local hit: use stored profile + languages + repos (source: "local")
    |--- Local miss: fetch GET /users/{login} in parallel (source: "github")
    |--- Fetch fail: use minimal search result data (source: "github", position-based score)
    |
    v
5. Merge results, sort by score descending
    |
    v
6. Return JSON: { developers, total, page, totalPages, query }
```

**Key files:**
- `src/app/api/search/route.ts` (lines 409-586) -- GET handler
- `src/app/api/search/route.ts` (lines 224-296) -- `parseNaturalQuery()`
- `src/app/api/search/route.ts` (lines 299-361) -- `buildGitHubQuery()`
- `src/app/api/search/route.ts` (lines 365-377) -- `quickScore()`

### 1.3 POST `/api/search` Flow (SSE Orchestrator)

```
POST body: { roleCategory, language, location, minFollowers, minStars, query, perPage, page }
    |
    v
1. Open ReadableStream with text/event-stream headers
    |
    v
2. Always run: fetch /api/search/quick (internal call)
   --> sends SSE event: "quick_results"
    |
    v
3. If roleCategory specified: fetch /api/search/deep (internal call)
   --> sends SSE events: "deep_progress" (0.1, 0.6), "deep_results"
    |
    v
4. Send "complete" event with quickCount + deepCount + unicorns
```

**Key file:** `src/app/api/search/route.ts` (lines 5-88)

### 1.4 Quick Search Flow (`/api/search/quick`)

```
POST body --> build GitHub query with language/location/followers/repos filters
    |
    v
GitHubClient.searchUsers() (with Supabase cache, 1hr TTL)
    |
    v
For each result: GitHubClient.getUser(login) (with 24hr cache)
    |
    v
Return { total_count, developers[] } with quickScore metadata
```

**Key file:** `src/app/api/search/quick/route.ts`

### 1.5 Deep Search Flow (`/api/search/deep`)

```
POST body: { roleCategory, language, location, ... }
    |
    v
1. Load seed repos for role category (ROLE_CATEGORIES)
    |
    v
2. Search trending repos: language:X stars:>500 pushed:>90days
    |
    v
3. Merge seed + trending repos (max 15 repos scanned)
    |
    v
4. For each repo: getRepoContributors() (max 200 unique contributors)
    |
    v
5. Rank by rawRelevance = repos_count*10 + sum(weight*5) + log(commits)*3
    |
    v
6. Take top 100, enrich in batches of 10:
   - getUser(login) -- REST profile
   - getEnrichedProfile(login) -- GraphQL (contributions, repos, orgs)
   - getExternalMergedPRs(login) -- Search API
   - Location filter (fuzzy matching)
    |
    v
7. calculateScore() via 5-pillar engine (0-100 with confidence modifier)
    |
    v
8. Sort by score, return top maxResults (default 50)
```

**Key files:**
- `src/app/api/search/deep/route.ts` -- Deep pipeline
- `src/lib/search/seedRepos.ts` -- Curated repos by role (6 categories, ~80 repos)
- `src/lib/scoring/engine.ts` -- V2 scoring engine with breakdown
- `src/lib/github/client.ts` -- GitHubClient class with caching + retry

---

## 2. API Call Results

### Test Environment

- **GITHUB_TOKEN:** NOT SET (using unauthenticated GitHub API: 10 search req/min, 60 core req/hr)
- **Database:** Prisma dev server (has some pre-indexed profiles)

### 2.1 GET /api/search?q=typescript+san+francisco

**Query built:** `language:typescript location:"san francisco" followers:>=5`

| Run | HTTP | Total | Returned | Sources | Tiers | Time |
|-----|------|-------|----------|---------|-------|------|
| 1 | 200 | 0 | 0 | -- | -- | 1.7s |
| 2 | 200 | varies | varies | local: some, github: rest | Emerging, Limited Data | 2-5s |

**Observations:**
- Results are inconsistent due to unauthenticated rate limiting
- When rate limit allows: GitHub returns ~239 matches, app fetches 20 per page
- Local DB profiles (e.g., `mahseema`) have real scores (56) and enriched data
- GitHub-only profiles have position-based scores (25, 24, 23...) with all null fields
- First result from local DB (`mahseema`, score 56) has company, bio, followers. GitHub-only results have nothing.

### 2.2 GET /api/search?q=python+austin

**Query built:** `language:python location:"austin" followers:>=5`

| Run | HTTP | Total | Returned | Sources | Time |
|-----|------|-------|----------|---------|------|
| 1 | 200 | 0 | 0 | -- | 2.1s |
| 2 | 200 | varies | 20 | All github, mostly Limited Data | ~3s |

**Observations:**
- GitHub returns ~1407 matches for this query
- App returns Organizations (e.g., `ContinuumIO`) as results -- no `type:user` filter in GET handler
- All results show position-based scores (25 down to 6), no real profile data
- This happens because individual `/users/{login}` fetches also get rate-limited without token

**Bug: GET handler does NOT filter `type:user` from GitHub results. Organizations appear in developer results.**

### 2.3 POST /api/search (roleCategory: frontend)

**Result:** SSE stream returned (Content-Type: text/event-stream)

```
event: status
data: {"message":"Running quick search..."}

event: quick_results
data: {"total_count":0,"developers":[]}

event: deep_progress
data: {"message":"Scanning frontend contributors...","progress":0.1}

event: error
data: {"message":"fetch failed"}

HTTP_STATUS: 200
TIME_TOTAL: 333.98s (5 min 34s!)
```

**Observations:**
- Quick search returned empty (rate limited, no GITHUB_TOKEN)
- Deep search **failed after 334 seconds** with `"fetch failed"` -- the internal HTTP fetch to `/api/search/deep` timed out
- The SSE orchestrator held the connection open for 5.5 minutes before erroring
- No timeout/AbortController protects the internal fetch calls
- On Vercel Hobby tier (60s function timeout), this would always fail for deep search
- The `"complete"` event was never sent -- the error handler caught it but `controller.close()` in `finally` still ran

**Bug: SSE orchestrator has no timeout on internal fetches. Deep search can hang indefinitely.**

### 2.4 GET /api/search?q=buenos+aires

**Query built:** `location:"buenos aires" followers:>=5`

| Run | HTTP | Total | Returned | Sources | Tiers | Time |
|-----|------|-------|----------|---------|-------|------|
| 1 | 200 | 1000 | 20 | All github | All "Limited Data" | 0.46s |
| 2 | 200 | 0 | 0 | -- | -- | (rate limited) |

**Observations:**
- Fast (0.46s) because no individual profile fetches succeed
- All 20 results have position-based scores (25 down to 6), zero enrichment
- `goncy` (6494 GitHub user) tops results -- correct match for Buenos Aires

### 2.5 GitHub API Direct Comparison

| Query | GitHub Direct | Our API | Match? |
|-------|-------------|---------|--------|
| typescript SF | 239 results, top: `trekhleb` | 0-20 results, intermittent | Partial -- rate limited |
| python austin | 1407 results, includes orgs | 0-20, includes orgs | Yes but includes orgs (bug) |
| buenos aires | 8040 results | 1000 cap (correct), 20 returned | Yes, same user order |

---

## 3. Feature Existence Audit

### IMPLEMENTED (Exists and Works)

| Feature | Status | Location | Notes |
|---------|--------|----------|-------|
| Quick Search (GET) | IMPLEMENTED | `route.ts` GET handler | Live GitHub /search/users + local merge |
| Quick Search (POST) | IMPLEMENTED | `search/quick/route.ts` | Via GitHubClient with caching |
| Deep Search | IMPLEMENTED | `search/deep/route.ts` | Seed repo mining + GraphQL + scoring |
| SSE Streaming | IMPLEMENTED | `route.ts` POST handler | Orchestrates quick + deep via internal fetch |
| 5-Pillar Scoring (V1) | IMPLEMENTED | `src/lib/scoring.ts` | Impact/Contribution/Consistency/Technical/Reputation |
| 5-Pillar Scoring (V2) | IMPLEMENTED | `src/lib/scoring/engine.ts` | Enhanced with seed repo context, notable orgs, confidence |
| Quick Score (REST-only) | IMPLEMENTED | `route.ts:365-377` | Lightweight score from follower/repo signals |
| NLP Query Parsing | IMPLEMENTED | `route.ts:224-296` | Extracts language, location, role from natural language |
| Location Matching | IMPLEMENTED | `lib/search/locationMatch.ts` | 18 target cities, 200+ aliases, fuzzy matching |
| Location Aliases | IMPLEMENTED | `route.ts:142-154` | Maps SF/NYC/LA/PNW/etc to GitHub-recognized cities |
| Seed Repos | IMPLEMENTED | `lib/search/seedRepos.ts` | 6 categories, ~80 repos, weight 1-3 |
| Rate Limiting (client) | IMPLEMENTED | `lib/github/client.ts` | Tracks remaining/reset, waits when low, retry with backoff |
| Rate Limiting (pipeline) | IMPLEMENTED | `pipeline/github.ts` | Separate search vs core tracking, exponential backoff |
| GraphQL Contributions | IMPLEMENTED | `pipeline/graphql.ts` | Contribution calendar, PR reviews, sponsorship |
| External Merged PRs | IMPLEMENTED | `pipeline/graphql.ts` + `lib/github/client.ts` | Search API: `author:X is:pr is:merged -user:X` |
| Supabase Caching | IMPLEMENTED | `lib/github/client.ts:66-103` | `api_cache` table with key/response/TTL |
| Pre-indexing Cron | IMPLEMENTED | `api/cron/index-developers/route.ts` | Daily at 4am UTC, mines seed repo contributors |
| Stale Re-sync Cron | IMPLEMENTED | `api/cron/route.ts` + `pipeline/scheduler.ts` | Daily at 3am UTC, re-syncs profiles older than 7 days |
| Pipeline Sync | IMPLEMENTED | `pipeline/github.ts` | Full user+repos+GraphQL+score+DB upsert |
| Enrichment Pipeline | IMPLEMENTED | `pipeline/enrichment.ts` | Apollo.io, commit email mining, company normalization, seniority inference |
| Role Inference | IMPLEMENTED | `route.ts:157-211` | Maps roles to languages + search terms |
| XSS Sanitization | IMPLEMENTED | `route.ts:91-93` | Strips `<>` from query, 200 char limit |

### PARTIALLY IMPLEMENTED (Exists but Has Issues)

| Feature | Status | Issue |
|---------|--------|-------|
| Supabase Cache | PARTIAL | `api_cache` table referenced in client.ts but NOT in Prisma schema -- requires raw pg Client |
| Pre-index Cron | PARTIAL | `cron_logs` table referenced but not in Prisma schema -- uses raw pg Client |
| Deep Search Location | PARTIAL | Uses basic string matching, NOT the sophisticated `matchesLocation()` from locationMatch.ts |
| SSE Orchestrator | PARTIAL | Uses internal HTTP fetch to own routes (fragile in serverless), hardcodes `request.url` base |
| Quick Search (POST) | PARTIAL | Joins query parts with `+` instead of space (may cause issues with some queries) |

### NOT IMPLEMENTED (Missing)

| Feature | Status | Impact |
|---------|--------|--------|
| type:user filter on GET | MISSING | Organizations appear in developer search results |
| Search timeout | REFERENCED but NOT WIRED | No AbortController or timeout on GitHub API calls in GET handler |
| Result deduplication | MISSING | Same user could appear from quick + deep in SSE flow |
| Pagination for deep search | MISSING | Deep search always returns single batch, no page param |
| Search history/analytics | MISSING | No tracking of what users search for |
| Webhook/realtime updates | MISSING | No push mechanism for new results |
| Full-text search on local DB | MISSING | Local DB only matches by githubId, not by name/bio/skills |

---

## 4. Scoring Analysis

### Two Competing Scoring Systems

**V1:** `src/lib/scoring.ts` -- `computeScore()`
- Used by: `pipeline/github.ts` (syncOneUser)
- Input: `{ user: GitHubUser, repos: GitHubRepo[], contributions: ContributionData }`
- Output: 0-100 score with tier (Elite/Strong/Solid/Emerging/Limited Data)
- Confidence: high (1.0), medium (0.9), low (0.75)

**V2:** `src/lib/scoring/engine.ts` -- `calculateScore()`
- Used by: `search/deep/route.ts`, `api/cron/index-developers/route.ts`
- Input: Extended `ScoringInput` with seedRepoContributions, organizations, targetLanguage
- Output: 0-100 score with tier emojis (Unicorn/On Fire/Gem/Seedling/Mystery)
- Includes: breakdown per sub-signal, notable org detection

**Quick Score:** `route.ts:365-377` -- `quickScore()`
- Used by: GET handler for GitHub-only profiles
- Input: GitHubUser REST data only (no GraphQL)
- Output: 0-100 score estimate

**Problem:** Three different scoring formulas produce different scores for the same developer depending on which path they come through. A developer in the local DB (scored by V1 via pipeline sync) will have a different score than the same developer found via deep search (scored by V2).

### Scoring Divergence Examples

| Signal | V1 Weight | V2 Weight | Quick Score |
|--------|-----------|-----------|-------------|
| Impact | 30% | 30% | 45% (followers) |
| Contribution | 25% | 25% | -- |
| Consistency | 20% | 20% | -- |
| Technical | 15% | 15% | -- |
| Reputation | 10% | 10% | 30% (repos) + bonus |

V1 and V2 share the same pillar weights but have different threshold tables and sub-signal compositions. V2 adds seed repo contributions and notable org detection that V1 lacks.

---

## 5. Critical Findings

### CRIT-1: No GITHUB_TOKEN = Search is Dead

The app has no GITHUB_TOKEN in `.env`. Without it:
- Unauthenticated rate limit: 10 searches/min, 60 API calls/hr
- GraphQL API: completely non-functional (requires auth)
- Deep search: returns empty (needs GraphQL)
- GET search: intermittently returns empty when rate-limited
- Cron pre-indexing: non-functional

**Severity:** CRITICAL
**Impact:** Production would have the token via Vercel env vars. Dev/QA is completely broken.

### CRIT-2: Organizations in Search Results

The GET handler's GitHub query does NOT include `type:user`. GitHub's `/search/users` returns both Users and Organizations. The app treats Organizations as developer profiles with 0 followers, 0 repos.

**Severity:** HIGH
**Location:** `route.ts:440-461` -- no `type:user` in query params
**Quick Search:** Already includes `type:user` (line 28 of quick/route.ts)

### HIGH-1: Position-Based Scoring Fallback

When individual profile fetches fail (rate limit, network), developers get a descending position score (25, 24, 23...). This score is meaningless -- it's just `25 - indexOf(user)`. These position-scored profiles have zero useful data (null name, email, bio, company, location, repos, languages).

**Severity:** HIGH
**Location:** `route.ts:547-573`
**Impact:** In rate-limited conditions, all results are "Limited Data" with fake scores

### HIGH-2: SSE Uses Internal HTTP Fetch -- Confirmed 334s Timeout

The POST SSE handler calls its own routes via internal `fetch()`:
```js
const baseUrl = request.url.replace(/\/api\/search.*/, "");
await fetch(`${baseUrl}/api/search/quick`, { ... });
await fetch(`${baseUrl}/api/search/deep`, { ... });
```

**Confirmed failure:** POST with `roleCategory: "frontend"` took **334 seconds** then returned `"fetch failed"`. The deep search internal fetch hung until Node's default socket timeout killed it. No `AbortController` or timeout is set on either internal fetch.

On Vercel Hobby tier (60s function timeout), this architecture guarantees failure for deep search -- the outer SSE function will be killed before the inner deep search function completes.

**Severity:** HIGH (CRITICAL on Vercel)
**Location:** `route.ts:10,22-33,44-55`

### MED-1: Duplicate Scoring Engines

V1 (`scoring.ts`) and V2 (`scoring/engine.ts`) produce different scores for the same profile. Pipeline sync uses V1, deep search uses V2. This means a developer's score changes depending on how they were discovered.

### MED-2: Cache Table Not in Prisma Schema

The `api_cache` and `cron_logs` tables are accessed via raw `pg` Client connections, completely outside Prisma's management. They must exist in the Supabase database but won't be created by `prisma db push`.

### MED-3: Deep Search Location Filter is Naive

Deep search (lines 136-148 of deep/route.ts) uses basic string includes:
```js
if (!userLoc.includes(searchLoc) && !searchLoc.includes(userLoc)) {
    // hardcoded aliases for sf/nyc/la/bay area only
}
```
Meanwhile, the codebase has a sophisticated `matchesLocation()` function in `lib/search/locationMatch.ts` with 18 target cities and 200+ aliases that is NOT used by deep search.

### LOW-1: Quick Search POST Joins with `+`

`quick/route.ts:30`: `parts.join("+")` -- GitHub API uses spaces between query parts, not `+`. The URL encoding handles this, but it's technically incorrect in the query string value itself.

### LOW-2: Buenos Aires Query Has No Language Filter

When searching "buenos aires" (location-only, no language), the query becomes:
`location:"buenos aires" followers:>=5`
This returns ALL developers in Buenos Aires regardless of tech stack -- may be intentional but reduces signal quality for talent sourcing.

---

## 6. Data Flow Gaps

### What Happens to Search Results?

```
GET /api/search --> Results returned to frontend --> NOT stored
                     |
                     +--> User clicks profile --> GET /api/profiles/[username]
                     |                             --> fetched from DB or GitHub
                     |                             --> stored in DB if fetched
                     |
                     +--> User clicks "Enrich" --> POST /api/enrichment
                     |                             --> Apollo + email mining
                     |                             --> stored in DB
                     |
                     +--> User favorites --> POST /api/favorites
```

Search results from the GET handler are **ephemeral** -- they are not stored. Only profile views, enrichment, and favorites trigger database writes. This is by design (CLAUDE.md: "Only developers the recruiter interacts with get stored locally").

### Pre-indexing fills the DB proactively

The `/api/cron/index-developers` job mines seed repo contributors and stores them in the DB. When a search hits a pre-indexed developer, the local DB version is used (with full scoring and language data). This is the "warm cache" path.

---

## 7. Component Dependency Map

```
route.ts (GET)
  |-- parseNaturalQuery()     [inline, lines 224-296]
  |-- buildGitHubQuery()      [inline, lines 299-361]
  |-- quickScore()            [inline, lines 365-377]
  |-- githubUserToProfile()   [inline, lines 380-407]
  |-- prisma                  [from @/lib/prisma]
  |-- GitHubUser type         [from @/types]
  +-- GitHub REST API         [fetch, no client class]

route.ts (POST/SSE)
  +-- /api/search/quick       [internal HTTP fetch]
  +-- /api/search/deep        [internal HTTP fetch]

search/quick/route.ts
  +-- GitHubClient            [from @/lib/github/client]
      |-- searchUsers()       [REST + Supabase cache]
      +-- getUser()           [REST + Supabase cache]

search/deep/route.ts
  |-- GitHubClient            [from @/lib/github/client]
  |   |-- getRepoContributors()
  |   |-- searchRepos()
  |   |-- getUser()
  |   |-- getEnrichedProfile()   [GraphQL]
  |   +-- getExternalMergedPRs() [Search API]
  |-- getCategoryById()       [from @/lib/search/seedRepos]
  +-- calculateScore()        [from @/lib/scoring/engine -- V2]

pipeline/github.ts
  |-- fetchWithRetry()        [own retry logic, separate from GitHubClient]
  |-- fetchGitHubUser()
  |-- fetchGitHubRepos()
  |-- searchGitHubUsers()
  |-- computeScore()          [from @/lib/scoring -- V1]
  |-- fetchContributions()    [from @/pipeline/graphql]
  +-- prisma                  [DB upsert]
```

**Notable:** The GET handler uses its own inline `githubHeaders()` + raw `fetch()`, completely separate from `GitHubClient`. The pipeline also has its own fetch/retry/headers. Three separate GitHub API abstraction layers exist.

---

## 8. Rate Limiting Analysis

### Three Independent Rate Limit Implementations

| Component | File | Mechanism |
|-----------|------|-----------|
| GET handler | `route.ts` | None -- raw fetch, no rate limit tracking |
| GitHubClient | `lib/github/client.ts` | Tracks remaining/reset, waits when <100, blocks when <10 |
| Pipeline | `pipeline/github.ts` | Tracks remaining/reset, waits when <10, 3-attempt retry |

The GET handler (primary search path) has **zero rate limit awareness**. It will fire 20+ parallel profile fetches without checking if there's budget. This explains why `typescript san francisco` intermittently returns empty -- GitHub returns 403/429 on the profile fetches.

### Rate Budget per Search

| Operation | Calls | Endpoint | Limit |
|-----------|-------|----------|-------|
| GET search | 1 | /search/users | 10/min (unauth) or 30/min (auth) |
| Profile fetches | up to 20 | /users/{login} | 60/hr (unauth) or 5000/hr (auth) |
| **Total per search** | **~21** | | |

At 60 unauth core calls/hr, the app can handle ~3 searches per hour before exhausting profile fetch budget.

---

## 9. Summary

### What Works Well
- NLP query parsing is sophisticated and handles roles, languages, locations, aliases
- 5-pillar scoring framework is well-designed with tiered thresholds and confidence modifiers
- Seed repo system covers 6 role categories with weighted repos
- Location matching library is comprehensive (18 cities, 200+ aliases)
- Deep search pipeline is the standout feature -- contributor mining from seed repos

### What Needs Fixing (Priority Order)
1. **GITHUB_TOKEN must be set** for any meaningful testing
2. **Add `type:user` filter** to GET handler to exclude organizations
3. **Use GitHubClient** in GET handler instead of raw fetch (gets rate limiting + caching for free)
4. **Unify scoring engines** -- V1 and V2 produce different scores for same profile
5. **Wire locationMatch.ts** into deep search (it already exists, just not imported)
6. **Replace internal HTTP fetch** in SSE orchestrator with direct function calls
7. **Add `api_cache` / `cron_logs` tables** to Prisma schema or document the raw pg dependency

### Architecture Recommendations
- Consolidate three GitHub API abstractions into one (GitHubClient)
- Consolidate two scoring engines into one
- Add search result caching at the API response level (not just GitHub API level)
- Consider queuing deep search as a background job instead of synchronous SSE
