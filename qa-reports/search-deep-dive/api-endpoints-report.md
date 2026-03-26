# GitScout API Endpoints — QA Report

**Date:** 2026-03-26
**Environment:** http://localhost:3000 (development)
**Tester:** Automated QA via curl
**Branch:** main (commit 809f4fa)

---

## Summary

| Category | Pass | Fail | Warn | Blocked | Total |
|----------|------|------|------|---------|-------|
| Search   | 4    | 1    | 1    | 0       | 6     |
| Profile  | 0    | 2    | 0    | 0       | 2     |
| Score    | 0    | 0    | 0    | 1       | 1     |
| Enrichment | 1 | 1    | 0    | 0       | 2     |
| Stats    | 0    | 1    | 0    | 0       | 1     |
| Market Map | 2  | 0    | 0    | 0       | 2     |
| Apollo   | 0    | 1    | 0    | 0       | 1     |
| Auth     | 2    | 0    | 0    | 0       | 2     |
| Pipeline | 0    | 2    | 0    | 0       | 2     |
| **Total** | **9** | **8** | **1** | **1** | **20** |

**Overall: 9 PASS / 8 FAIL / 1 WARN / 1 BLOCKED (rate limit)**

---

## Critical Issues (P0)

1. **`GET /api/profiles/[username]` returns 500 with empty body** — Both valid (`torvalds`) and invalid usernames return 500 instead of proper responses. The response body is completely empty. This breaks the core profile viewing functionality.

2. **`GET /api/stats` returns 500 with empty body** — Dashboard stats endpoint is broken. Empty response body gives no indication of the error cause.

3. **`POST /api/pipeline` does NOT check authentication** — Sending requests with no auth header or a wrong `Authorization: Bearer` header returns 400 (body validation) instead of 401. Auth check is either missing or runs after body validation. When valid body is provided with a wrong secret, a 500 DB pool error occurs (`MaxClientsInSessionMode`), suggesting the request proceeds to DB access without auth verification.

4. **`POST /api/search/deep` hangs indefinitely** — The endpoint accepts the connection but never responds. No HTTP status code is returned. This will hit Vercel's 60s timeout in production and waste server resources.

---

## High Issues (P1)

5. **`GET /api/enrich/compensation` returns 404 for all users** — Tested with `torvalds`, `karpathy`, and `mitsuhiko` (confirmed local DB users). All return `{"error":"User not found"}` with 404. The endpoint appears non-functional.

6. **`GET /api/apollo/company-search` returns 502** — Searching for "stripe" returns `{"error":"Apollo returned 422"}`. The Apollo.io integration is returning an unprocessable entity error, suggesting malformed API requests or invalid API key configuration.

7. **Database connection pool exhaustion** — The pipeline endpoint surfaced `MaxClientsInSessionMode: max clients reached` error, indicating the Supabase session pooler connection limit is being hit. This could affect all DB-dependent endpoints under load.

---

## Detailed Test Results

### SEARCH APIs

#### Test 1: `GET /api/search?q=python` — PASS
- **Status:** 200 OK
- **Time:** 1.385s
- **Response shape:** `{ developers: [...], total: 1000, page: 1, totalPages: 50, query: "python" }`
- **Developers count:** 20 per page
- **Notes:** Shape matches spec exactly. First result is karpathy (local, score 64.2). Mix of `source: "local"` and `source: "github"`. Local developers include languages[] and repositories[]; GitHub-only developers have empty arrays. Total capped at 1000 (GitHub API limit).

#### Test 2: `GET /api/search?q=typescript+san+francisco` — PASS
- **Status:** 200 OK
- **Time:** 0.406s
- **Response shape:** Correct `{ developers, total, page, totalPages, query }`
- **Location parsing:** Working. Results filtered to San Francisco area. Query parsed as `"typescript san francisco"`. 191 total results. Top results include local profiles (trekhleb at SF Bay Area, mahseema at SF) and GitHub users at SF locations.
- **Notes:** Faster than Test 1, likely due to smaller result set.

#### Test 3: `GET /api/search?q=frontend+engineer` — PASS
- **Status:** 200 OK
- **Time:** 0.464s
- **Response shape:** Correct
- **Role detection:** Working. Results are developers with "frontend" in bio/title. Top results include "Web Frontend Architect", "Staff Frontend Engineer", "Senior Frontend Developer". 1000 total results.
- **Notes:** Query string preserved as `"frontend engineer"`.

#### Test 4: `GET /api/search` (no params) — PASS
- **Status:** 200 OK
- **Time:** 0.007s (near-instant)
- **Response:** `{ developers: [], total: 0, page: 1, totalPages: 0, query: "" }`
- **Notes:** Returns empty results gracefully, not an error. Correct behavior.

#### Test 5: `GET /api/search?q=<script>alert(1)</script>` — PASS
- **Status:** 200 OK
- **Time:** 0.161s
- **Response query field:** `"scriptalert(1)/script"` — HTML tags stripped
- **Notes:** XSS attempt is sanitized. The `<` and `>` characters and tag names are stripped from the query. Returns empty results (no matches). No script injection in response.

#### Test 6: `POST /api/search/quick` — WARN
- **Status:** 200 OK
- **Time:** 0.351s
- **Response:** `{ total_count: 0, developers: [] }`
- **Shape concern:** Different shape from `/api/search`. Uses `total_count` instead of `total`, missing `page`, `totalPages`, `query` fields. Inconsistent API contract.
- **Empty results:** Returned 0 developers for `{language:"go", minFollowers:100}`. Also returned 0 for `{language:"python", minFollowers:10}`. May be a GitHub API rate limit issue or the endpoint may not be constructing the search query correctly.

#### Test 7: `POST /api/search/deep` — FAIL
- **Status:** No response (connection hangs)
- **Time:** Exceeded 60s timeout
- **Request body:** `{"roleCategory":"frontend"}`
- **Notes:** The server accepts the connection and receives the request but never sends a response. Confirmed with verbose curl output showing the upload completes but no response headers are received. This will timeout on Vercel (60s limit) and likely indicates an unresolved promise, infinite loop, or deadlocked async operation.

---

### PROFILE APIs

#### Test 8: `GET /api/profiles/torvalds` — FAIL
- **Status:** 500 Internal Server Error
- **Time:** 0.956s
- **Response body:** Empty (0 bytes)
- **Expected:** 200 with full profile object (username, bio, languages, repos, score, etc.)
- **Notes:** Torvalds is one of the most well-known GitHub users. If this fails, all profile lookups likely fail. The empty error body makes debugging difficult — the route handler is not catching/serializing the error.

#### Test 9: `GET /api/profiles/nonexistent-user-xyz-99999` — FAIL
- **Status:** 500 Internal Server Error
- **Time:** 0.220s
- **Response body:** Empty (0 bytes)
- **Expected:** 404 with `{"error": "User not found"}` or similar
- **Notes:** Should return 404, not 500. Same empty body issue as Test 8. The error handling path is broken for both found and not-found cases.

---

### SCORE API

#### Test 10: `GET /api/score/torvalds` — BLOCKED (Rate Limit)
- **Status:** 429
- **Time:** 0.152s
- **Response:** `{"error":"GitHub API rate limit exceeded. Try again in a few minutes."}`
- **Notes:** Cannot verify score shape due to GitHub API rate limiting. The error response itself is well-formed. The endpoint does exist and responds correctly to rate limit conditions. Would need a valid GitHub token with remaining quota to test the success path.

---

### ENRICHMENT APIs

#### Test 11: `GET /api/enrich/packages?username=sindresorhus` — PASS
- **Status:** 200 OK
- **Time:** 1.142s
- **Response shape:**
  ```
  {
    packages: [{ registry, name, description, weeklyDownloads, version, homepage }],
    totalDownloads: 5371186609,
    topPackage: "ansi-styles",
    registries: ["npm"],
    packageMaintainerScore: 100
  }
  ```
- **Notes:** Rich data. 20 packages returned. Downloads in the billions. All fields populated. Excellent enrichment data for sindresorhus as expected.

#### Test 12: `GET /api/enrich/compensation?username=torvalds` — FAIL
- **Status:** 404
- **Time:** 0.052s
- **Response:** `{"error":"User not found"}`
- **Retried with:** `karpathy` (known local user) — same 404
- **Retried with:** `mitsuhiko` (known local user) — connection reset by peer
- **Notes:** The endpoint cannot find any user, even those confirmed in the local database from search results. Either the lookup logic is broken, or the endpoint requires a different identifier format (e.g., internal ID vs username). The connection reset for mitsuhiko suggests a crash/panic in the handler.

---

### STATS API

#### Test 13: `GET /api/stats` — FAIL
- **Status:** 500 Internal Server Error
- **Time:** 0.260s
- **Response body:** Empty (0 bytes)
- **Expected:** 200 with stats object (total developers, languages distribution, etc.)
- **Notes:** Same empty-body 500 pattern as profiles endpoint. Likely a database query error (possibly related to the connection pool exhaustion seen in Test 20).

---

### MARKET MAP APIs

#### Test 14: `POST /api/market-map/generate` (no auth) — PASS
- **Status:** 401 Unauthorized
- **Time:** 0.833s
- **Response:** `{"error":"Unauthorized"}`
- **Notes:** Correctly rejects unauthenticated requests. Proper status code and error message.

#### Test 15: `GET /api/market-map/list` (no auth) — PASS
- **Status:** 401 Unauthorized
- **Time:** 0.323s
- **Response:** `{"error":"Unauthorized"}`
- **Notes:** Correctly rejects unauthenticated requests. Consistent with Test 14.

---

### APOLLO API

#### Test 16: `GET /api/apollo/company-search?q=stripe` — FAIL
- **Status:** 502 Bad Gateway
- **Time:** 0.452s
- **Response:** `{"error":"Apollo returned 422"}`
- **Notes:** The endpoint reaches Apollo.io but receives a 422 (Unprocessable Entity) response. This could indicate: (a) invalid/expired API key, (b) malformed request payload to Apollo, or (c) Apollo API contract change. The error is at least properly surfaced with a descriptive message.

---

### AUTH APIs

#### Test 17: `GET /api/auth/providers` — PASS
- **Status:** 200 OK
- **Time:** 0.013s
- **Response:**
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
- **Notes:** GitHub OAuth provider correctly configured. URLs point to production domain even in local dev (expected NextAuth behavior based on NEXTAUTH_URL config).

#### Test 18: `GET /api/auth/csrf` — PASS
- **Status:** 200 OK
- **Time:** 0.012s
- **Response:** `{"csrfToken":"4f974fe7..."}`
- **Notes:** CSRF token generated successfully. 64-character hex string.

---

### PIPELINE API

#### Test 19: `POST /api/pipeline` (no auth header) — FAIL
- **Status:** 400 Bad Request
- **Time:** 0.030s
- **Response:** `{"error":"Provide usernames array or a search query"}`
- **Expected:** 401 Unauthorized
- **Notes:** The endpoint validates the request body BEFORE checking authentication. An unauthenticated user gets a body validation error instead of being rejected at the auth layer. This is a security concern — it reveals API contract details to unauthenticated callers.

#### Test 20: `POST /api/pipeline` (wrong secret) — FAIL
- **Status:** 400 Bad Request
- **Time:** 0.006s
- **Response:** `{"error":"Provide usernames array or a search query"}`
- **Expected:** 401 Unauthorized
- **Bonus test (wrong secret + valid body):** Returns 500 with `{"error":"MaxClientsInSessionMode: max clients reached"}` — the request proceeds past auth to database access, confirming auth is NOT being checked.
- **Notes:** Authentication is effectively bypassed. The `PIPELINE_SECRET` bearer token check is either missing or not functioning. Combined with the DB pool error, this means unauthenticated requests can consume database connections.

---

## Response Time Summary

| Endpoint | Time | Rating |
|----------|------|--------|
| `GET /api/search` (no params) | 0.007s | Excellent |
| `GET /api/auth/csrf` | 0.012s | Excellent |
| `GET /api/auth/providers` | 0.013s | Excellent |
| `POST /api/pipeline` (no auth) | 0.030s | Excellent |
| `GET /api/enrich/compensation` | 0.052s | Good |
| `GET /api/search?q=<script>` | 0.161s | Good |
| `GET /api/score/torvalds` | 0.152s | Good |
| `GET /api/profiles/nonexistent` | 0.220s | Good |
| `GET /api/stats` | 0.260s | Acceptable |
| `GET /api/market-map/list` | 0.323s | Acceptable |
| `POST /api/search/quick` | 0.351s | Acceptable |
| `GET /api/search?q=typescript+san+francisco` | 0.406s | Acceptable |
| `GET /api/apollo/company-search` | 0.452s | Acceptable |
| `GET /api/search?q=frontend+engineer` | 0.464s | Acceptable |
| `POST /api/market-map/generate` | 0.833s | Slow |
| `GET /api/profiles/torvalds` | 0.956s | Slow |
| `GET /api/enrich/packages` | 1.142s | Slow |
| `GET /api/search?q=python` | 1.385s | Slow |
| `POST /api/search/deep` | >60s | Timeout |

---

## Recommendations

### Immediate Fixes Required (P0)
1. **Fix `/api/profiles/[username]` route handler** — Likely a Next.js 16 `params` await issue or unhandled DB error. Add try/catch with proper error serialization.
2. **Fix `/api/stats` route handler** — Same pattern as profiles. Check for DB connection issues and add error handling.
3. **Add auth check to `/api/pipeline` BEFORE body validation** — The `Authorization: Bearer PIPELINE_SECRET` check must be the first thing in the handler.
4. **Fix `/api/search/deep` infinite hang** — The endpoint never responds. Check for unresolved promises, missing `return`, or infinite loops.

### High Priority (P1)
5. **Fix `/api/enrich/compensation` user lookup** — Endpoint can't find any users. Verify it's querying the correct table/field.
6. **Fix Apollo.io integration** — 422 from Apollo suggests the request format needs updating. Check API key validity and request payload structure.
7. **Investigate DB pool exhaustion** — `MaxClientsInSessionMode` error indicates connection pool saturation. Review connection management and add pool size monitoring.

### Medium Priority (P2)
8. **Standardize search API response shapes** — `/api/search` returns `{total, page, totalPages, query}` but `/api/search/quick` returns `{total_count}`. Align to a consistent contract.
9. **Add error bodies to 500 responses** — Multiple endpoints return 500 with empty bodies. All error responses should include a JSON error message for debuggability.
10. **Verify `/api/search/quick` actually returns results** — Returned 0 results for multiple valid queries. May be rate-limited or have a query construction bug.

---

## Test Environment Notes
- GitHub API rate limit was hit during testing (Test 10 returned 429), which may have affected other GitHub-dependent endpoints.
- No authenticated session was available for testing auth-required features (market maps, favorites).
- Database connection pool showed signs of exhaustion during pipeline testing.
