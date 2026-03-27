# GitScout Market Map — Build Spec for Claude Code

## Context

You're building a Market Map feature for GitScout, a GitHub developer sourcing platform built with Next.js, Vercel, and Supabase. The market map lets recruiters type a role brief and get back an interactive, tiered landscape of companies and candidates — auto-enriched with Apollo data and AI-powered classification.

A working UI prototype already exists (the market map page with mock data). Your job is to make it real by wiring up the backend: Supabase schema, Apollo API integration, Claude AI classification, and the enrichment pipeline.

Read the existing codebase thoroughly before writing anything. Understand the current project structure, how pages are routed, how Supabase is connected, and what components already exist.

---

## Architecture Overview

The market map has a two-phase enrichment model:

**Phase 1 — Map Generation (free, no Apollo credits)**
1. Recruiter enters role brief (title, level, stack, geography)
2. Claude API suggests 15-25 target companies organized into Tier A/B/C
3. For each company, Apollo People API Search finds matching candidates
4. Map renders progressively as each company's data comes back
5. Claude classifies fit scores and flight risk per company batch

**Phase 2 — Contact Enrichment (on demand, costs credits)**
1. Recruiter browses the map, identifies targets
2. Clicks "reveal contact" on specific people
3. Apollo Bulk People Enrichment reveals verified emails/phones
4. Enriched data cached for future use

The key insight: Apollo's People API Search (`/api/v1/mixed_people/api_search`) does NOT consume credits. It returns name, title, company, seniority, location, LinkedIn URL — everything needed to build the map. Credits only burn when revealing emails/phones via the enrichment endpoint. This means map generation is essentially free.

---

## Supabase Schema

Create these tables. Use UUIDs for primary keys, timestamps for created_at/updated_at.

### `market_maps`
Stores each market map search project.
```
id: uuid (PK)
user_id: uuid (FK to auth.users)
name: text (auto-generated from role brief, editable)
role_title: text (e.g. "Sr. Platform Engineer")
role_level: text (e.g. "senior", "staff", "principal")
role_stack: text[] (e.g. ["Go", "Kubernetes", "AWS"])
role_description: text (optional freeform brief)
geography: text[] (e.g. ["San Francisco, US", "Remote"])
comp_range_min: integer (optional)
comp_range_max: integer (optional)
status: text (enum: "generating", "ready", "stale")
created_at: timestamptz
updated_at: timestamptz
```

### `map_companies`
Companies on a specific market map, with their tier assignment.
```
id: uuid (PK)
map_id: uuid (FK to market_maps)
company_name: text
company_domain: text
tier: text (enum: "A", "B", "C")
tier_override: boolean (default false — true if recruiter manually re-tiered)
headcount: integer
eng_headcount: integer
hq_city: text
hq_country: text
funding_stage: text
funding_amount: text
growth_rate: text
tech_stack: text[]
hiring_velocity: integer (count of open roles)
news_summary: text (Claude-generated summary of recent news)
flight_risk_company: text (enum: "low", "medium", "high" — based on layoff/reorg news)
enrichment_status: text (enum: "pending", "enriching", "complete", "failed")
apollo_org_id: text
created_at: timestamptz
```

### `map_candidates`
People on the map, linked to a company and a map.
```
id: uuid (PK)
map_id: uuid (FK to market_maps)
company_id: uuid (FK to map_companies)
apollo_person_id: text
name: text
first_name: text
last_name: text
title: text
seniority: text
city: text
state: text
country: text
linkedin_url: text
headline: text
departments: text[]
tenure_months: integer (calculated from employment_history if available)
years_of_experience: integer (estimated)
fit_score: integer (0-100, Claude-generated)
fit_reasoning: text (1-line from Claude)
flight_risk: text (enum: "low", "medium", "high")
flight_risk_signals: text[] (e.g. ["short_tenure", "company_layoffs", "team_backfilling"])
status: text (enum: "mapped", "shortlisted", "contacted", "responded", "screening", "rejected")
email: text (null until enriched)
phone: text (null until enriched)
email_enriched_at: timestamptz
github_url: text (null unless matched)
gitscout_score: integer (null unless GitHub matched)
created_at: timestamptz
```

### `enrichment_cache`
Global cache for Apollo data to avoid redundant API calls across users.
```
id: uuid (PK)
cache_key: text (unique — e.g. "people_search:fluidstack.io:senior:platform_engineer")
cache_type: text (enum: "people_search", "company_info", "person_enrichment", "job_postings")
data: jsonb
expires_at: timestamptz
created_at: timestamptz
```
Index on (cache_key, expires_at). Before any Apollo API call, check this table first. If cache_key exists and expires_at > now(), use cached data.

TTLs:
- people_search: 7 days
- company_info: 14 days
- person_enrichment (emails): 30 days
- job_postings: 3 days

---

## API Routes to Build

All routes go in your Next.js API routes (app/api/...).

### `POST /api/market-map/generate`
Main entry point. Accepts the role brief, kicks off map generation.

**Request body:**
```json
{
  "role_title": "Sr. Platform Engineer",
  "role_level": "senior",
  "role_stack": ["Go", "Kubernetes"],
  "geography": ["San Francisco, US"],
  "comp_range_min": 180000,
  "comp_range_max": 250000
}
```

**What it does:**
1. Creates a `market_maps` row with status "generating"
2. Calls Claude API to suggest companies (see prompt below)
3. Creates `map_companies` rows for each suggested company with status "pending"
4. Returns the map_id immediately so the frontend can start rendering the skeleton
5. Kicks off background enrichment for each company (see next route)

**Claude system prompt for company suggestion:**
```
You are a technical recruiting market intelligence engine. Given a role brief, suggest 15-25 companies where the recruiter should look for candidates.

Organize companies into three tiers:
- Tier A (5-8 companies): Direct competitors or companies in the exact same space. Highest signal talent — people doing this exact job at similar companies.
- Tier B (5-8 companies): Adjacent companies where the skills transfer directly. Different product, same technical challenges.
- Tier C (5-8 companies): Larger or prestigious companies where talent is strong but harder to recruit from. "Stretch" targets.

For each company, provide:
- company_name
- company_domain (the actual website domain, e.g. "fluidstack.io" not "FluidStack")
- tier (A, B, or C)
- reasoning (1 sentence on why this company is relevant for this role)

Respond ONLY in JSON format:
{
  "companies": [
    {"company_name": "CoreWeave", "company_domain": "coreweave.com", "tier": "A", "reasoning": "Direct GPU cloud competitor, similar infrastructure challenges"}
  ]
}
```

The user message should be: "Find companies for this role: {role_title}, {role_level} level, tech stack: {role_stack}, location preference: {geography}"

### `POST /api/market-map/enrich-company`
Background enrichment for a single company. Called once per company after map generation.

**Request body:**
```json
{
  "map_id": "uuid",
  "company_id": "uuid",
  "company_domain": "coreweave.com",
  "role_title": "Sr. Platform Engineer",
  "role_level": "senior",
  "role_stack": ["Go", "Kubernetes"],
  "geography": ["San Francisco, US"]
}
```

**What it does:**
1. Check enrichment_cache for this company + role combo
2. If cache miss, call Apollo People API Search:
   ```
   POST https://api.apollo.io/api/v1/mixed_people/api_search
   Body: {
     "organization_domains": ["coreweave.com"],
     "person_titles": ["platform engineer", "infrastructure engineer", "SRE", "site reliability"],
     "person_seniorities": ["senior", "manager"],
     "person_locations": ["San Francisco, California, United States"],
     "per_page": 25
   }
   ```
   Note: Expand person_titles to include reasonable variations of the role. If the role is "Platform Engineer", also search "Infrastructure Engineer", "SRE", "DevOps Engineer", "Cloud Engineer". Use Claude to generate title variations if needed.
3. Call Apollo Job Postings endpoint (free, no credits):
   ```
   GET https://api.apollo.io/api/v1/organizations/{apollo_org_id}/job_postings
   ```
4. Insert results into `map_candidates` table
5. Update `map_companies` enrichment_status to "complete"
6. Cache results in enrichment_cache
7. Return enriched data so frontend can update

### `POST /api/market-map/classify`
AI classification for a batch of candidates at one company.

**Request body:**
```json
{
  "map_id": "uuid",
  "company_id": "uuid",
  "role_brief": { ... },
  "candidates": [ ... ],
  "company_news": "...",
  "job_postings": [ ... ]
}
```

**Claude system prompt for classification:**
```
You are a technical recruiting analyst. For each candidate, evaluate:

1. FIT SCORE (0-100): How well does this person match the role brief based on their title, seniority, and apparent experience? 90+ = strong match, 70-89 = good match, 50-69 = possible match, <50 = weak match.

2. FIT REASONING: One sentence explaining the score.

3. FLIGHT RISK (low/medium/high): Based on these signals:
   - Tenure < 12 months at current company = higher risk
   - Company has recent layoff/reorg news = higher risk
   - Company is backfilling their exact role (from job postings) = higher risk
   - Multiple signals compound: short tenure + layoff news = high risk

4. FLIGHT RISK SIGNALS: Array of signal keys that apply: "short_tenure", "company_layoffs", "company_reorg", "team_backfilling", "rapid_growth_hire" (joined during hypergrowth, culture may have shifted)

Respond ONLY in JSON:
{
  "classifications": [
    {
      "apollo_person_id": "...",
      "fit_score": 87,
      "fit_reasoning": "Strong infrastructure background, Go experience matches stack requirement",
      "flight_risk": "medium",
      "flight_risk_signals": ["short_tenure"]
    }
  ]
}
```

### `POST /api/market-map/reveal-contacts`
Credit-consuming endpoint. Only called when recruiter explicitly requests contact info.

**Request body:**
```json
{
  "map_id": "uuid",
  "candidate_ids": ["uuid", "uuid"],
  "reveal_email": true,
  "reveal_phone": false
}
```

**What it does:**
1. Look up apollo_person_id for each candidate
2. Check enrichment_cache for already-enriched contacts
3. For cache misses, call Apollo Bulk People Enrichment:
   ```
   POST https://api.apollo.io/api/v1/people/bulk_match
   Body: {
     "reveal_personal_emails": true,
     "reveal_phone_number": false,
     "details": [
       {"id": "apollo_person_id_1"},
       {"id": "apollo_person_id_2"}
     ]
   }
   ```
   Max 10 people per call.
4. Update map_candidates rows with email/phone
5. Cache in enrichment_cache (30 day TTL)
6. Return enriched contact data

### `GET /api/market-map/[id]`
Fetch a complete market map with all companies and candidates.

### `PATCH /api/market-map/[id]/company/[companyId]`
Update a company's tier (for drag-and-drop re-tiering). Sets tier_override = true.

### `PATCH /api/market-map/[id]/candidate/[candidateId]`
Update a candidate's status (mapped → shortlisted → contacted → etc.)

---

## Apollo MCP Integration

The user has Apollo connected as an MCP server. The MCP URL is: https://mcp.apollo.io/mcp

For the Next.js API routes, use direct Apollo REST API calls with the API key stored in environment variables (APOLLO_API_KEY). Don't use the MCP connection for backend calls — MCP is for the Claude chat interface, REST API is for your server-side code.

Make sure to handle:
- Rate limiting: Apollo rate limits vary by plan. Implement exponential backoff with max 3 retries.
- Error handling: Apollo returns 429 for rate limits, 401 for auth issues. Log these clearly.
- Empty results: Some companies may have no matching people in Apollo. That's fine — show "0 candidates found" on the card, don't fail the whole map.

---

## Frontend Updates

The prototype has mock data. Replace it with real data flow:

1. **Generate button** → calls `POST /api/market-map/generate`, gets back map_id
2. **Map skeleton renders** immediately with company cards in "enriching..." state
3. **Poll or use Supabase Realtime** to watch for `map_companies.enrichment_status` changes. As each company flips to "complete", fetch its candidates and populate the card. The map should feel like it's "filling in" progressively.
4. **Candidate detail panel** shows real fit_score, fit_reasoning, flight_risk, and flight_risk_signals
5. **"Reveal contact" button** on the detail panel calls the reveal endpoint. Show a confirmation: "Reveal email for [name]? (1 credit)" before calling.
6. **Tier re-assignment** — make company cards draggable between tiers, or add a tier selector dropdown on each card. Calls PATCH to update.
7. **Candidate status tracking** — add a status dropdown on each candidate (mapped, shortlisted, contacted, etc.)
8. **Credit display** — show the user's remaining Apollo credits somewhere in the UI (if available from Apollo's usage stats endpoint)

---

## Build Sequence

Build in this order. Each step should be testable before moving to the next.

**Step 1: Supabase schema**
Create all tables with proper indexes, RLS policies, and foreign keys. Test with manual inserts.

**Step 2: Claude company suggestion**
Build the `/api/market-map/generate` route. Hard-code a test role brief. Verify Claude returns well-structured company suggestions with real domains. Test that market_maps and map_companies rows are created correctly.

**Step 3: Apollo People Search integration**
Build the `/api/market-map/enrich-company` route. Test with one company. Verify Apollo returns real people data and it's stored correctly in map_candidates. Implement caching.

**Step 4: Apollo Job Postings**
Add job postings fetch to the enrich-company route. Store hiring_velocity on the company card.

**Step 5: Claude classification**
Build the `/api/market-map/classify` route. Feed it real Apollo data and verify fit scores and flight risk signals make sense.

**Step 6: Wire up the frontend**
Connect the prototype UI to real API routes. Progressive loading, real data in cards, real scores in detail panel.

**Step 7: Contact enrichment**
Build the reveal-contacts endpoint. Add the credit-consuming flow with confirmation UX.

**Step 8: Map management**
Tier re-assignment, candidate status tracking, saved maps list.

---

## Environment Variables Needed

```
APOLLO_API_KEY=your_apollo_api_key
ANTHROPIC_API_KEY=your_anthropic_api_key  
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

---

## Important Notes

- The People API Search requires a "master" API key in Apollo, not a regular key. Make sure the API key has the right permissions.
- People API Search does NOT return emails or phones. Don't try to access those fields from search results.
- Always check enrichment_cache before making any Apollo API call. Cache hits save credits AND reduce latency.
- Claude API calls should use model "claude-sonnet-4-20250514" for classification (fast, cheap, good enough for structured output). Use max_tokens: 4000.
- For the company suggestion prompt, you can use a higher-quality model if needed, but Sonnet should handle it fine.
- Rate limit Apollo calls: don't fire 20 parallel requests at once. Use a concurrency limit of 3-5 simultaneous requests.
- All Supabase operations should use the service role key for API routes (bypasses RLS), but implement proper user authentication checks in the route handlers.

Start with Step 1 (schema) and work through sequentially. Test each step before moving to the next. Ask me if you hit any ambiguity.
