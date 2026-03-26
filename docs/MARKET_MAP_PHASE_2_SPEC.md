# GitScout Market Map — Phase 2 Build Spec

## Context

Phase 1 built the core market map: Supabase schema, Apollo People Search integration, Claude company suggestion, candidate classification, and the enrichment pipeline. The map generates, populates with real data, and the recruiter can browse companies and candidates by tier.

Phase 2 makes the map a tool the recruiter actually works IN — not just looks at. Three features, in this order:

1. Map editing (drag-and-drop tiers, add/remove companies, candidate status, bulk actions)
2. Flight risk signals (composite intelligence from tenure + news + job postings)
3. Saved map templates (reuse maps, clone + refresh, map history)

Read the existing codebase thoroughly before starting. Understand the schema from Phase 1, how the enrichment pipeline works, and how the frontend renders map data. Don't duplicate logic that already exists.

---

## Feature 1: Map Editing

This is the recruiter's override layer. The AI suggests, the recruiter refines. Every edit persists in Supabase and survives page refreshes.

### 1A: Drag-and-Drop Tier Reassignment

**What it does:** Recruiter drags a company card from Tier B to Tier A (or any tier to any other). The card animates to its new position, tier stats recalculate instantly.

**Frontend implementation:**
- Use a lightweight drag solution. Options in order of preference:
  1. `@dnd-kit/core` + `@dnd-kit/sortable` (most popular React DnD library, tree-shakeable)
  2. Native HTML5 drag and drop (no dependency, but less polished on mobile)
  3. `react-beautiful-dnd` (deprecated but still works)
- Each tier column is a droppable zone
- Each company card is a draggable item
- On drag start: card gets a slight scale-up (1.02) and shadow to indicate it's "lifted"
- On drag over a different tier: that tier's column gets a subtle highlight border
- On drop: optimistic UI update (move the card immediately), then PATCH to Supabase

**Backend:**
```
PATCH /api/market-map/[mapId]/company/[companyId]
Body: { "tier": "A" }
```
This route already exists from Phase 1 (or should). It needs to:
- Update `map_companies.tier` to the new value
- Set `map_companies.tier_override = true`
- Return the updated company

The `tier_override = true` flag is important: if the recruiter later refreshes the map or re-runs enrichment, companies with tier_override should NOT have their tier reset by the AI. The AI's tier suggestion only applies to companies where tier_override is false.

**Tier stats recalculation:**
After any tier change, recalculate these on the frontend (don't round-trip to the server):
- Company count per tier
- Total candidates per tier
- Average fit score per tier
- Count of "open to work" candidates per tier

### 1B: Add Company Manually

**What it does:** Button at the bottom of each tier column: "+ Add company". Opens a search modal where the recruiter types a company name. Autocomplete suggestions from Apollo. On select, the company is added to that tier and enrichment kicks off.

**Frontend:**
- "+ Add company" button renders below the last company card in each tier
- Click opens a modal with a search input
- As the recruiter types, debounce (300ms) and call the autocomplete endpoint
- Show results as a list: company name, domain, headcount, HQ city
- On select: close modal, add company card to the tier in "enriching..." state
- Kick off enrichment in the background

**Backend — new route:**
```
POST /api/market-map/[mapId]/company/add
Body: {
  "company_name": "Render",
  "company_domain": "render.com",
  "tier": "B",
  "apollo_org_id": "abc123"
}
```
This route:
1. Creates a `map_companies` row with tier_override = true (recruiter chose this tier)
2. Sets enrichment_status = "pending"
3. Calls the existing `enrich-company` logic to pull people from Apollo
4. Calls the `classify` logic to score candidates
5. Returns the company_id so the frontend can poll for completion

**Autocomplete route:**
```
GET /api/apollo/company-search?q=render
```
Calls Apollo Organization Search:
```
POST https://api.apollo.io/api/v1/organizations/search
Body: {
  "q_organization_name": "render",
  "per_page": 5
}
```
Note: this endpoint DOES consume credits. Consider caching aggressively — if someone searched "Render" before, return cached results. Cache TTL: 14 days for org search results.

Return: array of `{ company_name, company_domain, headcount, hq_city, apollo_org_id }`

### 1C: Remove Company

**What it does:** X button on each company card header. Soft delete — the company and its candidates are hidden, not destroyed.

**Frontend:**
- Small X icon in the top-right corner of each company card (only visible on hover)
- On click: confirmation tooltip "Remove CoreWeave from this map?"
- On confirm: animate card out (fade + slide), remove from the tier column
- Show a "Removed companies" collapsible section at the bottom of the map page
- Removed companies show as a compact list with a "Restore" button each

**Backend:**
```
PATCH /api/market-map/[mapId]/company/[companyId]
Body: { "hidden": true }
```
Add a `hidden` boolean column to `map_companies` (default false). All queries that fetch map companies should filter `WHERE hidden = false` by default. The "removed companies" section queries `WHERE hidden = true`.

Restore is the same PATCH with `{ "hidden": false }`.

### 1D: Candidate Status Tracking

**What it does:** Each candidate has a pipeline status that the recruiter can update. This turns the map from a research snapshot into an active pipeline tracker.

**Status values (in order):**
- `mapped` (default — candidate identified but not yet evaluated)
- `shortlisted` (recruiter has flagged this person as a target)
- `contacted` (outreach sent)
- `responded` (candidate replied)
- `screening` (in active interview process)
- `offer` (offer extended)
- `rejected` (candidate passed on or removed from consideration)

**Frontend:**
- Status badge on each candidate row (colored pill)
  - mapped: gray
  - shortlisted: blue
  - contacted: amber
  - responded: teal
  - screening: purple
  - offer: green
  - rejected: red (muted, not alarming)
- Click the badge to open a dropdown of available statuses
- On select: optimistic update, PATCH to Supabase

**Backend:**
```
PATCH /api/market-map/[mapId]/candidate/[candidateId]
Body: { "status": "shortlisted" }
```
This route already should exist from Phase 1. Just make sure it validates the status enum.

**Stat integration:**
Add status breakdown to the map header stats. Show: "5 shortlisted · 3 contacted · 1 responded" as a pipeline summary. Clicking a status in the summary filters the map to only show candidates in that status.

### 1E: Bulk Actions

**What it does:** Select multiple candidates and perform actions on all of them at once.

**Frontend:**
- Checkbox on each candidate row (left side, before the name)
- When any checkbox is checked, a floating action bar appears at the bottom of the screen:
  "[N] selected — Shortlist | Remove | Reveal contacts | Clear selection"
- "Select all" checkbox at the company card level (selects all candidates in that company)
- "Select all in tier" at the tier header level

**Backend — new route:**
```
POST /api/market-map/[mapId]/candidates/bulk-update
Body: {
  "candidate_ids": ["uuid1", "uuid2", "uuid3"],
  "update": { "status": "shortlisted" }
}
```
Batch update — single Supabase query with `IN` clause. Return count of updated records.

For bulk reveal contacts, call the existing `/api/market-map/reveal-contacts` route with multiple candidate_ids (it already supports batching up to 10).

---

## Feature 2: Flight Risk Signals

The intelligence layer. Transform raw data into actionable recruiting insight.

### 2A: Data Collection

The flight risk system needs these inputs per candidate. Some already exist from Phase 1, some are new.

**Already available (no new API calls):**
- `tenure_months` on map_candidates (from Apollo People Search response — calculate from employment start date)
- `job_postings` on map_companies (from the free job postings endpoint in Phase 1)
- `growth_rate` on map_companies (from Apollo company data)

**New data needed:**
- Company news articles — requires adding Apollo News Search to the enrichment pipeline

### 2B: Add News Search to Enrichment Pipeline

Update the `enrich-company` route (or add a step after it) to fetch news for each company.

**Apollo News Articles Search:**
```
POST https://api.apollo.io/api/v1/news_articles/search
Body: {
  "q_organization_name": "CoreWeave",
  "page": 1,
  "per_page": 10
}
```

**Processing:**
1. Fetch news articles for the company
2. Filter for relevant articles — pass titles/snippets to Claude with this prompt:

```
You are analyzing news articles about {company_name} for recruiting intelligence.

From these articles, identify any of the following events. Respond ONLY with the events you find clear evidence for:
- LAYOFFS: any reduction in force, layoffs, or significant headcount cuts
- REORG: major restructuring, department changes, leadership turnover
- ACQUISITION: company being acquired or acquiring another company
- FUNDING: new funding round (positive signal — company is growing)
- LEADERSHIP_CHANGE: CEO/CTO/VP Engineering departure or replacement

For each event found, provide:
- event_type: one of the above
- severity: low/medium/high
- summary: one sentence
- date: approximate date if available

If no relevant events are found, return an empty array.

Respond ONLY in JSON:
{
  "events": [
    {"event_type": "LAYOFFS", "severity": "high", "summary": "Company laid off 15% of workforce in January", "date": "2026-01"}
  ]
}

Articles:
{article_titles_and_snippets}
```

3. Store the events on map_companies:
   - `news_summary`: Claude-generated 1-sentence summary of the most important finding
   - `news_events`: jsonb array of the structured events
   - `flight_risk_company`: derived from events — "high" if LAYOFFS or REORG with high severity, "medium" if moderate events, "low" if only positive news or nothing found

**Caching:** Cache news results in enrichment_cache with a 3-day TTL. News goes stale faster than people data.

### 2C: Compute Flight Risk Per Candidate

Update the Claude classification prompt (the existing `/api/market-map/classify` route) to include flight risk synthesis. The prompt should now receive:

- Candidate data (name, title, tenure, seniority)
- Company news events (from step 2B)
- Company job postings (any posting with a similar title to the candidate)
- Company growth rate

**Updated classification prompt:**
```
You are a technical recruiting analyst evaluating candidates for flight risk — how likely they are to be open to a new opportunity.

For each candidate, evaluate these signals:

SIGNAL: SHORT_TENURE
- tenure < 6 months: strong signal (still settling in OR regrets the move)
- tenure 6-12 months: moderate signal
- tenure 12-24 months: weak signal
- tenure > 24 months: not a signal

SIGNAL: COMPANY_LAYOFFS
- Company has had layoffs or RIF in the last 6 months: strong signal
- Company had reorg/restructuring: moderate signal
- No negative news: not a signal

SIGNAL: TEAM_BACKFILLING
- Company has an open job posting with a similar title to this candidate: moderate signal (their team is experiencing turnover)
- No matching postings: not a signal

SIGNAL: RAPID_GROWTH_HIRE
- Company grew > 40% YoY AND candidate tenure < 18 months: weak signal (joined during hypergrowth, culture may have shifted)

SIGNAL: LEADERSHIP_CHANGE
- Company had CTO/VP Eng departure in last 6 months: moderate signal for engineering candidates

Compound rules:
- 2+ moderate signals = high flight risk
- 1 strong signal = high flight risk  
- 1 moderate signal alone = medium flight risk
- Only weak signals = low flight risk
- No signals = low flight risk

For each candidate provide:
- flight_risk: "low", "medium", or "high"
- flight_risk_signals: array of signal keys that apply (e.g. ["short_tenure", "company_layoffs"])
- flight_risk_reasoning: one sentence explaining the assessment

Include this in the same classification response alongside fit_score and fit_reasoning.
```

### 2D: Frontend — Flight Risk Display

**On the candidate row:**
- Flight risk badge next to (or replacing) the status area
  - Low: no badge (don't clutter the UI with "everything is fine" badges)
  - Medium: amber dot or small "medium risk" text in amber
  - High: coral/red badge that says "High flight risk" — this should catch the recruiter's eye
- On hover over the badge: tooltip showing the specific signals in plain English:
  - "Short tenure (8 months)" 
  - "Company had layoffs in January"
  - "Team is backfilling this role"

**On the candidate detail panel:**
- Dedicated "Flight risk" section below the score breakdown
- Show each signal as a row with an icon and description
- Include the Claude-generated reasoning sentence
- If high flight risk: show a subtle call-to-action: "This candidate may be open to outreach — consider reaching out soon"

**On the company card:**
- If the company has high flight_risk_company (layoffs/reorg), show a small warning indicator on the company card header
- On expand: show the news_summary at the top of the candidate list as context

**Map-level filtering:**
- Add a filter option: "Show high flight risk only" — filters the map to only show candidates with high flight risk across all companies
- This is the "who should I call today" view

### 2E: Schema Updates for Flight Risk

Add these columns to `map_companies` (if not already present):
```
news_summary: text
news_events: jsonb (array of event objects)
flight_risk_company: text (enum: "low", "medium", "high")
news_fetched_at: timestamptz
```

Add/update these on `map_candidates`:
```
flight_risk: text (enum: "low", "medium", "high")  -- already exists from Phase 1
flight_risk_signals: text[]  -- already exists from Phase 1
flight_risk_reasoning: text  -- NEW: Claude's 1-sentence explanation
```

---

## Feature 3: Saved Map Templates

### 3A: Schema

New table: `map_templates`
```
id: uuid (PK)
user_id: uuid (FK to auth.users)
name: text (editable, defaults to role title)
role_config: jsonb ({
  role_title, role_level, role_stack, geography, comp_range_min, comp_range_max, role_description
})
company_config: jsonb (array of {
  company_name, company_domain, tier, tier_override, apollo_org_id
})
source_map_id: uuid (FK to market_maps — which map this template was created from)
use_count: integer (default 0 — how many times this template has been cloned)
created_at: timestamptz
updated_at: timestamptz
```

### 3B: Save as Template

**Trigger:** Button on the map page header: "Save as template"

**Backend:**
```
POST /api/market-map/templates
Body: { "map_id": "uuid", "name": "optional custom name" }
```
This route:
1. Reads the market_map and its map_companies
2. Serializes the role config from the market_map
3. Serializes the company list (name, domain, tier, tier_override, apollo_org_id) — do NOT include candidates
4. Creates a map_templates row
5. Returns the template

**Frontend:**
- On click "Save as template": show a name input (pre-filled with role title), confirm button
- Success toast: "Template saved. You can reuse this map from the Templates page."

### 3C: Template Gallery

**New page:** `/market-map/templates`

Add "Templates" to the market map navigation (sub-nav or tab).

**Frontend:**
- Grid of template cards, sorted by most recently created
- Each card shows:
  - Template name
  - Role title + level
  - Company count + tier breakdown ("3 Tier A · 3 Tier B · 3 Tier C")
  - Date created
  - Use count ("Used 4 times")
  - Action buttons: "Use template" and "Delete"
- Empty state: "No templates yet. Generate a market map and save it as a template to reuse later."

### 3D: Clone from Template

**Trigger:** "Use template" button on a template card

**Backend:**
```
POST /api/market-map/templates/[templateId]/clone
Body: {} (or optional overrides like different geography)
```
This route:
1. Reads the template's role_config and company_config
2. Creates a new `market_maps` row with the role config, status = "generating"
3. Creates `map_companies` rows for each company in the template, preserving tier and tier_override
4. Kicks off enrichment for each company (same as Phase 1 generate flow)
5. Returns the new map_id

The key difference from a fresh generate: Claude does NOT re-suggest companies. The company list comes from the template. Only the enrichment (pulling latest people, scores, news) is re-run. This means the map populates much faster because there's no "what companies should I look at?" step.

**Frontend:**
- On click "Use template": redirect to `/market-map/[newMapId]`
- Map renders in the same progressive-loading state as a fresh generate
- Banner at top: "Generated from template: [template name]"

### 3E: Map History / Dashboard

**Update the main market map page** (or create a sub-page) to show recent maps.

**Frontend:**
- Before the map generation form, show a "Recent maps" section
- Each map card shows:
  - Map name (editable)
  - Role title
  - Status: generating / ready / stale
  - Stats: company count, candidate count, shortlisted count, contacted count
  - Date created / last updated
  - Click to open the map
- "Stale" status: if a map hasn't been refreshed in 14+ days, mark it as stale with a "Refresh" button

**Map naming:**
When a map is first generated, auto-name it: "{role_title} — {date}" (e.g. "Sr. Platform Engineer — Mar 26, 2026"). The recruiter can click the name to edit it inline.

---

## Build Sequence

Build in this order. Each feature should be fully functional before starting the next.

**Step 1: Candidate status tracking (1D)**
Start here because it's the simplest and immediately useful. Add the status dropdown to candidate rows, wire up the PATCH endpoint, add status badges and filtering.

**Step 2: Bulk actions (1E)**
Add checkboxes, selection state, and the floating action bar. Wire to bulk-update endpoint.

**Step 3: Remove company (1C)**
Add the hidden column, X button, removed companies section, restore functionality.

**Step 4: Drag-and-drop tier reassignment (1A)**
Install dnd-kit (or implement native drag). Wire up the tier PATCH endpoint. Recalculate tier stats on drop.

**Step 5: Add company manually (1B)**
Build the autocomplete route (Apollo org search), the add-company modal, and wire it to the enrichment pipeline.

**Step 6: News search integration (2B)**
Add Apollo News Search to the enrichment pipeline. Build the Claude news analysis prompt. Store news events on map_companies.

**Step 7: Flight risk computation (2C)**
Update the classification prompt to include flight risk synthesis. Store results on map_candidates.

**Step 8: Flight risk UI (2D)**
Add badges, tooltips, detail panel section, company-level warnings, and the "high flight risk only" filter.

**Step 9: Save as template (3B)**
Build the template schema, save endpoint, and the "Save as template" button with name input.

**Step 10: Template gallery (3C)**
Build the templates page with the card grid.

**Step 11: Clone from template (3D)**
Build the clone endpoint and wire "Use template" to create a new map from the template.

**Step 12: Map history (3E)**
Build the recent maps section on the main page. Add map naming and stale detection.

---

## Important Implementation Notes

- **Optimistic UI everywhere.** When the recruiter drags a company to a new tier, moves a candidate to "shortlisted", or removes a company — update the UI immediately, then persist to Supabase in the background. If the persist fails, revert the UI and show an error toast. Recruiters are impatient; perceived latency kills the product.

- **Don't break Phase 1.** The enrichment pipeline, the generate flow, the classification — all of this should keep working exactly as before. Phase 2 adds features on top, it doesn't rewrite the core.

- **Tier override protection.** This is critical. When a recruiter manually re-tiers a company (drag-and-drop or add-company), set `tier_override = true`. Any future re-enrichment or AI classification MUST check this flag and skip tier re-assignment for overridden companies. The recruiter's judgment overrides the AI.

- **Flight risk is a synthesis, not a formula.** Don't try to compute flight risk with a numeric formula in code. Pass all the raw signals to Claude and let it reason about the combination. A person with 8 months tenure at a company that just raised $100M is very different from a person with 8 months tenure at a company that just laid off 20% of staff. Claude handles this nuance; a formula doesn't.

- **Cache aggressively.** News search results: 3-day TTL. Company org search (autocomplete): 14-day TTL. Everything from Phase 1 caching still applies. Before any external API call, check the cache.

- **Test with real data.** Don't just verify the code compiles. Generate a map for "Sr. Platform Engineer" at GPU cloud companies, verify the Apollo data makes sense, verify the Claude classifications are reasonable, then test the editing flows. The product only works if the data is good.

Start with Step 1 and work through sequentially. Each step should be committed and testable before moving to the next. Ask me if you hit any ambiguity.
