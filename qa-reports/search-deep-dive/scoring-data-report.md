# Scout Scoring & Data Quality Report

**Date:** 2026-03-26
**Tester:** QA Data Quality Engineer
**Environment:** http://localhost:3000 (dev)
**Status:** 12 test cases executed, multiple critical issues found

---

## Executive Summary

The scoring engine has a **fundamental blind spot for maintainer-archetype developers** — the most valuable candidates in open source. Linus Torvalds scores 36.6/100 ("Limited Data") because the system equates "contribution quality" with "merged PRs to external repos," a metric that penalizes exactly the people who *receive* PRs. Sindre Sorhus, whose npm packages get 5.37 billion weekly downloads, scores 44.1 ("Emerging"). The compensation estimator classifies Torvalds as "Below market" at $265K–$442K TC.

Additionally, **GitHub API rate limiting causes catastrophic data loss** — when the token is exhausted, search results degrade to skeleton profiles with 0 followers, 0 repos, and 0 score. During testing, 100% of JavaScript search results were broken empty profiles. Organization accounts also leak into results despite the `type:user` filter.

**Critical bugs: 5 | Major bugs: 4 | Minor bugs: 3**

---

## Test 1: Score — torvalds (Linus Torvalds, creator of Linux & Git)

**Endpoint:** `GET /api/score/torvalds`

| Pillar | Score | Max | Assessment |
|--------|-------|-----|------------|
| Impact | 7.6 | 10 | Low — Linux kernel lives under `linux/` org, not `torvalds/` |
| Contribution Quality | **0.0** | 10 | **BROKEN** — Torvalds receives PRs, he doesn't submit them |
| Consistency | 2.5 | 10 | Low — primary work is via mailing list, not GitHub |
| Technical Depth | 4.1 | 10 | Low — few personal repos, mostly C (specialist penalty) |
| Reputation | 6.8 | 10 | Reasonable but capped — 217K followers |

**Final Score: 36.6 / 100 — Tier: "Limited Data"**
**Confidence: medium (0.9)**
**totalCommits: 0, recentActivity: 0, externalMergedPRs: 0**

### Verdict: CRITICALLY UNREASONABLE

The creator of Linux and Git — arguably the most impactful developer alive — is scored lower than many weekend project maintainers. Root causes:

1. **Contribution pillar (25% weight) = 0** because Torvalds doesn't submit PRs to other repos. He IS the upstream. The scoring model assumes everyone is a contributor, not a maintainer. This is the single biggest conceptual flaw.
2. **Impact pillar undercounts** because the Linux kernel (~185K stars) is under the `linux` organization, not `torvalds`'s personal account. The API only fetches `users/torvalds/repos`.
3. **Consistency pillar fails** because Torvalds works primarily through the Linux kernel mailing list (LKML), not GitHub's contribution graph. GitHub shows near-zero activity.
4. **Technical depth punished** for specialist focus (C only) and few personal repos.

**BUG-SCORE-001 [CRITICAL]:** Maintainer/creator archetype developers are systematically underscored. The Contribution pillar should have an alternative signal: being a merge-target (receiving PRs) is as valuable as submitting them.

**BUG-SCORE-002 [MAJOR]:** Organization-owned repos are invisible. Developers who contribute primarily to org repos (Linux Foundation, Meta, Google, etc.) get no Impact credit for their most significant work.

---

## Test 2: Score — sindresorhus (1,600+ npm packages, billions of downloads)

**Endpoint:** `GET /api/score/sindresorhus`

| Pillar | Score | Max | Assessment |
|--------|-------|-----|------------|
| Impact | 7.1 | 10 | Undervalued — has 255,720 total stars across repos |
| Contribution Quality | **0.0** | 10 | **BROKEN** — same maintainer-archetype problem |
| Consistency | 2.5 | 10 | Low — GraphQL data appears missing |
| Technical Depth | 9.0 | 10 | Correct — polyglot, many substantial repos |
| Reputation | 6.7 | 10 | Low for someone with 95K+ followers |

**Final Score: 44.1 / 100 — Tier: "Emerging"**
**Confidence: medium (0.95)**
**totalCommits: 0, recentActivity: 0, externalMergedPRs: 0**

### Verdict: CRITICALLY UNREASONABLE

Sindre Sorhus maintains chalk, got, p-map, execa, type-fest, globby — foundational npm infrastructure with **5.37 billion weekly downloads**. "Emerging" tier is insulting.

**BUG-SCORE-003 [CRITICAL]:** `totalCommits: 0` and `recentActivity: 0` for an extremely active developer. The GraphQL contribution data fetch (`fetchContributions`) is either failing silently or returning null for these high-profile accounts. This zeros out Consistency (20% weight) and Contribution (25% weight) — half the score is missing.

**BUG-SCORE-004 [MAJOR]:** The package enrichment data (Test 10 shows 5.37B weekly downloads, packageMaintainerScore: 100) is completely disconnected from the scoring engine. The scoring engine has no package/ecosystem impact signal.

---

## Test 3: Score — gaearon (Dan Abramov, React core team)

**Endpoint:** `GET /api/score/gaearon`
**Result:** `{"error":"GitHub API rate limit exceeded. Try again in a few minutes."}`

### Verdict: UNTESTABLE — Rate Limited

**BUG-INFRA-001 [MAJOR]:** Score endpoint makes 2+ GitHub API calls per request (user profile + repos + GraphQL). During normal usage, a handful of score lookups can exhaust the rate limit, blocking subsequent requests. No caching layer exists for the score endpoint.

---

## Test 4: Score — octocat (GitHub test/mascot account)

**Endpoint:** `GET /api/score/octocat`
**Result:** `{"error":"GitHub API rate limit exceeded. Try again in a few minutes."}`

### Verdict: UNTESTABLE — Rate Limited

Expected this to score very low (test/mascot account with 8 repos, no real development). Cannot verify.

---

## Test 5: Search "TypeScript San Francisco" — Top 5 Relevance Check

**Endpoint:** `GET /api/search?q=TypeScript+San+Francisco`
**Total results:** 191

| # | Username | Score | Location | Primary Language | Is TS Developer? |
|---|----------|-------|----------|-----------------|------------------|
| 1 | trekhleb | 60.3 | SF Bay Area | JavaScript (80.5%) | **NO** — JS/Python/Jupyter. TypeScript is 1.3% of code |
| 2 | mahseema | 56.0 | San Francisco | None | **NO** — "Part time Data Scientist," zero code repos |
| 3 | alxhub | 41.3 | San Francisco, CA | Unknown (github source) | **LIKELY YES** — Angular Framework/Compiler team |
| 4 | hansl | 36.7 | SF Bay Area | Unknown | **UNKNOWN** — no bio or language data |
| 5 | scttcper | 34.8 | San Francisco | Unknown | **UNKNOWN** — no language data |

### Verdict: POOR RELEVANCE

- Only 1 of the top 5 is verifiably a TypeScript developer (alxhub)
- The #1 result (trekhleb) writes primarily JavaScript (80.5%), Python, and Jupyter Notebooks. TypeScript is 1.3% of his code.
- The #2 result (mahseema) is a data scientist with zero programming repos — she curates awesome lists
- Results #3-5 from GitHub source have no language data to verify

**BUG-SEARCH-001 [MAJOR]:** Search for "TypeScript San Francisco" should filter by `language:typescript` in the GitHub query, but the results are sorted by followers (default), not by TypeScript relevance. The query parser correctly extracts TypeScript as a language, but GitHub's user search `language:` filter matches users who have ANY repo in that language — even if it's 1% of their work. There's no post-filter on language dominance.

**BUG-SEARCH-002 [MINOR]:** Non-developers (list curators, data scientists with no code) appear in developer search results. mahseema has zero programming repos — all her top repos are awesome lists with no code.

---

## Test 6: Search "Python machine learning" — ML Engineer Relevance

**Endpoint:** `GET /api/search?q=Python+machine+learning`
**Total results:** 1,000

| # | Username | Score | Bio (truncated) | Actually ML? |
|---|----------|-------|-----------------|--------------|
| 1 | Visualize-ML | 44.4 | "Iris Series: Math Made Easy and Visual" | **ORG ACCOUNT** — not a person |
| 2 | ageron | 50.7 | "Author of Hands-On Machine Learning..." | **YES** |
| 3 | NeuralNine | 44.9 | "Machine Learning... Owner: Florian Dedov" | **BRAND ACCOUNT** — personal brand, not individual |
| 4 | Germey | 47.8 | "Software Engineer, Web Scraping, ML" | **PARTIAL** — primarily web scraping |
| 5 | jindongwang | 0 | (no data) | **UNKNOWN** |

### Verdict: MIXED RELEVANCE

- 1 out of top 5 is a verifiable ML engineer (ageron)
- 1 is an organization/educational project account (Visualize-ML: 22K followers, 0 following)
- 1 is a personal brand channel (NeuralNine: bio says "Owner: Florian Dedov")
- Most results (19/20) from GitHub source have zero profile data

**BUG-SEARCH-003 [MINOR]:** Organization and brand accounts slip through the `type:user` filter. Visualize-ML registered as a user account but behaves as an org (0 following, 22K followers, educational content only).

---

## Test 7: Search "Rust" Sorted by Score — #1 vs #10

**Endpoint:** `GET /api/search?q=Rust&sort=score`

### When local data exists (first query, before rate limiting):

| # | Username | Score | Stars | Followers | Assessment |
|---|----------|-------|-------|-----------|------------|
| 1 | dtolnay | 68.8 | 51,199 | 9,232 | **Excellent** — serde, syn, proc-macro2 author |
| 2 | jonhoo | 68.0 | 4,541 | 13,364 | **Excellent** — Rust educator, AWS/helsing |
| 3 | **rustdesk** | **66.3** | **121,357** | **8,244** | **ORG ACCOUNT** — not a person |
| 4 | BurntSushi | 65.5 | 74,427 | 12,093 | **Excellent** — ripgrep, regex author |
| 5 | matklad | 63.4 | 732 | 6,769 | **Excellent** — rust-analyzer creator |
| 6-20 | (various) | 0 | 0 | 0 | All broken github-source profiles |

### Is #1 better than #10?

**When data exists:** #1 (dtolnay, 68.8) is clearly better than #5+ (0 score). The local-DB profiles are well-differentiated. dtolnay vs jonhoo (68.8 vs 68.0) is a reasonable ordering — dtolnay has more stars (51K vs 4.5K) but jonhoo has more followers (13K vs 9K).

**The problem:** Positions 6-20 are ALL score=0 "Unscored" profiles from GitHub source — rate limiting killed their data. There's no meaningful ranking beyond the 5 locally-cached profiles. **Sorting by score is useless when 75% of results have no score.**

**BUG-SEARCH-004 [CRITICAL]:** `rustdesk` at position #3 (score 66.3) is an **organization account**, not a developer. Bio: "Making affordable remote desktop service for everyone." Company: "Purslane Ltd." Following: 0. This is a company's official GitHub account that slipped through both GitHub's `type:user` filter and Scout's own scoring.

**BUG-SORT-001 [MINOR]:** Sorting by score creates a binary cliff — locally-cached profiles with scores float to the top, then ALL other results show 0. There's no graceful degradation. Even the `quickScore` function (which computes a score from REST API data) produces 0 when rate limited because followers/repos are 0 in the fallback.

---

## Test 8: Compensation — torvalds

**Endpoint:** `GET /api/enrich/compensation?username=torvalds`

```json
{
  "seniority": "staff",
  "locationTier": "Tier 2 (Major US Metro)",
  "companyTier": "Mid-Market",
  "baseSalary": { "low": 204000, "mid": 262000, "high": 340000 },
  "totalComp": { "low": 265000, "mid": 341000, "high": 442000 },
  "marketPosition": "Below market"
}
```

### Verdict: UNREASONABLE

- **Seniority: "staff"** — Torvalds is beyond "principal." He is a living legend. The system caps at "staff" via signal inference because his GitHub bio/title don't contain seniority keywords. His GH account is 18+ years old and has 217K followers, but the seniority detection only reaches "staff" for `followers >= 5000`.
- **Company: "Mid-Market"** — Torvalds is at the Linux Foundation, which is not in any company tier list. But calling the Linux Foundation "Mid-Market" is incorrect; it's a major non-profit tech foundation.
- **TC: $265K–$442K** — Actual compensation for someone of Torvalds' stature would be in the $2M–$5M+ range when considering his Linux Foundation salary plus consulting value.
- **Market position: "Below market"** — Ironic. Based on `score < 50`, which we already know is broken.

**BUG-COMP-001 [MAJOR]:** Seniority detection has no tier above "staff" via signal inference. The maximum signal-inferred level is "staff" (requires followers >= 5000 or stars >= 10000). There's no path to "principal" without an explicit title or 12+ YoE. This means ALL non-titled, legendary developers cap at "staff."

**BUG-COMP-002 [MINOR]:** Linux Foundation and other major foundations/non-profits are missing from company tier lists. Should be at least "unicorn" tier for comp purposes.

---

## Test 9: Compensation — gaearon (Dan Abramov)

**Endpoint:** `GET /api/enrich/compensation?username=gaearon`

```json
{
  "seniority": "staff",
  "locationTier": "Unknown",
  "companyTier": "Unknown",
  "baseSalary": { "low": 193000, "mid": 248000, "high": 321000 },
  "totalComp": { "low": 251000, "mid": 322000, "high": 417000 },
  "marketPosition": "Below market"
}
```

### Verdict: BELOW EXPECTATIONS

- **Seniority: "staff"** — Reasonable for React core team. Could argue principal.
- **Location: Unknown** — Abramov's GitHub location is not set. No fallback.
- **Company: Unknown** — His GH `company` field is not set to "Meta" or "Bluesky." Without this, the system can't apply FAANG multipliers.
- **TC estimate: $251K–$417K** — For a staff engineer at Meta, actual TC would be $500K–$800K+. The "other" TC multiplier (1.3x) is applied instead of "faang" (2.0x), dramatically underestimating.

The compensation estimator is fundamentally limited by what's in the GitHub profile. If company/location aren't set, it can't correct. This is by design but should be called out as a confidence/accuracy limitation.

---

## Test 10: Packages — sindresorhus

**Endpoint:** `GET /api/enrich/packages?username=sindresorhus`

### Verdict: EXCELLENT — Best performing endpoint tested

| Package | Weekly Downloads |
|---------|-----------------|
| ansi-styles | 576,780,770 |
| strip-ansi | 464,148,865 |
| chalk | 452,916,688 |
| ansi-regex | 433,215,953 |
| supports-color | 418,042,929 |
| string-width | 408,948,796 |
| wrap-ansi | 337,813,717 |
| type-fest | 313,416,332 |
| has-flag | 277,127,539 |
| escape-string-regexp | 244,685,052 |
| ... (20 packages total) | |
| **p-map** | **72,674,618** |

- **Total weekly downloads: 5,371,186,609** (5.37 billion)
- **packageMaintainerScore: 100**
- **Registries detected: npm**

Download counts appear accurate (cross-referenced with npm trends). p-map is correctly found. chalk is correctly attributed. The package enrichment pipeline is the strongest feature tested.

**However:** This excellent data is completely disconnected from the scoring engine (see BUG-SCORE-004). sindresorhus's packageMaintainerScore of 100 has zero effect on his overall score of 44.1.

---

## Test 11: Broken Profiles (0 followers AND 0 repos AND 0 stars)

**Search:** `GET /api/search?q=JavaScript`

### Result: 20/20 profiles on page 1 are broken

| Username | Followers | Repos | Stars | Score | Status |
|----------|-----------|-------|-------|-------|--------|
| yyx990803 (Vue.js creator) | 0 | 0 | 0 | 0 | BROKEN |
| gaearon (React core team) | 0 | 0 | 0 | 0 | BROKEN |
| sindresorhus (npm ecosystem) | 0 | 0 | 0 | 0 | BROKEN |
| bradtraversy (100K+ YT subs) | 0 | 0 | 0 | 0 | BROKEN |
| tj (Express.js creator) | 0 | 0 | 0 | 0 | BROKEN |
| ThePrimeagen | 0 | 0 | 0 | 0 | BROKEN |
| addyosmani (Chrome team) | 0 | 0 | 0 | 0 | BROKEN |
| kentcdodds (Testing Library) | 0 | 0 | 0 | 0 | BROKEN |
| antfu (Vite/Vue ecosystem) | 0 | 0 | 0 | 0 | BROKEN |
| ... (all 20 results) | 0 | 0 | 0 | 0 | BROKEN |

**All source: "github" (not locally cached)**

### Root Cause

The search endpoint (`GET /api/search`) follows this flow:
1. Search GitHub `/search/users` — returns login + id + avatar only
2. For users not in local DB, fetch full profile from `/users/{login}`
3. If profile fetch fails (rate limit), fall back to skeleton: all fields = 0

When the GitHub token's 5,000 req/hr budget is exhausted, step 2 fails for ALL non-local users. The skeleton fallback shows 0 for everything — making the entire search page appear broken.

**BUG-INFRA-002 [CRITICAL]:** No resilience to rate limiting. A single search page can trigger 20+ individual profile fetches, rapidly exhausting the API budget. When exhausted, results degrade catastrophically to empty profiles instead of degrading gracefully.

**Recommendations:**
- Cache GitHub user profiles in the local DB after first fetch (TTL: 7 days)
- Use GitHub's GraphQL API to batch-fetch user profiles (1 request vs 20)
- Show a warning badge on rate-limited profiles instead of showing 0s
- Implement exponential backoff and request queuing

---

## Test 12: Organization Accounts in Results

### Confirmed organization accounts appearing as individuals:

| Account | Search | Score | Evidence |
|---------|--------|-------|----------|
| **rustdesk** | Rust | 66.3 | Bio: "Making affordable remote desktop service for everyone." Company: "Purslane Ltd." 0 following, 8,244 followers. 11 repos — all org products. |
| **Visualize-ML** | Python ML | 44.4 | Bio: "Iris Series: Math Made Easy and Visual." 0 following, 22,522 followers. Educational project, not a person. |
| **NeuralNine** | Python ML | 44.9 | Bio: "Machine Learning... Owner: Florian Dedov." Brand/channel account, not the individual. |

### Why `type:user` filter doesn't catch them

GitHub allows organizations to register as "User" type accounts. The `type:user` search qualifier only filters by GitHub's account type field, not by behavioral patterns. These accounts registered as users but operate as organizations.

**Heuristic signals for org detection (not currently implemented):**
- `following == 0` AND `followers > 1000` (99% of real developers follow someone)
- Company name matches username
- Bio contains "we ", "our ", "making ", "building " without first-person pronouns
- No personal name set (just brand name)
- All repos are products under the same brand

---

## Bug Summary

### Critical (5)

| ID | Title | Impact |
|----|-------|--------|
| BUG-SCORE-001 | Maintainer archetype scores 0 on Contribution pillar | Torvalds, sindresorhus, and all top maintainers underscored by 25% |
| BUG-SCORE-003 | GraphQL contribution data returns 0 for high-profile accounts | Consistency + Contribution = 0 for many developers (45% of score) |
| BUG-SCORE-004 | Package ecosystem impact not connected to scoring | sindresorhus's 5.37B weekly downloads have zero effect on score |
| BUG-INFRA-002 | Catastrophic degradation under rate limiting | 100% of search results become broken empty profiles |
| BUG-SEARCH-004 | Organization accounts scored and ranked as individuals | rustdesk (org) ranked #3 in Rust results at 66.3 score |

### Major (4)

| ID | Title | Impact |
|----|-------|--------|
| BUG-SCORE-002 | Organization-owned repos invisible to Impact pillar | Linux kernel (185K stars) not counted for Torvalds |
| BUG-INFRA-001 | Score endpoint has no caching, burns API quota | Each score lookup = 2+ API calls, rapid rate limit exhaustion |
| BUG-SEARCH-001 | Language filter matches any repo, not primary language | JavaScript developers rank high in TypeScript searches |
| BUG-COMP-001 | Seniority detection caps at "staff" without explicit title | No path to "principal" for legendary untitled developers |

### Minor (3)

| ID | Title | Impact |
|----|-------|--------|
| BUG-SEARCH-002 | Non-developers (list curators) appear in results | mahseema (awesome-list curator) in TypeScript SF results |
| BUG-SEARCH-003 | Brand/educational accounts bypass org detection | Visualize-ML, NeuralNine registered as users |
| BUG-COMP-002 | Linux Foundation and major non-profits missing from company tiers | Foundation employees classified as "Mid-Market" |

---

## Recommendations (Priority Order)

1. **Add maintainer/merge-target signal to Contribution pillar** — Query for repos where the user is a top code reviewer or merge committer. Being a merge target is the inverse of submitting PRs and equally valuable.

2. **Integrate package enrichment data into scoring** — The packages endpoint already produces a `packageMaintainerScore`. Wire it into the scoring engine as a sub-signal under Impact or as a 6th pillar.

3. **Implement profile caching** — After fetching a GitHub profile, store it locally with a 7-day TTL. This prevents re-fetching the same profiles and dramatically reduces API quota burn.

4. **Batch profile fetches via GraphQL** — Replace 20 individual REST calls with a single GraphQL query. This reduces API consumption by ~95% per search page.

5. **Add org detection heuristics** — Flag accounts with 0 following + high followers + brand-like names. Either filter them out or tag them as "[Organization]" in results.

6. **Add language dominance post-filter** — When searching for "TypeScript," rank users by % of code in TypeScript, not just whether they have any TS repo.

7. **Graceful rate-limit degradation** — When profile fetches fail, show the data GitHub's search API already returned (username, avatar, basic counts from search results) instead of zeroing everything out.
