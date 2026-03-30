# Scout Search Deep-Dive QA
# Run each agent in a separate terminal tab
# Make sure dev server is running first: cd ~/gitscout && npm run dev

## Setup (run once before launching agents)
```bash
cd ~/gitscout
npm install -D @playwright/test
npx playwright install chromium
mkdir -p qa-reports/search-deep-dive
mkdir -p qa-reports/screenshots
```

---

## AGENT 1: Search Query Quality
# Tests whether the search actually returns relevant, high-quality developers

```bash
cd ~/gitscout && claude "You are a senior QA engineer doing a deep audit of Scout's search quality. The app is running at http://localhost:3000. Use Playwright to run REAL searches and evaluate the quality of results.

Install Playwright if needed. Create tests in tests/qa-search-quality/.

Run ALL of these exact searches and document what comes back:

SEARCH SET 1 — Language + Location combos:
1. TypeScript developers in San Francisco
2. Python developers in Austin
3. Rust developers in Berlin
4. Go developers in Seattle
5. React developers in New York (note: React is a framework not a language — does the search handle this?)
6. Machine learning engineers (no location)
7. Developers in Buenos Aires (no language)

For EACH search, capture and document:
- How many results returned? (0 is a critical bug)
- How long did results take to appear? (measure from click to first result)
- Do the results actually match the query? (a TypeScript search should return TypeScript developers, not random profiles)
- What data shows on each result card? List every field visible
- Are results sorted? By what? Is the sort order sensible?
- Do any results have scores/tier badges? If so, are they reasonable?
- Do results have email indicators?
- Do results have location data that matches the search?
- Do results have language/skill tags that match the search?
- Click the top 3 results — do the profile pages load?

SEARCH SET 2 — Edge cases:
8. Search with empty fields (just click search with nothing)
9. Search for 'javascript' — does it return results? Are they different from 'typescript'?
10. Search for 'San Francisco' vs 'SF' vs 'Bay Area' — do they return the same results?
11. Search for a specific GitHub username directly (try 'torvalds')
12. Search for a language that doesn't exist ('FakeLanguage123')
13. Search for a real but niche language ('Elixir in Portland')
14. Type a search, wait for results, then immediately type a new search — any race conditions?
15. Run the same search twice — are results identical? (consistency check)

SEARCH SET 3 — Are we finding unicorns?
16. Search for TypeScript + San Francisco, sort by whatever options exist
    - Look at the TOP result. Google their GitHub profile manually. Are they actually good?
    - Look at result #10. Same check. Are they actually relevant?
    - Look at the LAST result. Is it garbage or still relevant?
17. Search for Python + Machine Learning
    - Are any results contributors to PyTorch, TensorFlow, or HuggingFace? (they should be)
    - Or are results just people who have 'python' in their bio?

Write an extremely detailed report to qa-reports/search-deep-dive/query-quality-report.md with:
- A table for every search showing: query, result count, load time, relevance score (1-10 your assessment), top issues
- Specific examples of good results vs bad results
- Whether the search is actually finding high-quality developers or just keyword-matching bios
- Exact gaps identified
- Ranked list of improvements needed"
```

---

## AGENT 2: Search API Pipeline Audit
# Tests the actual API layer — what's the search hitting, what data comes back

```bash
cd ~/gitscout && claude "You are a backend QA engineer auditing Scout's search API pipeline. The app is running at http://localhost:3000.

Your job is to understand EXACTLY what happens when a search is executed. Trace the entire flow from request to response.

STEP 1 — Read the search source code:
- Read src/app/api/search/route.ts (or wherever the search API lives)
- Read any files it imports — the GitHub client, scoring engine, search utilities
- Find and read: lib/github/client.ts, lib/scoring/engine.ts, lib/search/ directory
- Document the ENTIRE search flow: what API calls does it make to GitHub? What parameters? What does it do with the results?

STEP 2 — Make direct API calls and inspect responses:
Use fetch() in a Playwright test or Node script to call the search API directly:

Test 1: POST /api/search with {language: 'typescript', location: 'san francisco'}
- Log the FULL response JSON
- How many results?
- What fields are on each result?
- Is there a 'source' field (quick vs deep)?
- Are there scores? If so, what's the range?
- How long does the API take to respond?

Test 2: POST /api/search with {language: 'python', location: 'austin'}
- Same analysis

Test 3: POST /api/search with {roleCategory: 'frontend', location: 'seattle'}
- Does roleCategory trigger a different search path?
- Does it use seed repos?

Test 4: POST /api/search with just {location: 'buenos aires'}
- Does location-only search work?

Test 5: Hit the GitHub API directly from a test script with the same queries
- Compare: what does GitHub's Search Users API actually return for 'language:typescript location:san francisco'?
- Compare those results against what Scout returns
- Are they the same? Different? Better? Worse?

STEP 3 — Identify the bottlenecks:
- Is the search using GitHub's Search Users API? Search Repos API? Both?
- Is it using GraphQL for contributions data? Or only REST?
- Is there any caching? Check if repeated searches are faster
- Is the scoring engine running on results? Or are results unscored?
- Is the deep pipeline (repo contributor mining) implemented? Or just quick search?
- Is there a Supabase pre-index being queried? Or is everything live API?

STEP 4 — Check what's implemented vs missing:
Read the codebase and check which of these exist and actually work:
- [ ] Quick search pipeline (GitHub Search Users API)
- [ ] Deep search pipeline (repo contributor mining)
- [ ] Scoring engine (5-pillar calculation)
- [ ] Supabase caching of profiles
- [ ] Supabase pre-index of developers
- [ ] Location fuzzy matching
- [ ] Seed repos configuration
- [ ] SSE streaming of results
- [ ] Rate limiting / backoff
- [ ] GraphQL enrichment of profiles

Write an extremely detailed technical report to qa-reports/search-deep-dive/pipeline-audit-report.md with:
- Complete flow diagram of what currently happens during a search
- What GitHub API endpoints are being called with what parameters
- What's implemented vs what's stubbed vs what's completely missing
- Response time breakdown (where is time being spent?)
- The exact reason results are or aren't high quality
- Specific code changes needed to improve results, with file paths and line numbers"
```

---

## AGENT 3: Search Results UI/UX Audit
# Tests the frontend rendering, interactions, and user experience of search

```bash
cd ~/gitscout && claude "You are a UX-focused QA engineer auditing Scout's search results interface. The app is running at http://localhost:3000. Use Playwright for all testing.

Install Playwright if needed. Create tests in tests/qa-search-ux/.

PART 1 — Search Page State Audit:
Navigate to /search and document:
- What does the page look like BEFORE a search? Screenshot it.
- Is there a search bar? What's the placeholder text?
- Are there filter controls? List every filter available (dropdowns, toggles, text inputs)
- Are there role preset cards/chips? What roles are listed?
- Is there any suggestion or autocomplete behavior?
- What happens when you click Search with empty fields?

PART 2 — Run a search for 'TypeScript San Francisco' and audit the results:
- Screenshot the full results page
- How many results show?
- Is there a results count displayed?
- Is there a sort dropdown? What sort options exist?
- Is there pagination or infinite scroll?

For the result CARDS specifically, document every single field shown:
- Avatar? (yes/no, correct size?)
- Name? (yes/no, truncated?)
- Username? (yes/no)
- Bio? (yes/no, how many lines?)
- Location? (yes/no, matches search?)
- Languages/skills? (yes/no, shown as tags?)
- Stars count? (yes/no)
- Followers count? (yes/no)
- Scout score? (yes/no, with ring animation?)
- Tier badge/emoji? (yes/no)
- Email indicator? (yes/no)
- Hireable badge? (yes/no)
- Last active date? (yes/no)
- Save button? (yes/no, does it work?)
- Any other fields?

What's MISSING from the cards that should be there?
- Score breakdown?
- Quick-action buttons (save, copy email)?
- Source indicator (quick match vs deep match)?
- Top repos preview?
- Contribution count?

PART 3 — Search Results Interactions:
- Click a result card — where does it go? Does the profile page load?
- Click Save on a result — what happens? Toast? Visual change?
- Is there a 'Copy Email' action on the card?
- Can you select multiple results for bulk actions?
- Can you export results?
- Click browser Back from a profile — do results still show or do you lose them?

PART 4 — Loading & Animation States:
- During search, what loading state shows? (spinner, skeleton, radar animation, nothing?)
- Do loading messages rotate? What do they say?
- Do results animate in (stagger/cascade)? Or pop in all at once?
- Is there a score ring animation on cards?
- Are tier emojis visible?

PART 5 — Filter Behavior:
- Change language filter and re-search — do results update?
- Change location and re-search — do results update?
- Are filters preserved when you navigate away and come back?
- Can you clear all filters?
- Is there an advanced filter panel?

PART 6 — Responsive & Visual:
- Screenshot results at 1440px (desktop)
- Screenshot results at 1280px (laptop)
- Screenshot results at 768px (tablet)
- Screenshot results at 375px (mobile)
- Any overflow, truncation, or broken layout at any width?
- Is the dark theme consistent? Any white flashes or mismatched colors?
- Are card borders, spacing, and typography consistent?

Write an extremely detailed report to qa-reports/search-deep-dive/ui-ux-report.md with:
- Screenshots of every state (empty, loading, results, error)
- Complete inventory of what each result card shows
- What's missing from the UI that recruiters need
- All visual bugs found
- Responsive issues
- Interaction bugs
- Ranked list of UI improvements needed"
```

---

## AGENT 4: Search Performance & Reliability
# Tests speed, caching, rate limits, error handling under stress

```bash
cd ~/gitscout && claude "You are a performance QA engineer stress-testing Scout's search. The app is running at http://localhost:3000. Use Playwright and direct fetch calls.

Create tests in tests/qa-search-performance/.

PART 1 — Speed Benchmarks:
Run each search 3 times and record the response time for each:
1. TypeScript + San Francisco — time to first result on screen
2. Python + Austin — time to first result
3. Go + Seattle — time to first result
4. Empty search (no filters) — time to response
5. Rust + Berlin — time to first result

For each, measure:
- API response time (network tab / fetch timing)
- Time to first result card rendered on screen (Playwright DOM timing)
- Time to all results rendered
- Total page weight (JS bundle + API responses)

What's the acceptable target? Under 2 seconds for quick results, under 10 seconds for deep results.

PART 2 — Caching Behavior:
1. Run 'TypeScript San Francisco' search
2. Note the response time
3. Immediately run the EXACT same search again
4. Is it faster? (if yes, caching works. If same speed, no caching)
5. Run it a third time — consistent?
6. Wait 60 seconds, run again — still cached?
7. Check Supabase api_cache table — are results being stored?
8. Check localStorage — anything cached client-side?

PART 3 — Rate Limiting:
1. Fire 10 searches in rapid succession (1 per second)
   - Do all complete? Any failures?
   - Any 429 (rate limit) responses?
   - Does the UI handle failures gracefully?
2. Fire 30 searches in rapid succession
   - Same checks
   - Does the GitHub API rate limit get hit?
   - If rate limited, does the app show a user-friendly message?
3. Check: is there a rate limit display anywhere in the UI or API response headers?

PART 4 — Error Scenarios:
1. Disconnect network (or mock network failure) during search — what happens?
2. If GitHub API returns 403 (rate limited) — what does the user see?
3. If GitHub API returns 500 — what does the user see?
4. If Supabase is unreachable — does search still work (fallback to live API)?
5. If the GITHUB_TOKEN env var is missing — what error shows?
6. Search that returns 0 results — what does the user see?

PART 5 — Memory & Leaks:
1. Run 20 consecutive searches without page refresh
   - Monitor memory usage (if possible via Playwright CDP)
   - Does the page slow down?
   - Any DOM node accumulation (zombie result cards)?
2. Open 5 profile pages from results, use back button each time
   - Any memory growth?
   - Results still intact after navigating back?

PART 6 — Concurrent Usage:
1. Open 3 browser tabs, run different searches simultaneously
   - Do all 3 complete correctly?
   - Any cross-contamination of results?
2. Start a search, navigate away before it completes, navigate back
   - Is the old search still running?
   - Any orphaned requests?

Write report to qa-reports/search-deep-dive/performance-report.md with:
- Speed benchmark table (query, attempt 1/2/3 times, average)
- Caching verdict: working / not working / partial
- Rate limiting verdict: handled / not handled / crashes
- Error handling verdict per scenario
- Memory behavior assessment
- All performance recommendations ranked by impact"
```

---

## AGENT 5: Search Scoring & Ranking Audit
# Tests whether the scoring engine is actually running and producing good rankings

```bash
cd ~/gitscout && claude "You are a data quality engineer auditing Scout's developer scoring and ranking system. The app is running at http://localhost:3000.

PART 1 — Is scoring implemented?
1. Run a search for 'TypeScript San Francisco'
2. Look at the results — do ANY results have a Scout score displayed?
3. If yes: what's the score range across results? (all 0s = broken, all same = broken, varied = working)
4. If no: check if /api/score/{username} endpoint exists. Hit it directly for a few usernames from search results.
5. Read the scoring engine source code: find lib/scoring/ or wherever scores are calculated
6. Is the scoring engine being CALLED during search? Or does it exist but isn't wired in?

PART 2 — Score accuracy check:
Pick 5 developers from search results. For each one:
1. Note their Scout score (if any)
2. Visit their actual GitHub profile (https://github.com/{username})
3. Manually check:
   - How many stars do their repos have?
   - How many followers?
   - How active are they? (contribution graph)
   - Do they contribute to major OSS projects?
   - What languages do they use?
4. Does their Scout score feel right given their actual GitHub presence?
5. Would a recruiter agree this person is ranked correctly relative to the others?

PART 3 — Ranking order:
1. Search for 'Python Austin' — get the results
2. Is result #1 actually better than result #10? Check both profiles manually.
3. Is result #1 better than result #20? 
4. What signal is the sort actually using? (followers? score? random?)
5. If results are sorted by followers: that's the problem. Followers ≠ engineering quality.
6. Are there developers with high stars but low followers being ranked too low?
7. Are there developers with high followers but empty repos being ranked too high?

PART 4 — Tier badge verification:
1. Find any result with a tier badge (unicorn 🦄, fire 🔥, gem 💎, seedling 🌱, mystery 🌫️)
2. Does the badge match the score range?
   - 90-100 should be unicorn
   - 75-89 should be fire
   - 60-74 should be gem
   - 40-59 should be seedling
   - 0-39 should be mystery
3. If no badges showing: is the TierBadge component imported and used in result cards?

PART 5 — Score breakdown:
1. Navigate to a developer profile page
2. Is there a score breakdown panel showing the 5 pillars?
   - Impact score?
   - Contribution Quality score?
   - Consistency score?
   - Technical Depth score?
   - Reputation score?
3. If yes: do the pillar scores add up correctly to the total (with weights 30/25/20/15/10)?
4. If no: is the ScoreRing component on the profile page? Is it receiving data?

PART 6 — What's determining search result ORDER right now?
Read the search API source code and determine:
- What field are results being sorted by?
- Is it GitHub's default 'best match' sort?
- Is it followers?
- Is it the Scout score?
- Or is it unsorted (random order from API)?
- Is there a sort dropdown in the UI? Does changing it actually re-sort?

Write report to qa-reports/search-deep-dive/scoring-ranking-report.md with:
- Whether scoring is implemented, wired in, and producing results
- Manual accuracy assessment of 5 developer scores
- Whether ranking order makes sense for recruiters
- Specific gaps between current ranking and ideal ranking
- What signal is ACTUALLY determining sort order
- Exact code changes needed to fix ranking, with file paths"
```

---

## AFTER ALL 5 COMPLETE — Summary Agent

```bash
cd ~/gitscout && claude "Read all 5 reports in qa-reports/search-deep-dive/:
- query-quality-report.md
- pipeline-audit-report.md
- ui-ux-report.md
- performance-report.md
- scoring-ranking-report.md

Create a comprehensive search optimization plan at qa-reports/search-deep-dive/SEARCH-OPTIMIZATION-PLAN.md with:

1. CURRENT STATE: One paragraph summary of where search is right now
2. CRITICAL ISSUES: Bugs that make search broken or useless (fix today)
3. SEARCH QUALITY GAPS: Why results aren't finding unicorns (fix this week)
4. SCORING GAPS: What's missing or broken in the scoring pipeline
5. UI GAPS: What the results page is missing that recruiters need
6. PERFORMANCE ISSUES: Speed and reliability problems
7. IMPLEMENTATION STATUS: Checklist of what's built vs missing:
   - [ ] Quick search pipeline
   - [ ] Deep search pipeline (repo contributor mining)
   - [ ] 5-pillar scoring engine
   - [ ] Score displayed on result cards
   - [ ] Tier badges on result cards
   - [ ] Location fuzzy matching
   - [ ] Seed repos for role categories
   - [ ] Supabase pre-indexing
   - [ ] Caching layer
   - [ ] SSE streaming
   - [ ] Search history tracking
8. OPTIMIZATION ROADMAP: Exact steps to fix search, in priority order, with file paths and what to change
9. BEFORE/AFTER VISION: What search looks like today vs what it should look like after fixes

Be extremely specific. No vague recommendations. Every item should have a file path, a description of the change, and an estimated complexity (small/medium/large)."
```
