# Search Optimization Plan

**Generated:** 2026-03-25
**Source Reports:** query-quality-report.md, scoring-ranking-report.md, pipeline-audit-report.md, ui-ux-report.md, performance-report.md
**Scope:** Full search pipeline from query input to rendered results

---

## 1. Current State

### Architecture

Scout searches GitHub's `/search/users` API **live** per query. Results are merged with locally-stored profiles (scored/enriched developers). The system has three search paths:

| Path | Endpoint | Speed | Quality | Used By |
|------|----------|-------|---------|---------|
| Live Search (GET) | `GET /api/search` | 0.3-1.8s | Medium | Primary search page |
| Quick Search (POST) | `POST /api/search/quick` | 1-2s | Low | SSE orchestrator |
| Deep Search (POST) | `POST /api/search/deep` | 5-15s | High | SSE orchestrator (role queries) |

**Three scoring engines** produce different scores for the same developer:

| Engine | File | Used By | Tier Labels |
|--------|------|---------|-------------|
| `quickScore()` | `src/app/api/search/route.ts:365-377` | GET live search | Elite/Strong/Solid/Emerging/Limited Data |
| `computeScore()` | `src/lib/scoring.ts` | `/api/score/[username]`, pipeline sync | Elite/Strong/Solid/Emerging/Limited Data |
| `calculateScore()` | `src/lib/scoring/engine.ts` | Deep search, cron indexer | Unicorn/On Fire/Gem/Seedling/Mystery |

**Three GitHub API abstraction layers** exist independently:

| Layer | File | Used By |
|-------|------|---------|
| Raw `fetch()` + inline headers | `src/app/api/search/route.ts` | GET handler |
| `GitHubClient` class (caching + rate limiting) | `src/lib/github/client.ts` | Quick/deep search |
| `fetchWithRetry()` (own retry logic) | `src/pipeline/github.ts` | Pipeline sync |

### What Works Well

- **NLP query parsing** correctly extracts languages, locations, roles from natural language (e.g., "React developers in New York" -> `language:javascript location:"New York"`)
- **Location alias system** maps SF/Bay Area/San Francisco identically -- 100% overlap across all three
- **Performance** averages 0.58s per query on production; all queries under 1.5s
- **Consistency** is perfect -- same query returns identical results/ordering
- **Edge cases** handled gracefully -- empty search, nonsense queries, XSS, SQL injection all return 200 OK
- **Location matching** is 100% accurate when specified (20/20 in every location query)
- **Dark theme** is comprehensive with `dark:` Tailwind variants on all components
- **Loading state** is polished with radar animation and contextual progress messages
- **Zero-results state** has actionable search tips
- **Security** is solid: `sanitizeQuery()` strips `<>`, 200-char limit, Prisma parameterized queries

---

## 2. Critical Issues

### CRIT-1: Organizations Returned as Candidate Results
- **Impact:** 8 of 15 results for "TypeScript San Francisco" are organizations (oktadev, alchemyplatform, voiceflow, skiff-org, XPRNetwork, reworkd, atlassian-labs, ViewBlock), not hireable developers
- **Root Cause:** GET handler's GitHub query does NOT include `type:user`. GitHub's `/search/users` returns both users and orgs.
- **File:** `src/app/api/search/route.ts:440-461` -- no `type:user` in query
- **Note:** Quick search (`search/quick/route.ts:28`) already includes `type:user`
- **Fix:** Add `type:user` to `buildGitHubQuery()` output

### CRIT-2: Three Scoring Engines with Conflicting Tier Labels
- **Impact:** A developer with score 65 shows "Solid" border accent (from API tier) AND "Gem" emoji/label (from `TierBadge.tsx` computed tier) on the same page
- **Files:** `src/lib/scoring.ts`, `src/lib/scoring/engine.ts`, `src/app/api/search/route.ts:365-377`, `src/components/ui/TierBadge.tsx`, `src/components/profile/ScoreBreakdown.tsx`, `src/components/profile/DeveloperCard.tsx`
- **Fix:** Consolidate to one tier naming system and one scoring entry point

### CRIT-3: GraphQL Contribution Data Returns Null/Zero for Major Developers
- **Impact:** 45% of the total score (Contribution pillar 25% + Consistency pillar 20%) depends on data that isn't being retrieved. torvalds scores 30.5/100 ("Limited Data"), sindresorhus scores 35/100 ("Limited Data"), trekhleb has `totalCommits: 0` in DB.
- **File:** `src/pipeline/graphql.ts` -- `fetchContributions()` returns null/zero
- **Fix:** Debug GraphQL query, add error logging, verify token scopes, add retry

### CRIT-4: Fake Positional Scores for Unfetched Profiles
- **Impact:** When GitHub profile fetches fail (rate limit), scores are set to `Math.max(5, 25 - positionIndex)`, creating sequential scores (23, 22, 21...) with zero correlation to quality. Same developer's score changes between searches.
- **File:** `src/app/api/search/route.ts:547-568`
- **Fix:** Mark results as "unscored" instead of assigning fake numbers; batch profile fetches with backoff

### CRIT-5: Mobile Horizontal Overflow at 375px
- **Impact:** Page body is 455px on a 375px viewport -- 80px horizontal overflow. Cards are cramped to ~135px. Filter sidebar (240px fixed) doesn't collapse on mobile.
- **File:** `src/app/search/page.tsx:190` -- sidebar uses `shrink-0 w-60`, `showFilters` defaults to `true` on all viewports
- **Fix:** Default `showFilters` to `false` on screens < `lg`; add `overflow-x-hidden` safety net

### CRIT-6: Server Degrades to Persistent 500s Under Sustained Load
- **Impact:** After ~80 queries, all searches with a query parameter return HTTP 500 with empty body. Server does not self-recover.
- **Root Cause:** Prisma `findMany` call (~line 466) is NOT wrapped in try/catch. When DB connection pool exhausts after rapid queries, unhandled rejection propagates as 500.
- **File:** `src/app/api/search/route.ts:466`
- **Fix:** Wrap Prisma calls in try/catch; add connection pool health monitoring

---

## 3. Quality Gaps

### Search Relevance

| Gap | Severity | Details |
|-----|----------|---------|
| **Language data missing for GitHub-sourced profiles** | HIGH | 11 of 13 quality issues stem from 0-5% language match. GitHub REST `/search/users` returns user metadata but NOT repo languages. Only locally-indexed profiles have `languages[]` populated. |
| **Results mix incompatible score sources** | HIGH | Sorted list combines stale local DB scores, shallow quickScores, and fabricated position scores. trekhleb (255k stars, Uber engineer) ranks below mahseema (awesome-list curator). |
| **Post-fetch re-sorting confuses users** | MEDIUM | API fetches by GitHub's chosen sort (followers, stars, joined) then re-sorts by internal score. "Sort by followers" puts highest-follower dev (trekhleb, 17.8k) last because his internal score (23.7) is lowest. |
| **Role-only queries penalized by relevance scoring** | MEDIUM | "Machine learning engineers" scores 3/10 relevance despite returning scikit-learn contributors and "Hands-On ML" author, because no location filter = no location bonus. |
| **No language enrichment on first fetch** | MEDIUM | When a GitHub user profile is fetched live, top repos are not fetched to extract primary languages. |

### Query Generation

| Gap | Severity | Details |
|-----|----------|---------|
| **No `type:user` in GET handler** | CRITICAL | Already listed above. Quick search has it; GET handler doesn't. |
| **Deep search location filter is naive** | MEDIUM | Uses basic `string.includes()` instead of the sophisticated `matchesLocation()` from `lib/search/locationMatch.ts` (18 cities, 200+ aliases). File: `search/deep/route.ts:136-148` |
| **Quick POST joins query parts with `+`** | LOW | `quick/route.ts:30` uses `parts.join("+")` instead of spaces. URL encoding masks this but it's technically incorrect. |

---

## 4. Scoring Gaps

### Structural Problems

| Issue | Severity | File | Details |
|-------|----------|------|---------|
| **quickScore ignores stars entirely** | HIGH | `route.ts:365-377` | Formula: `followerSignal * 0.45 + repoSignal * 0.30 + ratioBonus + profileBonus`. Stars, forks, commits, language match, activity all have 0% weight. An org with 0 stars but 2k followers and 500 repos scores ~63. |
| **Contribution pillar penalizes maintainers** | HIGH | `scoring.ts:87-108` | External merged PRs = 70% of Contribution (17.5% of final score). Project owners/maintainers don't submit external PRs; they receive them. Anti-correlates with being influential. |
| **Follower scale caps at 10k** | HIGH | `scoring.ts:184-185` | torvalds (293k followers) and someone with 10,001 followers get identical reputation scores. No differentiation in top 0.01%. |
| **Confidence modifier hard-caps scores** | MEDIUM | `scoring.ts:211-228` | Low confidence (< 5 repos OR < 50 contributions) applies 0.75 multiplier, capping max at 75. torvalds (11 public repos) is permanently capped despite being the most impactful developer alive. |
| **Per-repo star cap too aggressive** | MEDIUM | `scoring.ts:63-71` | Max single repo contribution = 4/10. A 500-star repo scores 3, a 449k-star repo (sindresorhus/awesome) scores 4. Only 1 point difference for 900x the stars. |
| **Impact pillar underscores viral repos** | MEDIUM | `scoring.ts:63-71` | Tiered scoring gives 6 points for 10k+ stars but caps individual repo at 4. Top 3 repos determine 70% of impact, but each is capped. |

### Score Accuracy Audit (5 Developers)

| Developer | Scout Score | Expected | Verdict |
|-----------|---------------|----------|---------|
| trekhleb (255k stars, Uber, 17.8k followers) | 23.7 | 80+ | WILDLY INACCURATE -- `totalCommits: 0` in DB |
| mahseema (awesome-list curator, 6.3k followers, 10.9k following) | 56 | 30-40 | OVERSCORED -- not a TS dev, follow-for-follow ratio |
| alxhub (Angular team lead @ Google, 76 repos) | 55.3 | 70+ | UNDERSCORED -- core Angular contributor |
| scttcper (Sentry engineer, ngx-toastr, 327 followers) | 52.7 | 55-60 | REASONABLE but understated |
| torvalds (creator of Linux + Git, 293k followers) | 30.5 | 95+ | ABSURDLY INACCURATE -- scores below mahseema |

---

## 5. UI Gaps

| Issue | Severity | File | Details |
|-------|----------|------|---------|
| **Mobile horizontal overflow** | CRITICAL | `src/app/search/page.tsx:190` | Already listed. 80px overflow at 375px. |
| **No retry button on error state** | HIGH | `src/app/search/page.tsx:300-304` | Error banner shows "Search failed" with no retry action. User must manually re-trigger. |
| **Save button invisible to unauthenticated users** | HIGH | `src/components/auth/FavoriteButton.tsx` | No affordance at all for logged-out users. No disabled heart, no "sign in to save" tooltip. Missed engagement opportunity. |
| **Location filter Enter may submit main form** | HIGH | `src/app/search/page.tsx:244-250` | Typing in location filter and pressing Enter appears to replace the main search query rather than adding a location filter param. |
| **Tier label collision on same page** | HIGH | Multiple | DeveloperCard border says "Solid", TierBadge emoji says "Gem" for score 65. Two tier naming systems render side-by-side. |
| **Empty state has no CTA** | MEDIUM | `src/app/search/page.tsx` | Results area is completely blank when no query entered. No illustration, no prompt. |
| **Filter sidebar visible AND toggle button at 768px** | MEDIUM | `src/app/search/page.tsx:286-291` | Toggle button is `lg:hidden` but sidebar is always visible. Redundant UI at tablet. |
| **No dark mode toggle** | MEDIUM | Global | Dark mode only via `prefers-color-scheme`. No manual override. |
| **"Score" sort misleading** | MEDIUM | Search page | Defaults to GitHub `followers` API sort, then client-side re-ranks by app score. Users expect server-side score ranking. |
| **Error text too generic** | LOW | `src/app/search/page.tsx` | "Search failed" doesn't distinguish rate limits, network errors, or server errors. |
| **No loading skeleton** | LOW | Search page | Radar animation is engaging but doesn't prepare users for card layout. |

---

## 6. Performance Issues

| Issue | Severity | File | Details |
|-------|----------|------|---------|
| **Server degrades to 500 under load** | CRITICAL | `src/app/api/search/route.ts:466` | Already listed. Unhandled Prisma exception after ~80 queries. |
| **Memory growth 4.5x under load** | HIGH | Server process | RSS grew from ~54 MB to ~244 MB (+190 MB) during ~100 queries. Possible retained references, unclosed connections, or V8 heap expansion. |
| **GET handler has zero rate limit awareness** | HIGH | `src/app/api/search/route.ts` | Fires 20+ parallel profile fetches without checking GitHub API budget. GitHubClient has rate tracking; GET handler uses raw `fetch()` instead. |
| **SSE orchestrator has no timeout** | HIGH | `src/app/api/search/route.ts:10-55` | Internal HTTP fetch to `/api/search/deep` has no AbortController. Confirmed 334s hang. On Vercel Hobby (60s timeout), deep search via SSE always fails. |
| **No application-level response cache** | MEDIUM | GET handler | All caching is incidental (GitHub CDN, TCP reuse). A simple in-memory LRU with TTL would provide the observed 4.8x speedup consistently. |
| **Cold start penalty** | LOW | First query | First call: 1.76s. Subsequent: 0.27-0.34s. GitHub conditional caching helps but first call is slow due to 20 parallel profile fetches. |
| **Silent rate limit swallowing** | MEDIUM | `src/app/api/search/route.ts:450-461` | When GitHub returns 403, error handler silently returns 0 results. User gets no feedback. |

---

## 7. Implementation Checklist: Built vs Missing

### Search Pipeline

| Feature | Status | Notes |
|---------|--------|-------|
| Live GitHub user search (GET) | BUILT | Works but no `type:user`, no rate limit awareness |
| Quick search (POST) | BUILT | Has `type:user`, uses GitHubClient with caching |
| Deep search (POST) | BUILT | Seed repo mining + GraphQL + 5-pillar scoring |
| SSE streaming orchestrator | BUILT | No timeout on internal fetches; breaks on Vercel 60s |
| NLP query parsing | BUILT | Extracts language, location, role from natural language |
| Location aliases | BUILT | SF/NYC/LA/PNW/Bay Area mapped correctly |
| `type:user` filter on GET | **MISSING** | Quick search has it; GET handler does not |
| Search timeout / AbortController | **MISSING** | Referenced but not wired in GET or SSE handler |
| Result deduplication (quick + deep) | **MISSING** | Same user could appear from both paths in SSE |
| Pagination for deep search | **MISSING** | Always returns single batch |
| Search history / analytics | **MISSING** | No tracking of search queries |
| Full-text search on local DB | **MISSING** | Local DB only matches by `githubId` |
| Retry button on error state | **MISSING** | "Search failed" with no action |
| Rate limit feedback to user | **MISSING** | 0 results returned silently on 403 |
| Health check endpoint | **MISSING** | No `/api/health` for monitoring |

### Scoring

| Feature | Status | Notes |
|---------|--------|-------|
| 5-pillar scoring (V1) | BUILT | Impact/Contribution/Consistency/Technical/Reputation |
| 5-pillar scoring (V2) | BUILT | Enhanced with seed repos, notable orgs, confidence |
| Quick score (REST-only) | BUILT | Shallow: followers + repos only. No stars, commits, activity. |
| GraphQL contribution fetch | BUILT (BROKEN) | Returns null/zero for major developers |
| Stars in quickScore | **MISSING** | 0% weight in live search scoring |
| Maintainer signal | **MISSING** | No "received PRs" or "external contributors" signal |
| Follower scale above 10k | **MISSING** | Caps at [10000, 10] |
| Unified tier labels | **MISSING** | Two naming systems coexist |
| Language match boost | **MISSING** | No scoring bonus for matching searched language |

### Caching & Data

| Feature | Status | Notes |
|---------|--------|-------|
| Supabase API cache (GitHubClient) | BUILT | `api_cache` table with TTL. NOT in Prisma schema. |
| Cron stale re-sync | BUILT | Daily 3am UTC, 7-day threshold, 50/run |
| Cron pre-indexing | BUILT | Daily 4am UTC, mines seed repo contributors |
| `api_cache` in Prisma schema | **MISSING** | Uses raw `pg` Client outside Prisma |
| `cron_logs` in Prisma schema | **MISSING** | Uses raw `pg` Client outside Prisma |
| Application-level response cache | **MISSING** | No in-memory LRU for search results |
| Language enrichment on first fetch | **MISSING** | Live-fetched profiles have no language data |

### UI/UX

| Feature | Status | Notes |
|---------|--------|-------|
| Search page with filters | BUILT | Language pills, location, min stars, hireable, sort |
| Developer cards with score/tier | BUILT | 15 fields, tier-colored border, hover states |
| Loading state (radar animation) | BUILT | Polished with contextual messages |
| Zero-results state with tips | BUILT | SearchX icon + 3 actionable tips |
| Error state banner | BUILT | Red banner, but no retry button |
| Dark theme (system) | BUILT | Comprehensive `dark:` variants on all components |
| Pagination | BUILT | Previous/Next + page indicator |
| Cmd+K keyboard shortcut | BUILT | `hidden sm:inline-flex` (hidden on mobile) |
| URL-synced filters | BUILT | Query, sort, languages, hireable in URL params |
| Mobile responsive layout | **BROKEN** | 80px horizontal overflow at 375px |
| Save button for unauthenticated | **MISSING** | No affordance at all |
| Dark mode manual toggle | **MISSING** | System preference only |
| Retry button on error | **MISSING** | Must manually re-search |
| Empty state CTA/illustration | **MISSING** | Blank space when no query |
| Loading skeletons | **MISSING** | Radar animation only |
| Email availability indicator in results | **MISSING** | Email rates vary 0-65% but not surfaced |

---

## 8. Optimization Roadmap

### Phase 1: Critical Fixes (Week 1)

| # | Task | File(s) | Complexity | Impact |
|---|------|---------|------------|--------|
| 1.1 | Add `type:user` to GET handler's `buildGitHubQuery()` | `src/app/api/search/route.ts:299-361` | **Trivial** -- append ` type:user` to query string | Eliminates 8/15 bad results (orgs) |
| 1.2 | Wrap Prisma calls in try/catch in GET handler | `src/app/api/search/route.ts:466` | **Low** -- add try/catch + error response | Prevents cascading 500s under load |
| 1.3 | Fix mobile sidebar collapse | `src/app/search/page.tsx:190` | **Low** -- default `showFilters` to `false` on `< lg`, add `overflow-x-hidden` | Fixes 375px horizontal overflow |
| 1.4 | Remove fake positional scores | `src/app/api/search/route.ts:547-568` | **Low** -- replace `25 - index` with `score: 0` + `tier: "Unscored"` badge | Stops displaying fabricated scores |
| 1.5 | Unify tier labels to one system | `src/lib/scoring.ts`, `src/lib/scoring/engine.ts`, `src/components/ui/TierBadge.tsx`, `src/components/profile/ScoreBreakdown.tsx`, `src/components/profile/DeveloperCard.tsx` | **Medium** -- pick one label set, update 5 files | Eliminates "Solid" vs "Gem" collision |
| 1.6 | Surface rate limit warnings to user | `src/app/api/search/route.ts:450-461` | **Low** -- add `warning` field to response when GitHub returns 403 | Users understand why 0 results returned |

### Phase 2: Scoring Accuracy (Week 2)

| # | Task | File(s) | Complexity | Impact |
|---|------|---------|------------|--------|
| 2.1 | Debug and fix GraphQL `fetchContributions()` | `src/pipeline/graphql.ts` | **Medium** -- add error logging, verify token scopes, add retry | Recovers 45% of scoring signal |
| 2.2 | Add stars to `quickScore()` | `src/app/api/search/route.ts:365-377` | **Low** -- add `starSignal` from fetched user's top repos or total stars | Major quality improvement for live search ranking |
| 2.3 | Extend follower tier scale beyond 10k | `src/lib/scoring.ts:184-185` | **Low** -- add tiers: `[50000, 10]`, `[100000, 10]` or use continuous log scale | Differentiates top 0.01% developers |
| 2.4 | Soften confidence modifier | `src/lib/scoring.ts:211-228` | **Low** -- change low confidence from 0.75 to 0.85, or apply only to null-data pillars | Uncaps scores for devs with few public repos |
| 2.5 | Raise per-repo star cap | `src/lib/scoring.ts:63-71` | **Low** -- increase `maxSingleRepoContribution` from 4 to 6, or use `Math.sqrt()` curve | Better recognition of viral repos |
| 2.6 | Add maintainer signal to Contribution pillar | `src/lib/scoring.ts:87-108` | **Medium** -- add "maintained repos with external contributors" or "received PR count" as balancing signal | Fixes systematic penalty on project maintainers |
| 2.7 | Consolidate V1 + V2 scoring engines | `src/lib/scoring.ts`, `src/lib/scoring/engine.ts` | **High** -- merge into single engine, update all consumers | Eliminates score divergence for same developer |

### Phase 3: Search Quality (Week 3)

| # | Task | File(s) | Complexity | Impact |
|---|------|---------|------------|--------|
| 3.1 | Enrich language data on first fetch | `src/app/api/search/route.ts` (profile fetch loop) | **Medium** -- for each fetched profile, also fetch top 3-5 repos via `/users/{login}/repos?sort=stars&per_page=5` to extract languages | Populates `languages[]` for live results |
| 3.2 | Use `GitHubClient` in GET handler instead of raw fetch | `src/app/api/search/route.ts` | **Medium** -- replace inline `fetch()` + headers with `GitHubClient` instance | Gets rate limiting + Supabase caching for free |
| 3.3 | Wire `matchesLocation()` into deep search | `src/app/api/search/deep/route.ts:136-148` | **Low** -- import and use `matchesLocation()` from `src/lib/search/locationMatch.ts` | Better location filtering in deep search |
| 3.4 | Don't re-sort when user explicitly chooses a sort | `src/app/api/search/route.ts:577` | **Low** -- if `sort` param is `followers`/`stars`/`joined`, preserve GitHub's order | "Sort by followers" actually sorts by followers |
| 3.5 | Add result deduplication in SSE flow | `src/app/api/search/route.ts` (POST handler) | **Low** -- track seen usernames, skip duplicates in deep results | Prevents duplicate cards |

### Phase 4: UI Polish (Week 3-4)

| # | Task | File(s) | Complexity | Impact |
|---|------|---------|------------|--------|
| 4.1 | Add retry button to error state | `src/app/search/page.tsx:300-304` | **Low** -- add button that re-calls `doSearch()` | Users can retry without manual re-submission |
| 4.2 | Show disabled save button for unauthenticated users | `src/components/auth/FavoriteButton.tsx` | **Low** -- render disabled heart with "Sign in to save" tooltip when no session | Engagement opportunity for logged-out users |
| 4.3 | Add empty state CTA | `src/app/search/page.tsx` | **Low** -- add illustration or prompt when no query entered | Guides users to start searching |
| 4.4 | Fix filter sidebar at tablet (768px) | `src/app/search/page.tsx:286-291` | **Low** -- hide sidebar by default below `lg`, show only via toggle | Removes redundant toggle + sidebar |
| 4.5 | Improve error messages with specificity | `src/app/search/page.tsx` | **Low** -- parse error response for rate limit vs network vs server error | "GitHub API rate limited" vs generic "Search failed" |
| 4.6 | Add email availability indicator to result cards | `src/components/profile/DeveloperCard.tsx` | **Trivial** -- already partially implemented (purple badge exists) | Helps recruiters prioritize enrichment |

### Phase 5: Performance & Reliability (Week 4)

| # | Task | File(s) | Complexity | Impact |
|---|------|---------|------------|--------|
| 5.1 | Add AbortController timeout to SSE internal fetches | `src/app/api/search/route.ts:10-55` | **Low** -- add 50s AbortController to deep search fetch | Prevents 334s hangs; fits Vercel 60s limit |
| 5.2 | Add application-level response cache | `src/app/api/search/route.ts` | **Medium** -- in-memory `Map` with TTL for search result JSON | 4.8x speedup for repeat queries |
| 5.3 | Investigate memory growth | Server | **Medium** -- soak test with `--expose-gc` and heap snapshots | Determine if +190 MB growth is a leak |
| 5.4 | Add rate limit tracking to GET handler | `src/app/api/search/route.ts` | **Medium** -- track `x-ratelimit-remaining` from GitHub responses, throttle when low | Prevents 20+ blind parallel fetches |
| 5.5 | Add `/api/health` endpoint | New: `src/app/api/health/route.ts` | **Low** -- check GitHub rate limit remaining + Prisma `$queryRaw('SELECT 1')` | Detect degraded state before users hit it |
| 5.6 | Add `api_cache` and `cron_logs` to Prisma schema | `prisma/schema.prisma` | **Medium** -- model both tables, migrate from raw `pg` Client | Eliminates raw SQL outside Prisma |
| 5.7 | Replace SSE internal HTTP fetch with direct function calls | `src/app/api/search/route.ts` (POST handler) | **High** -- extract quick/deep logic into importable functions, call directly | Eliminates fragile self-fetch in serverless |

### Phase 6: Architecture (Future)

| # | Task | Complexity | Impact |
|---|------|------------|--------|
| 6.1 | Consolidate three GitHub API abstractions into `GitHubClient` | **High** | Single source of truth for auth, rate limiting, caching, retry |
| 6.2 | Queue deep search as background job instead of synchronous SSE | **High** | Fits Vercel 60s limit; enables longer enrichment pipelines |
| 6.3 | Add search result caching at API response level | **Medium** | Dramatically reduces GitHub API consumption |
| 6.4 | Pre-enrich ML ecosystem profiles | **Low** | Reduce 1.36s latency for ML queries (slowest query type) |
| 6.5 | Add full-text search on local DB (name, bio, skills) | **Medium** | Enables searching stored/enriched profiles without hitting GitHub |

---

## Summary: Priority Matrix

| Priority | Count | Examples |
|----------|-------|---------|
| **P0 (Critical, fix now)** | 6 | `type:user` filter, fake scores, mobile overflow, server 500, tier collision, Prisma error handling |
| **P1 (High, this sprint)** | 7 | GraphQL fix, stars in quickScore, follower scale, rate limit feedback, maintainer signal, SSE timeout, GitHubClient migration |
| **P2 (Medium, next sprint)** | 10 | Language enrichment, confidence modifier, star cap, retry button, empty state CTA, response cache, health endpoint, deduplication |
| **P3 (Low, backlog)** | 5 | Dark mode toggle, loading skeletons, error specificity, background job queue, full-text local search |

**Estimated total effort:** ~3-4 weeks for P0+P1+P2 with a single engineer. P0 alone is achievable in 2-3 days.
