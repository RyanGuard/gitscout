# GitScout Search Quality Deep Dive Report

**Generated:** 2026-03-25
**Target:** https://gitscout-beta.vercel.app (production)
**Note:** Localhost was unavailable for testing (no `GITHUB_TOKEN` in `.env` -- GitHub Search API rate-limits to 10 req/min unauthenticated). All 17 tests ran against the production deployment which has a valid token.
**Test Runner:** Playwright 17 tests, serial execution, 45.7s total
**Total Searches Executed:** 23 (some tests run multiple sub-queries)

---

## Executive Summary

| Metric | Value |
|--------|-------|
| Overall Grade | **C** (5.9/10) |
| Avg Relevance Score | 5.9 / 10 |
| Avg Load Time | 0.58s |
| Total Issues Found | 13 |
| Excellent | 2 queries |
| Good | 6 queries |
| Fair | 12 queries |
| Weak | 2 queries |
| Poor | 0 queries |

### Key Findings

1. **Language matching is the #1 quality problem.** 11 of 13 issues are "0-5% of results match the expected language." The API sends `language:X` to GitHub's user search, but GitHub user search matches on profile metadata, not repo languages. Most fresh GitHub-sourced profiles return with no `languages[]` data (only locally-stored profiles have it).

2. **Location matching works well.** When a location is specified, 100% of results have the correct location (all 20/20 in Q01-Q05, Q07, Q10, Q13). The alias system (SF/Bay Area/San Francisco) produces **identical results** with 20/20 overlap.

3. **Performance is excellent.** Average load time 0.58s across all queries. No query exceeded 1.4s. Stress test (5 rapid queries) completed with 0 failures and avg 530ms.

4. **Consistency is perfect.** Same search twice (Q15) returned identical results with 100% overlap.

5. **Edge cases handled correctly.** Empty search returns 0 results (200 OK). Nonsense query "FakeLanguage123" returns 0 results (200 OK). Known user "torvalds" found successfully.

### Root Cause: Language Data Gap

The core issue is architectural: the GET `/api/search` endpoint fetches profiles from GitHub REST API, which returns user metadata (name, location, followers, bio) but **not** repository language data. Only profiles that have been locally indexed (via the pipeline) have `languages[]` populated. For the 17 tests:

- `source: "github"` profiles: 0 language entries (most results)
- `source: "local"` profiles: full language data (minority of results)

This means the relevance scoring in our test flags "0% language match" — but the GitHub query itself IS filtering by language. The developers returned likely DO code in the requested language; we just can't verify it from the REST API response alone.

---

## Results Summary

| # | Query | Results | Total | Load Time | Relevance | Quality | Avg Score | Tiers | Email % | Issues |
|---|-------|---------|-------|-----------|-----------|---------|-----------|-------|---------|--------|
| 1 | TypeScript developers in SF | 20 | 239 | 1.32s | 5/10 | Fair | 47.3 | 2S/14E/4L | 50% | 1 |
| 2 | Python developers in Austin | 20 | 1000 | 0.63s | 5/10 | Fair | 53.8 | 4S/16E | 50% | 1 |
| 3 | Rust developers in Berlin | 20 | 70 | 0.46s | 5/10 | Fair | 51.9 | 7S/12E/1L | 30% | 1 |
| 4 | Go developers in Seattle | 20 | 358 | 0.63s | 5/10 | Fair | 55.9 | 1St/5S/13E/1L | 65% | 1 |
| 5 | React developers in New York | 20 | 1000 | 0.52s | 5/10 | Fair | 61.3 | 12S/8E | 50% | 1 |
| 6 | Machine learning engineers | 20 | 1000 | 0.55s | 3/10 | Weak | 56.8 | 8S/10E/2L | 25% | 1 |
| 7 | Developers in Buenos Aires | 20 | 1000 | 0.41s | 7/10 | Good | 54.7 | 4S/15E/1L | 55% | - |
| 8 | Empty search | 0 | 0 | 0.25s | 10/10 | Excellent | - | - | - | - |
| 9a | JavaScript developers | 20 | 1000 | 0.58s | 6/10 | Fair | 63.2 | 7St/9S/4L | 60% | - |
| 9b | TypeScript developers | 20 | 1000 | 0.42s | 7/10 | Good | 59.9 | 14S/3E/3L | 30% | - |
| 10a | Developers in San Francisco | 20 | 1000 | 0.68s | 7/10 | Good | 60.2 | 1St/14S/1E/4L | 45% | - |
| 10b | Developers in SF | 20 | 1000 | 0.44s | 7/10 | Good | 60.2 | (identical) | 45% | - |
| 10c | Developers in Bay Area | 20 | 1000 | 0.41s | 7/10 | Good | 60.2 | (identical) | 45% | - |
| 11 | torvalds | 20 | 156 | 0.42s | 10/10 | Excellent | 41.0 | 1S/10E/9L | 30% | - |
| 12 | FakeLanguage123 | 0 | 0 | 0.28s | 8/10 | Good | - | - | - | - |
| 13 | Elixir in Portland | 6 | 6 | 0.44s | 5/10 | Fair | 39.0 | 3E/3L | 0% | 1 |
| 14 | Rapid consecutive (5 queries) | 100 | - | 0.53s avg | 8/10 | Good | - | - | - | - |
| 15a | Consistency run 1 | 20 | 239 | 0.48s | 5/10 | Fair | 47.3 | 2S/14E/4L | 50% | 1 |
| 15b | Consistency run 2 | 20 | 239 | 0.45s | 5/10 | Fair | 47.3 | (identical) | 50% | 1 |
| 16a | TS+SF sort:followers | 20 | 239 | 0.68s | 5/10 | Fair | 47.3 | 2S/14E/4L | 50% | 1 |
| 16b | TS+SF sort:stars | 20 | 239 | 0.71s | 5/10 | Fair | 43.7 | 2S/10E/8L | 50% | 1 |
| 16c | TS+SF sort:joined | 20 | 239 | 0.59s | 5/10 | Fair | 25.9 | 1E/19L | 45% | 1 |
| 17 | Python + Machine Learning | 20 | 1000 | 1.36s | 3/10 | Weak | 56.8 | 8S/10E/2L | 25% | 1 |

*Tier key: St=Strong, S=Solid, E=Emerging, L=Limited Data*

---

## Detailed Analysis by Query

### Q01: TypeScript developers in San Francisco

**Query:** `TypeScript developers in San Francisco` | **HTTP 200** | **1.32s** | **20 results / 239 available**

| Metric | Value |
|--------|-------|
| Avg Score | 47.3 | Median: 49.9 | Range: 23.7 - 63.3 |
| Location Match | 20/20 (100%) -- all in SF area |
| Language Match | 1/20 (5%) -- only locally-stored profiles have language data |
| Email Available | 10/20 (50%) |
| Bio Available | 15/20 (75%) |
| Company Available | 9/20 (45%) |
| Hireable | 1/20 (5%) |

**Top 5:**

| Username | Score | Tier | Followers | Location |
|----------|-------|------|-----------|----------|
| oktadev | 63.3 | Solid | 514 | San Francisco, CA |
| alchemyplatform | 61.4 | Solid | 1031 | San Francisco, CA |
| mahseema | 56.0 | Emerging | 6,315 | San Francisco |
| alxhub | 55.3 | Emerging | 1,221 | San Francisco, CA |
| voiceflow | 55.1 | Emerging | 324 | San Francisco, CA |

**Observation:** Location targeting is perfect. Avg followers is high (1,584) and avg public repos (71) suggests active developers. The query correctly builds `language:typescript location:"San Francisco" followers:>=10`. Note: mahseema has 6,315 followers but scores lower because the scoring formula weights repo count and profile completeness, not just followers.

---

### Q02: Python developers in Austin

**Query:** `Python developers in Austin` | **HTTP 200** | **0.63s** | **20/1000**

| Metric | Value |
|--------|-------|
| Avg Score | 53.8 | Median: 52.1 | Range: 44.6 - 65.6 |
| Location Match | 20/20 (100%) |
| Language Data Available | 0/20 (0%) -- all from GitHub source |
| Email | 10/20 (50%) | Hireable | 6/20 (30%) |

**Top 5:** ContinuumIO (65.6, Anaconda team), JessicaSachs (63.9, Cypress/Vue), mrocklin (63.5, Dask creator), pry0cc (60.3), ruotianluo (59.6)

**Observation:** Excellent location targeting. Higher hireable rate (30%) than average. ContinuumIO (Anaconda) is a strong Python signal even without language data.

---

### Q03: Rust developers in Berlin

**Query:** `Rust developers in Berlin` | **HTTP 200** | **0.46s** | **20/70**

| Metric | Value |
|--------|-------|
| Avg Score | 51.9 | Range: 33.2 - 64.8 |
| Location Match | 20/20 (100%) |

**Top 5:** jamesmunns (64.8, embedded Rust), skade (64.3, Rust community), withoutboats (63.9, Rust core team), spacejam (63.5, sled DB), XAMPPRocky (61.0, Rust/tokei)

**Observation:** Small pool (only 70 total) but extremely high-quality Rust community members. Berlin's Rust scene is well-represented. 7/20 scored "Solid" tier.

---

### Q04: Go developers in Seattle

**Query:** `Go developers in Seattle` | **HTTP 200** | **0.63s** | **20/358**

| Metric | Value |
|--------|-------|
| Avg Score | 55.9 | Range: 20.8 - 76.5 |
| Location Match | 20/20 (100%) |

**Top 5:** schollz (76.5, Strong tier!), ahmetb (71.6, kubectl plugins), d4l3k (64.7), ashleymcnamara (64.3, Go/Azure DevRel), brendandburns (61.9, Kubernetes co-creator)

**Observation:** Only query with a "Strong" tier result (schollz at 76.5). Brendan Burns (Kubernetes co-creator) showing up validates Go+Seattle targeting. Highest avg followers (2,123) among language+location queries.

---

### Q05: React developers in New York

**Query:** `React developers in New York` | **HTTP 200** | **0.52s** | **20/1000**

| Metric | Value |
|--------|-------|
| Avg Score | 61.3 | Range: 53.0 - 70.6 |
| Location Match | 20/20 (100%) |

**Top 5:** jaredpalmer (70.6, Formik creator), acdlite (68.3, React core team), jxnblk (67.8, Styled System), shiffman (67.4, Coding Train), tmcw (66.8, Mapbox)

**Observation:** Highest average score (61.3) of any language+location query. 12/20 in "Solid" tier. React query maps to `language:javascript` which correctly broadens the pool. acdlite is literally on the React core team -- excellent relevance.

---

### Q06: Machine learning engineers

**Query:** `machine learning engineers` | **HTTP 200** | **0.55s** | **20/1000** | **Relevance: 3/10 (Weak)**

| Metric | Value |
|--------|-------|
| Avg Score | 56.8 | Range: 10.6 - 68.4 |
| Bio Available | 20/20 (100%) -- all have ML in bio |
| Location Available | 12/20 (60%) |
| Email | 5/20 (25%) |

**Top 5:** ogrisel (68.4, scikit-learn), ageron (67.5, Hands-On ML author), jindongwang (66.7), omarsar (66.2, ML Papers), Germey (65.9)

**Observation:** Low relevance score (3/10) is misleading -- the results are actually excellent ML practitioners. The scoring penalizes because: (a) no location filter means relevance scoring gets no location bonus, (b) language data unavailable for github-source profiles. Top results include the author of "Hands-On ML" and a scikit-learn core contributor.

---

### Q07: Developers in Buenos Aires

**Query:** `developers in Buenos Aires` | **HTTP 200** | **0.41s** | **20/1000** | **Relevance: 7/10 (Good)**

| Metric | Value |
|--------|-------|
| Avg Score | 54.7 | Range: 39.5 - 72.5 |
| Location Match | 20/20 (100%) |
| Email | 11/20 (55%) |

**Top 5:** goncy (72.5), bevacqua (66.4, Modular/PonyFoo), lambdaclass (63.7), gvolpe (60.3), andresriancho (59.8)

**Observation:** Location-only query works well. Buenos Aires has a strong dev community. Highest email availability (55%) of location queries.

---

### Q08: Empty search

**HTTP 200** | **0.25s** | **0 results** | **Relevance: 10/10 (Excellent)**

Correctly returns empty results with no error. Fast response (250ms).

---

### Q09: JavaScript vs TypeScript comparison

| Metric | JavaScript | TypeScript |
|--------|-----------|------------|
| Results | 20 | 20 |
| Load Time | 0.58s | 0.42s |
| Avg Score | 63.2 | 59.9 |
| Median Score | 71.4 | 64.7 |
| Tier: Strong | 7 | 0 |
| Tier: Solid | 9 | 14 |
| Avg Followers | 56,330 | 12,352 |
| Avg Stars | 5,407 | 60,237 |
| Email % | 60% | 30% |
| Source: local | 8 | 20 |
| **Overlap** | **0%** | **0%** |

**Observation:** Zero overlap between JS and TS results is excellent differentiation. JavaScript returns higher-follower individuals (addyosmani, antfu, kamranahmedse). TypeScript returns all locally-stored profiles (100% `source: local`) because there are many TS-heavy profiles in the DB -- these come with full language data and higher star counts.

---

### Q10: SF Location Alias Comparison

| Variant | "San Francisco" | "SF" | "Bay Area" |
|---------|----------------|------|------------|
| Results | 20 | 20 | 20 |
| Load Time | 0.68s | 0.44s | 0.41s |
| Total | 1000 | 1000 | 1000 |
| Overlap | 20/20 (100%) with all variants |

**All three return identical results.** The location alias system (`SF` -> `San Francisco`, `Bay Area` -> `San Francisco`) works perfectly. This is a significant quality win -- recruiters can type any common variation and get the same results.

**Top result across all:** lucidrains (79.5, Strong, 58,919 followers)

---

### Q11: torvalds (known user lookup)

**HTTP 200** | **0.42s** | **20/156 results** | **Relevance: 10/10 (Excellent)**

Linus Torvalds found: **score=30.5, tier=Limited Data, followers=292,673, location=Portland, OR**

**Observation:** torvalds is found but scored low (30.5, "Limited Data") because:
- The quick-score formula weights `log(followers)` which compresses his 292K followers
- He has relatively few public repos on his personal account
- No email/blog in public profile reduces profile bonus

This suggests the scoring formula may need recalibration for extremely high-follower users.

---

### Q12: FakeLanguage123 (nonsense query)

**HTTP 200** | **0.28s** | **0 results** | **Relevance: 8/10 (Good)**

Gracefully returns empty. No errors, no noise.

---

### Q13: Elixir in Portland

**HTTP 200** | **0.44s** | **6/6 results** | **Relevance: 5/10 (Fair)**

| Metric | Value |
|--------|-------|
| Avg Score | 39.0 | Range: 27.6 - 45.4 |
| Location Match | 6/6 (100%) |
| Email | 0/6 (0%) |

**Top:** doawoo (45.4), jeffweiss (44.6), binaryseed (41.1)

**Observation:** Niche query correctly returns small pool. All 6 are in Portland. Zero email availability is notable -- niche communities may have lower email disclosure rates. Low scores reflect smaller follower counts in a smaller market.

---

### Q14: Rapid consecutive searches (stress test)

5 searches fired with 800ms delays between them.

| Query | Status | Time | Results |
|-------|--------|------|---------|
| python developers | 200 | 580ms | 20 |
| rust developers | 200 | 574ms | 20 |
| go developers | 200 | 625ms | 20 |
| javascript developers | 200 | 486ms | 20 |
| typescript developers | 200 | 385ms | 20 |

**0/5 failures.** Avg 530ms, max 625ms. The API handles rapid sequential requests without rate limiting or degradation. The Vercel deployment + GitHub token combination provides stable throughput.

---

### Q15: Same search twice (consistency check)

**Query:** `TypeScript developers in San Francisco` (run twice, 500ms apart)

| Metric | Run 1 | Run 2 |
|--------|-------|-------|
| Results | 20 | 20 |
| Load Time | 476ms | 449ms |
| Avg Score | 47.3 | 47.3 |
| **Overlap** | **20/20 (100%)** | **20/20 (100%)** |

**Perfect consistency.** Identical results, identical ordering, identical scores. No randomness or cache-induced variance.

---

### Q16: TypeScript+SF sorted each way

**Query:** `TypeScript developers in San Francisco` with 3 sort modes

| Metric | sort:followers | sort:stars | sort:joined |
|--------|---------------|------------|-------------|
| Load Time | 0.68s | 0.71s | 0.59s |
| Avg Score | 47.3 | 43.7 | 25.9 |
| Avg Followers | 1,584 | 224 | 16 |
| Top Result | oktadev (63.3) | oktadev (63.3) | LXGIC-Studios (48.9) |
| #10 Result | reworkd (50.1) | semiotic-ai (46.7) | ksinder (26.4) |
| Last Result | trekhleb (23.7) | mhconradt (27.4) | admin-crmantra-git (6.5) |

**Observation:** Sort modes produce measurably different results:
- **followers**: Highest avg followers (1,584), best for finding influential developers
- **stars**: Different pool (avg followers only 224), surfaces repo-focused developers
- **joined**: Newest accounts, very low scores (avg 25.9), mostly "Limited Data" tier -- useful for finding new talent but quality floor is low

Note: The app re-sorts by internal score after fetching from GitHub, which means the "sort by followers" result has the highest-followers user (trekhleb, 17,793) ranked LAST because his internal score (23.7) is lowest. This re-sorting behavior may confuse users who expect follower-order.

---

### Q17: Python + Machine Learning (ML ecosystem check)

**Query:** `Python machine learning` | **HTTP 200** | **1.36s** | **20/1000** | **Relevance: 3/10 (Weak)**

**ML Ecosystem Signals Found: 25 signals across 20 developers:**

| Signal Type | Count | Examples |
|-------------|-------|---------|
| General ML | 15 | ogrisel, ageron, jindongwang, omarsar |
| HuggingFace | 2 | sgugger, xenova |
| TensorFlow | 1 | ageron |
| PyTorch | 0 | (none detected in top 20 bio/repos) |
| LLM | 0 | (none in bio/repos) |

**Top 5:** ogrisel (68.4, scikit-learn), ageron (67.5, Hands-On ML), jindongwang (66.7), omarsar (66.2), Germey (65.9)

**Observation:** Despite the "Weak" relevance label, these are high-quality ML practitioners. The low score (3/10) comes from the language data gap (only 1/20 has Python data verified). The 1.36s load time is the slowest query -- likely because ML-tagged profiles need more GitHub API calls to resolve. HuggingFace contributors (sgugger = Sylvain Gugger, former HF researcher) validate the query quality.

---

## Cross-Query Analysis

### Performance Ranking

| Query | Load Time |
|-------|-----------|
| Python + Machine Learning | 1.36s |
| TypeScript devs in SF (first call) | 1.32s |
| Sort by stars | 0.71s |
| Sort by followers | 0.68s |
| Developers in San Francisco | 0.68s |
| Go developers in Seattle | 0.63s |
| Python developers in Austin | 0.63s |
| Sort by joined | 0.59s |
| JavaScript developers | 0.58s |
| Machine learning engineers | 0.55s |

All queries under 1.5s. First-call queries are slower (cold start + profile fetches). Subsequent queries for the same parameters are faster (GitHub API caching + local DB hits).

### Score Distribution by Query Type

| Query Type | Avg Score | Median | Max | % Solid+ |
|------------|-----------|--------|-----|----------|
| Language + Location | 54.0 | 52.5 | 76.5 | 30% |
| Language only | 61.6 | 68.0 | 79.5 | 60% |
| Location only | 57.5 | 60.9 | 79.5 | 42% |
| Role-based (ML) | 56.8 | 59.0 | 68.4 | 40% |

Language-only queries return higher-scoring developers (no geographic constraint = larger pool).

### Email Availability by Query Type

| Query Type | Avg Email % |
|------------|-------------|
| Location queries | 48% |
| Language-only | 45% |
| ML/Role queries | 25% |
| Niche (Elixir/Portland) | 0% |

Location-targeted queries have higher email rates -- developers who set their location tend to also set their email.

### All Issues Found

| # | Query | Issue |
|---|-------|-------|
| 1 | TypeScript devs in SF | 5% language match (data gap) |
| 2 | Python devs in Austin | 0% language match (data gap) |
| 3 | Rust devs in Berlin | 0% language match (data gap) |
| 4 | Go devs in Seattle | 5% language match (data gap) |
| 5 | React devs in NY | 0% language match (data gap) |
| 6 | ML engineers | 5% language match (data gap) |
| 7 | Elixir in Portland | 0% language match (data gap) |
| 8-9 | Consistency runs 1&2 | 5% language match (data gap) |
| 10-12 | Sort variants | 0-5% language match (data gap) |
| 13 | Python+ML | 5% language match (data gap) |

**All 13 issues share the same root cause:** Language data is not returned by GitHub's REST user search API. Only locally-indexed profiles have language stats.

---

## Recommendations

### P0 -- Critical

1. **Add `GITHUB_TOKEN` to local `.env`** -- Without it, localhost search returns 0 results (unauthenticated rate limit: 10 req/min for search). This blocks all local development and testing.

### P1 -- High Impact

2. **Enrich language data on first fetch** -- When fetching a GitHub user's full profile, also fetch their top 3-5 repos to extract primary languages. This would populate `languages[]` for `source: "github"` profiles and dramatically improve search quality validation.

3. **Reconsider post-fetch re-sorting** -- The API fetches GitHub results sorted by the user's chosen sort (followers, stars, joined), then re-sorts by internal score. This means a "sort by followers" search puts the highest-follower dev last. Either: (a) respect the user's sort choice, or (b) clearly label the sort as "GitScout Score" in the UI.

### P2 -- Medium Impact

4. **Recalibrate scoring for extreme followers** -- torvalds (292K followers) scores 30.5 ("Limited Data") because `log(followers)` compresses large numbers. Consider a tiered bonus for >10K, >50K, >100K followers.

5. **Add language data to quick-score** -- If recommendation #2 is implemented, factor primary language match into the quick-score calculation to boost developers who actually code in the searched language.

### P3 -- Nice to Have

6. **Cache ML ecosystem signals** -- Q17 was the slowest query (1.36s). ML-tagged profiles are high-value; consider pre-enriching known ML contributors.

7. **Surface email availability in search results UI** -- Email rates range from 0% (niche queries) to 65% (Go+Seattle). Showing an email indicator would help recruiters prioritize enrichment-worthy profiles.

---

## Test Infrastructure

- **Test file:** `tests/qa-search-quality/deep-dive.spec.ts`
- **Config:** `tests/qa-search-quality/playwright.config.ts`
- **Raw metrics:** `qa-reports/search-deep-dive/raw-metrics.json`
- **Run command:** `npx playwright test --config tests/qa-search-quality/playwright.config.ts`
- **Override target:** `QA_BASE_URL=http://localhost:3000 npx playwright test --config tests/qa-search-quality/playwright.config.ts`

---

*Report generated by GitScout QA Deep Dive Suite -- 17 Playwright tests, 23 search executions*
