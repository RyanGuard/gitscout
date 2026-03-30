# Scoring & Ranking Deep Dive Report

**Date:** 2026-03-25
**Query tested:** "TypeScript San Francisco"
**Endpoints tested:** `/api/search?q=TypeScript+San+Francisco`, `/api/search?q=TypeScript&location=San+Francisco`, `/api/score/torvalds`, `/api/score/sindresorhus`
**Source files reviewed:** `src/lib/scoring.ts`, `src/lib/scoring/engine.ts`, `src/app/api/score/[username]/route.ts`, `src/app/api/search/route.ts`, `src/components/ui/TierBadge.tsx`, `src/components/profile/ScoreBreakdown.tsx`, `src/components/profile/DeveloperCard.tsx`, `src/components/ui/ScoreRing.tsx`

---

## Executive Summary

The scoring system has **10 significant issues**, including three separate scoring engines in use, conflicting tier labels across the UI, fake positional scores for unfetched results, a contribution pillar that systematically zeroes out for major developers, and organizations appearing as candidate results. The most famous developers on GitHub (torvalds, sindresorhus, trekhleb) all score below 40/100. Search result ordering is unreliable and inconsistent between queries.

**Severity:** 3 CRITICAL, 4 HIGH, 3 MEDIUM

---

## 1. Search Results Overview

### Query: "TypeScript San Francisco" (combined query)
The NL parser correctly extracts `location:"san francisco"` and `language:typescript`. However, results vary dramatically depending on GitHub API rate limits at query time.

**Run 1** (profile fetches mostly failed): 239 total, most results got fabricated positional scores.
**Run 2** (profile fetches succeeded): 239 total, results got quickScore-based scores.

### Successful Run — Full 15-Result Table (quickScore active)

| #  | Username         | Score | Tier         | Source | Followers | Repos | Notes |
|----|-----------------|-------|--------------|--------|-----------|-------|-------|
| 1  | oktadev         | 63.3  | Solid        | github | 514       | 500   | **ORGANIZATION** (Okta developer docs/samples) |
| 2  | alchemyplatform | 61.4  | Solid        | github | 1,031     | 157   | **ORGANIZATION** (Web3 platform) |
| 3  | mahseema        | 56.0  | Emerging     | local  | 6,315     | 13    | Curates awesome-lists, NOT a TypeScript dev |
| 4  | alxhub          | 55.3  | Emerging     | github | 1,221     | 76    | Angular team lead @ Google. Legit TS dev |
| 5  | voiceflow       | 55.1  | Emerging     | github | 324       | 89    | **ORGANIZATION** (AI agent platform) |
| 6  | skiff-org       | 53.0  | Emerging     | github | 990       | 17    | **ORGANIZATION** |
| 7  | scttcper        | 52.7  | Emerging     | github | 327       | 80    | Sentry eng, ngx-toastr (2.6k stars). Legit TS dev |
| 8  | XPRNetwork      | 51.9  | Emerging     | github | 166       | 73    | **ORGANIZATION** (blockchain) |
| 9  | hansl           | 50.5  | Emerging     | github | 333       | 165   | Angular CLI creator. Legit dev |
| 10 | reworkd         | 50.1  | Emerging     | github | 1,197     | 6     | **ORGANIZATION** (AI agent startup) |
| 11 | atlassian-labs  | 49.6  | Emerging     | github | 214       | 69    | **ORGANIZATION** |
| 12 | ViewBlock       | 45.4  | Emerging     | github | 225       | 16    | **ORGANIZATION** (crypto explorer) |
| 13 | ssh-pereira     | 43.3  | Emerging     | github | 216       | 16    | Unknown |
| 14 | asyncliz        | 37.7  | Limited Data | github | 187       | 9     | Google engineer. Material Design web components |
| 15 | trekhleb        | 23.7  | Limited Data | local  | 17,793    | 26    | Sr SWE @ Uber. **255,706 total stars**. Score is stale local DB value |

### Failed Run — Positional Score Fallback

When GitHub profile fetches fail (rate limiting), results 3+ degrade to fabricated scores:

| #  | Username         | Score | Tier         | Source | Followers | Notes |
|----|-----------------|-------|--------------|--------|-----------|-------|
| 1  | mahseema        | 56.0  | Emerging     | local  | 6,315     | Only local-DB result ranked correctly |
| 2  | trekhleb        | 23.7  | Limited Data | local  | 17,793    | Stale local score |
| 3  | alxhub          | 23    | Limited Data | github | 0*        | Fake score = 25 - 2 |
| 4  | reworkd         | 22    | Limited Data | github | 0*        | Fake score = 25 - 3 |
| 5  | alchemyplatform | 21    | Limited Data | github | 0*        | Fake score = 25 - 4 |

\* = Profile not fetched; all fields zero; score fabricated from `Math.max(5, 25 - positionIndex)`

**Key observation:** The same query returns completely different rankings depending on whether GitHub rate-limits the per-user profile fetches. This makes results non-reproducible.

---

## 2. Direct API Score Results

### `/api/score/torvalds` -- Linus Torvalds
**Reality:** Creator of Linux (225k stars) and Git. 293k followers. 11 public repos.

| Pillar | Score | Max | Assessment |
|--------|-------|-----|------------|
| Impact | 7.6 | 10 | Reasonable given 11 repos |
| Contribution | **0.0** | 10 | **WRONG** -- 0 external PRs detected |
| Consistency | **2.5** | 10 | **WRONG** -- 0 contributions detected |
| Technical | 4.1 | 10 | Low -- only 11 public repos, C-only |
| Reputation | 6.8 | 10 | Underscored -- 293k followers caps at 10k tier |

**Final score:** 30.5 | **Tier:** Limited Data | **Confidence:** low (0.75)

### `/api/score/sindresorhus` -- Sindre Sorhus
**Reality:** 1,100+ public repos, 78.1k followers, 449k-star "awesome" repo, 198 sponsors, full-time open sourcerer.

| Pillar | Score | Max | Assessment |
|--------|-------|-----|------------|
| Impact | 7.1 | 10 | Underscored for 449k-star repo |
| Contribution | **0.0** | 10 | **WRONG** -- 0 external PRs detected |
| Consistency | **2.5** | 10 | **WRONG** -- 0 contributions detected |
| Technical | 9.0 | 10 | Correct -- massive language diversity |
| Reputation | 6.9 | 10 | Underscored for 78.1k followers |

**Final score:** 35.0 | **Tier:** Limited Data | **Confidence:** low (0.75)

**Root cause:** `fetchContributions()` in `src/pipeline/graphql.ts` returns null or zero for both users. The Contribution pillar (25% weight) and Consistency pillar (20% weight) are zeroed, meaning 45% of the total score depends on data that isn't being retrieved.

---

## 3. Five-Developer Accuracy Assessment

### Developer 1: trekhleb (Score: 23.7 in search, stored locally)
**GitHub reality:** 17.8k followers, 6 following, 26 repos, 255k+ total stars. Sr SWE @ Uber. `javascript-algorithms` repo has 196k stars. Active contributor.
**Scout score:** 23.7 -- "Limited Data"
**Verdict: WILDLY INACCURATE.** Should be 80+ (Strong/On Fire tier). The 196k-star educational repo alone demonstrates massive impact. `totalCommits: 0` stored locally proves the scoring pipeline failed to fetch contribution data during indexing.

### Developer 2: mahseema (Score: 56 in search, stored locally)
**GitHub reality:** 6.3k followers, 10.9k following (unfavorable 0.57:1 ratio), 13 repos, curates awesome-lists (markdown, not code). "Part time Data Scientist." No TypeScript repos.
**Scout score:** 56 -- "Emerging"
**Verdict: OVERSCORED relative to peers.** Ranked above trekhleb (255k stars, Uber engineer) in both query variants. The 10.9k following vs 6.3k followers suggests follow-for-follow behavior. Primary repos are curated lists with no programming language. This is not a TypeScript developer and should not appear in results.

### Developer 3: alxhub (Score: 55.3 quickScore / 23 positional)
**GitHub reality:** Angular team lead at Google. 76 public repos, 1,200+ followers, 0 following. Core contributor to Angular framework. Multiple Pull Shark badges. TypeScript developer.
**Scout quickScore:** 55.3 -- "Emerging"
**Verdict: UNDERSCORED.** A core contributor to one of the most popular TypeScript frameworks deserves 70+. The quickScore has no way to account for his massive impact on the Angular project since it ignores stars and contributions.

### Developer 4: scttcper (Score: 52.7 quickScore)
**GitHub reality:** Engineer at Sentry. 80 public repos, 327 followers, 59 following. `ngx-toastr` has 2.6k stars. Member of @getsentry. Primarily TypeScript. Based in San Francisco.
**Scout quickScore:** 52.7 -- "Emerging"
**Verdict: REASONABLE but understated.** A solid working engineer with 4k+ combined stars across Angular TypeScript packages. The quickScore is in the right ballpark but ignores his star count entirely.

### Developer 5: torvalds (Score: 30.5 via /api/score)
**GitHub reality:** Creator of Linux (225k stars) and Git. 293k followers. The most influential developer in computing history.
**Scout score:** 30.5 -- "Limited Data"
**Verdict: ABSURDLY INACCURATE.** Score is lower than mahseema (a part-time data scientist who curates markdown lists). The scoring engine cannot detect his contributions because (a) he works via email-based patch workflows, not GitHub PRs, and (b) the GraphQL contribution data is returning zero. The reputation pillar gives only 6.8/10 for 293k followers because the tiered scale tops out at `[10000, 10]`.

---

## 4. Critical Issues

### CRIT-1: Fake Positional Scores for Unfetched GitHub Users
**File:** `src/app/api/search/route.ts:547-568`
**Description:** When a GitHub user's full profile cannot be fetched (rate limit or other failure), the score is set to `Math.max(5, 25 - positionIndex)`. This creates descending sequential scores (23, 22, 21, 20...) that have zero correlation with actual developer quality.
**Impact:** During rate-limited periods, most search results display fabricated scores. Users cannot distinguish real scores from fake ones. The same developer's score changes arbitrarily between searches depending on API availability. A developer ranked 3rd by GitHub's relevance algorithm gets score 23 regardless of whether they have 0 or 200k stars.
**Reproducibility:** Observed in multiple consecutive test runs. The bug is transient -- it depends on GitHub API rate limit state.

### CRIT-2: Three Separate Scoring Systems with Conflicting Tier Labels
**Files:**
- `src/lib/scoring.ts` (`computeScore`) -- used by `/api/score/[username]` and `src/pipeline/github.ts`
- `src/lib/scoring/engine.ts` (`calculateScore`) -- used by `/api/search/deep` and `/api/cron/index-developers`
- `src/app/api/search/route.ts` (`quickScore`) -- used by GET `/api/search` for live results

| System | Scoring Approach | Tier Names | Used By |
|--------|-----------------|------------|---------|
| `computeScore` | 5-pillar, full GraphQL | Elite / Strong / Solid / Emerging / Limited Data | `/api/score`, pipeline |
| `calculateScore` | 5-pillar, different weights | Unicorn / On Fire / Gem / Seedling / Mystery | Deep search, cron indexer |
| `quickScore` | followers + repos only | Elite / Strong / Solid / Emerging / Limited Data | Live search GET |

**UI tier mismatch:**

| Component | Tiers Used | Source |
|-----------|-----------|--------|
| `TierBadge.tsx` | Unicorn / On Fire / Gem / Seedling / Mystery | Computes from score |
| `ScoreRing.tsx` | Unicorn / On Fire / Gem / Seedling / Mystery | Via `getTierInfo()` |
| `DeveloperCard.tsx` TIER_ACCENTS | Elite / Strong / Solid / Emerging | From API response |
| `DeveloperCard.tsx` score color | Elite / Strong | From API response |
| `ScoreBreakdown.tsx` TIER_CONFIG | Elite / Strong / Solid / Emerging / Limited Data | From API response |

**Result:** A developer with score 65 gets:
- "Solid" border accent in DeveloperCard (from API tier field)
- "Gem" emoji and label in TierBadge (computed from score)
- "Solid" styling in ScoreBreakdown (from API tier field)
- "Gem" label in ScoreRing (computed from score)

The same developer shows two different tier names on the same page.

### CRIT-3: GraphQL Contribution Data Returns Null/Zero for Major Developers
**File:** `src/pipeline/graphql.ts`
**Evidence:** torvalds and sindresorhus both show `totalCommits: 0`, `recentActivity: 0`, `externalMergedPRs: 0` via `/api/score/`. The `fetchContributions()` function either fails silently or returns null, causing the Contribution pillar (25% weight) to score 0 and the Consistency pillar (20% weight) to collapse.
**Impact:** 45% of the total score depends on data that isn't being retrieved. This affects the `/api/score/` endpoint and any profiles scored through the pipeline. The trekhleb local DB entry also shows `totalCommits: 0`, confirming the pipeline had the same issue during indexing.

---

## 5. High-Severity Issues

### HIGH-1: Contribution Pillar Systematically Penalizes Project Maintainers
**File:** `src/lib/scoring.ts:87-108`
External merged PRs are weighted at 70% of the Contribution pillar (25% of total = 17.5% of final score). But project owners and maintainers (torvalds, sindresorhus) don't submit PRs to other projects -- they RECEIVE them. The "#1 signal for engineering quality" actually anti-correlates with being an influential maintainer.

**Recommendation:** Add "received PRs" or "maintained repos with external contributors" as a balancing signal.

### HIGH-2: Reputation Pillar Follower Scale Caps Too Low
**File:** `src/lib/scoring.ts:184-185`
The follower tiers top out at `[10000, 10]`. Torvalds has 293,000 followers and sindresorhus has 78,100 -- both cap at the same score as someone with 10,001. There's no differentiation in the top 0.01%.

The follower-to-following ratio bonus caps at 3 points for ratio >= 10. Torvalds' ratio is infinity (0 following) and gets the same bonus as someone with 110 followers / 10 following.

### HIGH-3: Organizations Returned as Candidate Results
**Evidence from successful search run:**
- oktadev (#1, score 63.3) -- Okta developer program org
- alchemyplatform (#2, score 61.4) -- Web3 platform org
- voiceflow (#5, score 55.1) -- AI agent platform org
- skiff-org (#6, score 53.0) -- Email privacy org
- XPRNetwork (#8, score 51.9) -- Blockchain org
- reworkd (#10, score 50.1) -- AI startup org
- atlassian-labs (#11, score 49.6) -- Atlassian open source org
- ViewBlock (#12, score 45.4) -- Crypto explorer org

**8 of 15 results are organizations, not individual developers.** A talent sourcing tool should not present organizations as hirable candidates. GitHub's `/search/users` API returns both users and orgs. The app needs to filter by adding `type:user` to the GitHub query.

### HIGH-4: Search Sort Order Is Non-Deterministic and Mixes Incompatible Score Sources
**File:** `src/app/api/search/route.ts:577`
Results are sorted by `score` descending, but scores mix three incompatible sources:
1. **Local DB scores** -- may be months stale, computed by `computeScore` with potentially null contribution data
2. **quickScore** -- shallow estimate using only followers + repos + ratio (no stars, no commits, no contributions)
3. **Position scores** -- fabricated `25 - index` values when profile fetches fail

This means:
- The same search produces different rankings depending on API rate limit state
- trekhleb (255k stars, Uber engineer) ranks below mahseema (awesome-list curator) because his stale local score (23.7) is lower than her stale local score (56)
- Organizations with high repo counts rank above individual engineers

---

## 6. Medium-Severity Issues

### MED-1: quickScore Ignores Stars Entirely
**File:** `src/app/api/search/route.ts:365-377`

```javascript
// quickScore formula
followerSignal * 0.45 + repoSignal * 0.30 + ratioBonus + profileBonus
```

Uses: followers, public_repos, follower/following ratio, profile completeness (bio, email, blog, hireable).
**Ignores:** Stars, forks, language match, contribution activity, commit count.

A developer with 200k total stars but 500 followers would score ~48. An org with 0 stars but 2,000 followers and 500 repos would score ~63. The formula cannot distinguish impactful engineers from inactive accounts with many followers.

### MED-2: Confidence Modifier Creates a Hard Score Ceiling
**File:** `src/lib/scoring.ts:211-228`

| Confidence | Modifier | Max Possible Score |
|------------|----------|-------------------|
| low        | 0.75     | 75 (just barely "Strong") |
| medium     | 0.90     | 90 (just barely "Elite") |
| high       | 1.00     | 100 |

Low confidence requires < 5 non-fork repos OR < 50 contributions. Developers who primarily work in private repos, use forks, or have paused contributions are permanently capped. This affects torvalds (11 public repos but minimal GitHub-visible contributions) who gets low confidence despite being the most impactful developer alive.

### MED-3: Impact Pillar Per-Repo Star Cap Limits Recognition of Viral Repos
**File:** `src/lib/scoring.ts:63-71`
Each repo's star contribution is capped at `maxSingleRepoContribution = 4` (out of 10). The tiered scoring gives 6 points for 10,000+ stars, but caps at 4. This means:
- trekhleb's 196k-star repo contributes 4 points
- sindresorhus's 449k-star repo contributes 4 points
- A repo with ~500 stars contributes 3 points (capped at 4 anyway)

The design intent (prevent single-repo inflation) is reasonable, but the cap is too aggressive for genuinely exceptional repos. There's only a 1-point difference between a 500-star repo and a 449k-star repo.

---

## 7. Tier Badge Audit

### Three independent tier-label systems coexist:

| Component | Tier Names | Ranges | Source of Tier |
|-----------|-----------|--------|----------------|
| `scoring.ts` (API) | Elite / Strong / Solid / Emerging / Limited Data | 90/75/60/40 | `getTier(score)` |
| `scoring/engine.ts` (deep) | Unicorn / On Fire / Gem / Seedling / Mystery | 90/75/60/40 | `getTier(score)` |
| `TierBadge.tsx` (UI) | Unicorn / On Fire / Gem / Seedling / Mystery | 90/75/60/40 | `getTierInfo(score)` |
| `ScoreRing.tsx` (UI) | Uses TierBadge's `getTierInfo` | 90/75/60/40 | Via `getTierInfo` |
| `ScoreBreakdown.tsx` TIER_CONFIG | Elite / Strong / Solid / Emerging / Limited Data | N/A (key lookup) | From API `data.tier` |
| `DeveloperCard.tsx` TIER_ACCENTS | Elite / Strong / Solid / Emerging | N/A (key lookup) | From API `devAny.tier` |

**Score ranges are consistent** (90/75/60/40 breakpoints everywhere), but **labels are split into two naming conventions** that appear side-by-side in the UI.

**Concrete example:** Developer with score 65:
- API returns `tier: "Solid"`
- DeveloperCard renders border accent for "Solid" (emerald) -- correct
- DeveloperCard renders `<TierBadge score={65}>` which shows "Gem" emoji -- **mismatch**
- Profile ScoreBreakdown uses TIER_CONFIG["Solid"] for styling -- correct
- Profile ScoreRing shows "Gem" label from `getTierInfo(65)` -- **mismatch**

---

## 8. Profile Page Score Breakdown -- 5 Pillars

The profile page at `/profile/[username]` renders `<ScoreBreakdown>`, which:

1. **Fetches live** from `/api/score/{username}` (calls `computeScore` from `scoring.ts`)
2. **Displays ScoreRing** with animated score count-up to X/100
3. **Shows confidence indicator** (high/medium/low) with color-coded badge and explanation text
4. **Renders all 5 pillars** as horizontal animated bars:
   - Impact (TrendingUp icon, orange bar) -- Stars, forks, community validation
   - Contribution Quality (GitPullRequest icon, violet bar) -- Merged PRs to external repos, code reviews
   - Consistency (Activity icon, sky bar) -- Activity regularity and recency
   - Technical Depth (Code2 icon, emerald bar) -- Language breadth, repo complexity
   - Reputation (Users icon, pink bar) -- Followers, community standing
5. **Shows key stats footer:** External PRs, Commits (12mo), Contributions
6. Each pillar shows `score/max` with hover description

**Structural verdict:** The 5-pillar breakdown UI is well-designed and functional. All 5 pillars ARE visible. The problem is the data feeding it (CRIT-3: zero contributions for major developers), not the display.

**Tier label collision on profile page:** The ScoreRing inside ScoreBreakdown shows tier names from `getTierInfo()` (Unicorn/On Fire/Gem/Seedling/Mystery) while the ScoreBreakdown card itself uses TIER_CONFIG keyed to scoring.ts tier names (Elite/Strong/Solid/Emerging/Limited Data) for glow and color styling.

---

## 9. Is Result #1 Better Than Result #10?

### Successful query (quickScore active):

**Result #1:** oktadev -- Score 63.3, "Solid"
- An **organization** (Okta Developer), not a person
- 514 followers, 500 repos (inflates repoSignal in quickScore)
- Publishes example apps and docs, not a hirable candidate
- Not even a candidate at all -- this is a corporate dev-rel account

**Result #10:** reworkd -- Score 50.1, "Emerging"
- An **organization** (AI agent startup), not a person
- 1,197 followers, 6 repos
- Also not a hirable candidate

**Neither result is a valid hire target.** Both are organizations.

### Failed query (positional scores):

**Result #1:** mahseema -- Score 56, "Emerging"
- A real person, but curates awesome-lists (markdown), not a TypeScript developer

**Result #10:** voiceflow -- Score 16, "Limited Data"
- An organization with a fabricated positional score

### Buried quality result:

**Result #15:** trekhleb -- Score 23.7, "Limited Data"
- Sr SWE @ Uber, 17.8k followers, 255k+ stars
- Actually qualifies as a strong TypeScript developer
- Ranked LAST due to stale local DB score

**Conclusion:** Result #1 is NOT better than result #10 or result #15 in any meaningful sense for talent sourcing. The ranking is wrong in kind (orgs vs. people) and wrong in degree (list curators above elite engineers).

---

## 10. Scoring System Architecture Summary

```
                    +-------------------+
                    |  /api/search GET  |
                    |  (live search)    |
                    +--------+----------+
                             |
                    +--------v----------+
                    |   quickScore()    |  <-- Shallow: followers + repos only
                    |  search/route.ts  |      Tiers: Elite/Strong/Solid/...
                    +-------------------+
                             |
                    Fallback if profile fetch fails:
                    +-------------------+
                    | positionScore =   |  <-- Fabricated: 25 - index
                    | 25 - index        |      Tier: "Limited Data"
                    +-------------------+

                    +-------------------+
                    | /api/score/[user] |
                    | (profile page)    |
                    +--------+----------+
                             |
                    +--------v----------+
                    |  computeScore()   |  <-- Full 5-pillar w/ GraphQL
                    |  lib/scoring.ts   |      Tiers: Elite/Strong/Solid/...
                    +-------------------+      BUT GraphQL often returns null

                    +-------------------+
                    | /api/search/deep  |
                    | /api/cron/index   |
                    +--------+----------+
                             |
                    +--------v----------+
                    | calculateScore()  |  <-- Full 5-pillar, different weights
                    | scoring/engine.ts |      Tiers: Unicorn/On Fire/Gem/...
                    +-------------------+
```

---

## 11. Recommendations (Priority Order)

1. **CRIT-3 Fix (highest impact):** Investigate `fetchContributions()` -- why does it return null/zero for torvalds and sindresorhus? Add error logging, verify GITHUB_TOKEN has GraphQL scope, add retry logic. This single fix would recover 45% of the scoring signal.

2. **CRIT-2 Fix:** Consolidate to one tier naming system. Pick either Elite/Strong/Solid/Emerging/Limited Data OR Unicorn/On Fire/Gem/Seedling/Mystery. Update `scoring.ts`, `engine.ts`, `TierBadge.tsx`, `ScoreBreakdown.tsx`, and `DeveloperCard.tsx` to use the same labels.

3. **HIGH-3 Fix:** Filter organizations from search results. Add `type:user` to the GitHub search query in `buildGitHubQuery()`. This would eliminate 8/15 bad results from the test query.

4. **CRIT-1 Fix:** Never display fabricated positional scores. Options:
   - Queue failed fetches for async retry and mark results as "unscored"
   - Use a minimum score of 0 with an "unscored" badge instead of fake numbers
   - Batch the profile fetches with backoff to avoid rate limits

5. **HIGH-4 Fix:** Don't mix incompatible score sources in a single sorted list. Either score all results with the same method, or segment "scored" vs "unscored" results in the UI.

6. **HIGH-1 Fix:** Add "maintainer signal" -- repos with high external contributor count should boost the Contribution pillar for owners. Also consider "received PR count" for major repos.

7. **HIGH-2 Fix:** Extend follower tiers beyond 10k (e.g., add `[50000, 10]` and `[100000, 10]` or use continuous log scale).

8. **MED-1 Fix:** Include total stars in quickScore. Stars are available from the fetched user profiles and dramatically improve signal quality.

9. **MED-2 Fix:** Soften the confidence modifier -- use 0.85 instead of 0.75 for low confidence, or apply it only to the contribution/consistency pillars that lack data rather than the entire score.

10. **MED-3 Fix:** Raise the per-repo star cap from 4 to 6, or use a softer diminishing returns curve (`Math.sqrt(repoStarScore)`) instead of a hard cap.

---

## Appendix A: Raw API Responses

### /api/score/torvalds
```json
{
  "username": "torvalds",
  "score": 30.5,
  "tier": "Limited Data",
  "confidence": "low",
  "confidenceValue": 0.75,
  "externalMergedPRs": 0,
  "totalCommits": 0,
  "recentActivity": 0,
  "pillars": {
    "impact": { "score": 7.6, "max": 10, "label": "Impact" },
    "contribution": { "score": 0, "max": 10, "label": "Contribution Quality" },
    "consistency": { "score": 2.5, "max": 10, "label": "Consistency" },
    "technical": { "score": 4.1, "max": 10, "label": "Technical Depth" },
    "reputation": { "score": 6.8, "max": 10, "label": "Reputation" }
  }
}
```

### /api/score/sindresorhus
```json
{
  "username": "sindresorhus",
  "score": 35,
  "tier": "Limited Data",
  "confidence": "low",
  "confidenceValue": 0.75,
  "externalMergedPRs": 0,
  "totalCommits": 0,
  "recentActivity": 0,
  "pillars": {
    "impact": { "score": 7.1, "max": 10, "label": "Impact" },
    "contribution": { "score": 0, "max": 10, "label": "Contribution Quality" },
    "consistency": { "score": 2.5, "max": 10, "label": "Consistency" },
    "technical": { "score": 9, "max": 10, "label": "Technical Depth" },
    "reputation": { "score": 6.9, "max": 10, "label": "Reputation" }
  }
}
```

## Appendix B: quickScore Formula Analysis

```javascript
function quickScore(user) {
  const followerSignal = Math.min(10, Math.log(1 + user.followers) / Math.log(1 + 500) * 5);
  const repoSignal = Math.min(10, Math.log(1 + user.public_repos) / Math.log(1 + 50) * 5);
  const ratio = user.following > 0 ? user.followers / user.following : user.followers;
  const ratioBonus = ratio >= 5 ? 1 : ratio >= 2 ? 0.5 : 0;
  const profileBonus = (user.bio ? 0.3 : 0) + (user.email ? 0.2 : 0)
                     + (user.blog ? 0.2 : 0) + (user.hireable ? 0.3 : 0);
  const raw = followerSignal * 0.45 + repoSignal * 0.30 + ratioBonus + profileBonus;
  const score = Math.round(Math.min(100, raw * 10) * 10) / 10;
  return { score, tier };
}
```

**Max theoretical score:** ~95 (requires 50k+ followers AND 500+ repos AND ratio >= 5 AND full profile)
**Typical developer score:** 40-55 (500 followers, 50 repos = ~48)
**Org score inflation:** Organizations with 500+ repos get high repoSignal regardless of code quality

**Missing signals:** stars (0% weight), commits (0%), contributions (0%), language match (0%), recency (0%)
