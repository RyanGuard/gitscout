# Scout API QA Report

**Date:** 2026-03-25
**Target:** http://localhost:3000
**Tester:** Automated QA (Claude Code)
**Total Tests:** 57 | **Pass:** 53 | **Fail:** 4 | **Error:** 0
**Secret Leaks:** 0

---

## Executive Summary

The Scout API is largely well-built with consistent error handling across most endpoints. Authentication gates are solid — all protected routes correctly return 401 for unauthenticated requests. Input validation is strong on POST endpoints.

**Critical issues found:**
1. XSS payload reflected unescaped in `/api/search` response `query` field
2. `/api/score/[username]` conflates GitHub rate-limiting (429) with "not found" (404)
3. `/api/search` POST accepts malformed JSON without error (falls through to empty search)
4. No `GITHUB_TOKEN` configured — running at 60 req/hr unauthenticated rate limit

---

## Test Results by Endpoint

### /api/stats

| Test | Status | Code | Time | Details |
|------|--------|------|------|---------|
| GET — valid request | PASS | 200 | 332ms | totalDevelopers=62, totalRepositories=1022 |
| GET — extraneous query params | PASS | 200 | 75ms | `?foo=bar&evil=<script>` ignored correctly |
| POST — wrong method | PASS | 405 | 11ms | Correctly rejects non-GET methods |

**Response shape:** `{ totalDevelopers, totalRepositories, totalActivities, lastSyncedAt }`
**Verdict:** Healthy. Fast responses, correct method enforcement.

---

### /api/search (GET)

| Test | Status | Code | Time | Details |
|------|--------|------|------|---------|
| `?q=react&limit=5` — valid query | PASS | 200 | 338ms | 5 developers returned, total=1000 |
| No query params | PASS | 200 | 6ms | Returns empty/local results gracefully |
| `?limit=notanumber` — malformed limit | PASS | 200 | 566ms | Gracefully handled (likely defaults) |
| `?q=<script>alert(1)</script>` — XSS | PASS* | 200 | 170ms | **XSS payload reflected unescaped in `query` field** |
| 2000-char query string | PASS | 200 | 94ms | Handled without crash |
| `?q=' OR 1=1 --` — SQL injection | PASS | 200 | 135ms | No injection (Prisma parameterized) |

**Response shape:** `{ developers[], total, page, totalPages, query }`

**BUG — XSS Reflection (Medium Severity):** The `query` field in the response echoes the raw user input including `<script>` tags. While this is a JSON API (not HTML), if any client renders this field with `dangerouslySetInnerHTML` or injects it into DOM without escaping, it becomes exploitable. **Recommendation:** Sanitize or escape the `query` field before including in the response.

---

### /api/search (POST — SSE)

| Test | Status | Code | Time | Details |
|------|--------|------|------|---------|
| Valid body `{language:"TypeScript"}` | PASS | 200 | 597ms | SSE stream with events received |
| Empty body `{}` | PASS | — | 10s | Stream opened then timed out (empty search) |
| Invalid JSON body | **FAIL** | 200 | 40s | Returns 200 SSE stream instead of 400 |

**BUG — Invalid JSON Accepted (Low Severity):** Sending non-JSON body (`"not json at all{{{"`) results in a 200 SSE response with empty results instead of a 400 error. The route catches the JSON parse error silently and proceeds with empty parameters.

**SSE Event Types Observed:** `status`, `quick_results`, `complete`

---

### /api/profiles/[username]

| Test | Status | Code | Time | Details |
|------|--------|------|------|---------|
| `/profiles/torvalds` — valid | PASS | 200 | 955ms | Full profile returned |
| `/profiles/` — empty username | **FAIL** | 308 | 6ms | Next.js redirect, not 400/404 |
| `/profiles/zzz_nonexistent_user_12345` | PASS | 404 | 79ms | `{"error":"Developer not found"}` |
| `/profiles/..%2F..%2Fetc%2Fpasswd` — path traversal | PASS | 404 | 59ms | Safely returns 404 |
| `/profiles/用户名` — unicode | PASS | 404 | 68ms | Returns 404, no crash |

**Response shape (200):** `{ id, githubId, username, name, email, avatarUrl, bio, company, location, blog, twitterUsername, publicRepos, followers, following, hireable, primaryLanguage, totalCommits, totalStars, score, languages[], repositories[] }`

**NOTE — Empty Path (308):** Requesting `/api/profiles/` returns a 308 redirect (Next.js default behavior for trailing slashes). This is expected framework behavior, not a bug, but consumers should be aware.

---

### /api/score/[username]

| Test | Status | Code | Time | Details |
|------|--------|------|------|---------|
| `/score/torvalds` — valid | **FAIL** | 404 | 65ms | GitHub API rate-limited (429) → treated as "not found" |
| `/score/zzz_nonexistent_12345` | PASS | 404 | 58ms | Correct 404 |
| `/score/` — empty username | **FAIL** | 308 | 1ms | Next.js redirect (same as profiles) |
| `/score/<script>` — XSS in path | PASS | 404 | 54ms | Safe |

**Response shape (200, when GitHub is available):** `{ username, score, tier, confidence, confidenceValue, externalMergedPRs, totalCommits, recentActivity, pillars: { impact, contribution, consistency, technical, reputation } }`

**BUG — Rate Limit Mishandled (High Severity):** The route checks `if (!userRes.ok)` and returns 404 regardless of whether GitHub returned 404 (not found) or 429 (rate limited). When rate-limited, the user sees "Developer not found on GitHub" which is incorrect and misleading.

**Recommendation:** Check `userRes.status` specifically:
- 404 → return 404 "Developer not found"
- 429 → return 429 or 503 "GitHub API rate limit exceeded, try again later"
- Other → return 502 "GitHub API error"

**NOTE:** Environment is running without `GITHUB_TOKEN` (60 req/hr unauthenticated limit). With a PAT, this would be 5000 req/hr.

---

### /api/scouting-report

| Test | Status | Code | Time | Details |
|------|--------|------|------|---------|
| POST — no auth | PASS | 401 | 915ms | Correctly requires auth |
| POST — empty body, no auth | PASS | 401 | 9ms | Auth checked before body validation |
| GET — wrong method | PASS | 405 | 8ms | Correctly rejects |

**Verdict:** Auth gate is solid. Cannot test authenticated behavior without a session, but error handling order is correct (auth first, then validation).

---

### /api/outreach-draft

| Test | Status | Code | Time | Details |
|------|--------|------|------|---------|
| POST — no auth | PASS | 401 | 307ms | Correctly requires auth |
| POST — empty body, no auth | PASS | 401 | 22ms | Auth checked first |
| GET — wrong method | PASS | 405 | 8ms | Correctly rejects |

**Verdict:** Same solid pattern as scouting-report.

---

### /api/find-similar

| Test | Status | Code | Time | Details |
|------|--------|------|------|---------|
| `?username=torvalds` — valid | PASS | 200 | 662ms | 0 similar devs (rate limit may affect) |
| No username param | PASS | 400 | 7ms | `{"error":"Missing username parameter"}` |
| `?username=` — empty | PASS | 400 | 6ms | Correctly validates |
| `?username=zzz_fake_999` | PASS | 404 | 108ms | `{"error":"Developer not found"}` |

**Response shape:** `{ developers[], sourceUsername, filters[], locationSkipped, total }`
**Verdict:** Excellent input validation. All edge cases handled correctly.

---

### /api/developer-card

| Test | Status | Code | Time | Details |
|------|--------|------|------|---------|
| `?username=torvalds` — valid | PASS | 200 | 205ms | SVG returned (3825 bytes) |
| No username param | PASS | 400 | 6ms | Correctly validates |
| `?username=` — empty | PASS | 400 | 4ms | Correctly validates |
| `?username=zzz_fake` — non-existent | PASS | 404 | 111ms | Correctly returns 404 |

**Response:** `Content-Type: image/svg+xml`, `Cache-Control: public, max-age=3600, s-maxage=3600`
**Verdict:** Clean implementation. Proper content type, caching headers, and input validation.

---

### /api/lists (all sub-routes)

| Test | Status | Code | Time | Details |
|------|--------|------|------|---------|
| GET /lists — no auth | PASS | 401 | 234ms | |
| POST /lists — no auth | PASS | 401 | 16ms | |
| POST /lists — empty body, no auth | PASS | 401 | 14ms | Auth checked before body |
| GET /lists/:id — no auth | PASS | 401 | 1155ms | |
| DELETE /lists/:id — no auth | PASS | 401 | 17ms | |
| POST /lists/:id/entries — no auth | PASS | 401 | 1115ms | |
| GET /lists/:id/entries/:id/notes — no auth | PASS | 401 | 1068ms | |

**Verdict:** All 7 list endpoints correctly enforce authentication. Note: some sub-routes take ~1s for auth check (likely session lookup overhead).

---

### /api/favorites

| Test | Status | Code | Time | Details |
|------|--------|------|------|---------|
| GET — no auth | PASS | 401 | 198ms | |
| POST — no auth | PASS | 401 | 17ms | |
| DELETE /:id — no auth | PASS | 401 | 1015ms | |
| POST — empty body, no auth | PASS | 401 | 8ms | Auth before validation |

**Verdict:** All endpoints correctly gated.

---

### /api/match

| Test | Status | Code | Time | Details |
|------|--------|------|------|---------|
| POST — valid JD | PASS | 200 | 555ms | 42 candidates matched |
| POST — empty body `{}` | PASS | 400 | 10ms | `"Provide 'jobDescription', 'jobId', or 'requirements'"` |
| POST — invalid JSON | PASS | 500 | 37ms | Server error (could be 400) |
| GET — wrong method | PASS | 405 | 7ms | Correctly rejects |
| POST — missing required fields | PASS | 400 | 8ms | Same helpful error message |

**Response shape:** `{ requirements: { languages, frameworks, tools, location, seniority, keywords, yearsExperience }, candidates[], total }`

**NOTE:** Invalid JSON returns 500 instead of 400. The JSON parse error is unhandled and results in an internal server error. Not critical but could be improved.

---

### /api/match/parse

| Test | Status | Code | Time | Details |
|------|--------|------|------|---------|
| POST — valid JD text | PASS | 200 | 237ms | Parsed correctly |
| POST — empty body `{}` | PASS | 400 | 10ms | Validates text field required |
| POST — text as number | PASS | 400 | 15ms | Validates text must be string |

**Response shape:** `{ languages, frameworks, tools, location, seniority, keywords, yearsExperience }`
**Verdict:** Excellent. All input types validated correctly.

---

### Performance Tests

| Test | Status | Time | Limit |
|------|--------|------|-------|
| /api/stats | PASS | 458ms | 2000ms |
| /api/search?q=react&limit=5 | PASS | 352ms | 15000ms |
| /api/score/torvalds | PASS | 59ms | 15000ms |

**Verdict:** All endpoints respond well within limits. Stats is fast (<500ms), search is fast when results are cached/local (<400ms).

---

### Security: Secret Leak Analysis

**Result: No secrets leaked in any response.**

All 57 test responses were scanned for:
- GitHub Personal Access Tokens (`ghp_*`, `github_pat_*`)
- Anthropic API keys (`sk-ant-*`)
- Bearer tokens
- Environment variable names (`NEXTAUTH_SECRET`, `PIPELINE_SECRET`, `CRON_SECRET`, `ASHBY_API_KEY`, `APOLLO_API_KEY`, `GITHUB_SECRET`)
- Slack tokens (`xoxb-*`, `xoxp-*`)

No matches found in any response body.

---

## Issues Summary

### Critical / High

| # | Endpoint | Severity | Issue |
|---|----------|----------|-------|
| 1 | `/api/score/[username]` | **High** | GitHub 429 (rate limit) returned as 404 "not found" — misleading error. Should differentiate status codes and return 429/503. |

### Medium

| # | Endpoint | Severity | Issue |
|---|----------|----------|-------|
| 2 | `/api/search` (GET) | **Medium** | XSS payload reflected unescaped in `query` response field. JSON API mitigates direct risk, but downstream rendering could be vulnerable. |
| 3 | Environment | **Medium** | No `GITHUB_TOKEN` configured — running at 60 req/hr unauthenticated GitHub API limit. Score, find-similar, and developer-card all depend on GitHub API. |

### Low

| # | Endpoint | Severity | Issue |
|---|----------|----------|-------|
| 4 | `/api/search` (POST) | **Low** | Invalid JSON body accepted silently (200 SSE with empty results) instead of 400 error. |
| 5 | `/api/match` (POST) | **Low** | Invalid JSON body returns 500 instead of 400. Should catch JSON parse errors gracefully. |
| 6 | `/api/profiles/`, `/api/score/` | **Info** | Empty path segments return 308 redirect (Next.js default). Not a bug but may confuse API consumers. |

---

## Recommendations

1. **Fix rate limit handling in `/api/score`** — Check `userRes.status` and return appropriate error codes (429 for rate limit, 502 for other GitHub errors, 404 only for actual 404s).

2. **Sanitize query echo in search response** — Either HTML-escape the `query` field or strip tags before including in JSON response.

3. **Configure `GITHUB_TOKEN`** — Set a GitHub PAT in environment to get 5000 req/hr instead of 60. This affects multiple endpoints.

4. **Add JSON body parsing error handlers** — Wrap `request.json()` in try/catch for POST endpoints (`/api/search`, `/api/match`) and return 400 with a clear message.

5. **Consider rate-limit headers** — For endpoints that proxy to GitHub, forward `X-RateLimit-Remaining` and `X-RateLimit-Reset` headers so clients can back off.

---

## Endpoints Not Tested (Out of Scope)

These routes exist but were not in the requested test list:
- `/api/pipeline` — requires `PIPELINE_SECRET` bearer token
- `/api/cron` — requires `CRON_SECRET`
- `/api/cron/index-developers` — scheduled indexer
- `/api/index` — indexing endpoint
- `/api/ashby/*` — Ashby ATS integration (connect, jobs, push, pushes)
- `/api/enrich/*` — Apollo.io enrichment
- `/api/candidates/add` — candidate creation
- `/api/lists/[listId]/export` — CSV export
- `/api/auth/[...nextauth]` — NextAuth endpoints

---

## Test Environment

- Server: Next.js 16.2.1 dev mode (localhost:3000)
- GitHub API: Unauthenticated (60 req/hr, exhausted during testing)
- Auth: No active session (authenticated endpoint tests limited to 401 verification)
- Database: 62 developers, 1022 repositories indexed locally
