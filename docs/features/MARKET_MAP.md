# Scout Market Map — Complete Spec

The market map lets recruiters type a role brief and get back an interactive, tiered landscape of companies and candidates — auto-enriched with Apollo data and AI-powered classification.

---

## Phase 1: Core Map **[Built]**

### Architecture

Two-phase enrichment model:

**Phase 1 — Map Generation (free, no Apollo credits)**
1. Recruiter enters role brief (title, level, stack, geography)
2. Claude API suggests 15-25 target companies organized into Tier A/B/C
3. For each company, Apollo People API Search finds matching candidates (FREE)
4. Map renders progressively as each company's data comes back
5. Claude classifies fit scores and flight risk per company batch

**Phase 2 — Contact Enrichment (on demand, costs credits)**
1. Recruiter browses the map, identifies targets
2. Clicks "reveal contact" on specific people
3. Apollo Bulk People Enrichment reveals verified emails/phones
4. Enriched data cached for future use

Key insight: Apollo's People API Search (`/api/v1/mixed_people/api_search`) does NOT consume credits. It returns name, title, company, seniority, location, LinkedIn URL. Credits only burn when revealing emails/phones via the enrichment endpoint.

### Schema

**`market_maps`** — Each market map search project
```
id: uuid (PK)
user_id: uuid (FK to auth.users)
name: text (auto-generated from role brief, editable)
role_title: text
role_level: text (e.g. "senior", "staff", "principal")
role_stack: text[]
role_description: text (optional freeform brief)
geography: text[]
comp_range_min: integer (optional)
comp_range_max: integer (optional)
status: text (enum: "generating", "ready", "stale")
created_at: timestamptz
updated_at: timestamptz
```

**`map_companies`** — Companies on a specific map with tier assignment
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
news_summary: text (Claude-generated)
flight_risk_company: text (enum: "low", "medium", "high")
enrichment_status: text (enum: "pending", "enriching", "complete", "failed")
apollo_org_id: text
created_at: timestamptz
```

**`map_candidates`** — People on the map
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
tenure_months: integer
years_of_experience: integer
fit_score: integer (0-100, Claude-generated)
fit_reasoning: text
flight_risk: text (enum: "low", "medium", "high")
flight_risk_signals: text[]
status: text (enum: "mapped", "shortlisted", "contacted", "responded", "screening", "rejected")
email: text (null until enriched)
phone: text (null until enriched)
email_enriched_at: timestamptz
github_url: text
gitscout_score: integer
created_at: timestamptz
```

**`enrichment_cache`** — Global cache for Apollo data
```
id: uuid (PK)
cache_key: text (unique)
cache_type: text (enum: "people_search", "company_info", "person_enrichment", "job_postings")
data: jsonb
expires_at: timestamptz
created_at: timestamptz
```
TTLs: people_search 7d, company_info 14d, person_enrichment 30d, job_postings 3d.

### API Routes

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/market-map/generate` | Create map from role brief, Claude suggests companies |
| POST | `/api/market-map/enrich-company` | Enrich one company via Apollo People Search + Job Postings |
| POST | `/api/market-map/classify` | AI classification (fit score, flight risk) for a company batch |
| POST | `/api/market-map/reveal-contacts` | Credit-consuming contact enrichment |
| GET | `/api/market-map/[id]` | Fetch complete map with companies and candidates |
| PATCH | `/api/market-map/[id]/company/[companyId]` | Update company tier (drag-and-drop) |
| PATCH | `/api/market-map/[id]/candidate/[candidateId]` | Update candidate status |

### Claude Prompts

**Company suggestion:** System prompt asks Claude to suggest 15-25 companies organized into Tier A (direct competitors), Tier B (adjacent companies), Tier C (stretch targets). JSON output with company_name, company_domain, tier, reasoning.

**Classification:** For each candidate, Claude evaluates fit score (0-100), fit reasoning, flight risk (low/medium/high), and flight risk signals. JSON output.

### Key Rules
- Always check enrichment_cache before ANY external API call
- People API Search is free; enrichment costs credits
- Rate limit Apollo: max 3-5 concurrent requests, exponential backoff on 429s
- Claude model: `claude-sonnet-4-20250514`, max_tokens: 4000, JSON output
- Tier overrides are sacred — recruiter's manual assignments override AI

---

## Phase 2: Control + Intelligence **[In Progress]**

Phase 2 makes the map a tool the recruiter works IN. Three feature groups:

### Map Editing

**Drag-and-drop tier reassignment:** Company cards draggable between tiers using @dnd-kit/core. Optimistic UI update, PATCH to Supabase. Sets tier_override = true.

**Add company manually:** "+ Add company" button per tier. Autocomplete via Apollo Organization Search (`POST /api/v1/organizations/search` — costs credits, cache 14d). On select, kicks off enrichment pipeline.

**Remove company:** Soft delete via `hidden` boolean on map_companies. "Removed companies" collapsible section with restore button.

**Candidate status tracking:** Pipeline status dropdown on each candidate (mapped → shortlisted → contacted → responded → screening → offer → rejected). Colored status pills. Map header shows pipeline summary stats.

**Bulk actions:** Checkboxes on candidates, floating action bar: "Shortlist | Remove | Reveal contacts". Bulk update via `POST /api/market-map/[mapId]/candidates/bulk-update`.

### Flight Risk Signals

**News search integration:** Apollo News Articles Search (`POST /api/v1/news_articles/search`) added to enrichment pipeline. Claude analyzes articles for LAYOFFS, REORG, ACQUISITION, FUNDING, LEADERSHIP_CHANGE events. Cache 3d.

**Enhanced classification:** Updated Claude prompt includes tenure analysis, company news events, job posting matching, growth rate context. Compound rules: 2+ moderate signals = high risk, 1 strong signal = high risk.

**Schema additions:**
```
map_companies: + news_events (jsonb), news_fetched_at (timestamptz)
map_candidates: + flight_risk_reasoning (text)
```

**Frontend:** Flight risk badges (amber medium, red high), hover tooltips with specific signals, "Show high flight risk only" filter.

### Saved Map Templates

**`map_templates` table:** Stores role_config (jsonb) and company_config (jsonb array) from a map. "Save as template" button on map header.

**Template gallery:** `/market-map/templates` page showing template cards with role info, company count, tier breakdown, use count.

**Clone from template:** Creates new map using template's company list (skips Claude company suggestion step — faster). Re-runs enrichment for fresh data.

**Map history:** Recent maps section showing name, status, stats, stale detection (14+ days without refresh).

---

## Phase 3: Workflow Integration **[Planned]**

Phase 3 turns the map into a complete recruiting workflow.

### HM-Shareable Export

**Share links:** `map_shares` table with permission tiers:
- `overview` — company-level only (tier breakdown, aggregate stats, no candidate names)
- `full` — all candidates visible (read-only, no emails/phones, no edit controls)

Share tokens are cryptographically random, expire after configurable period (7/14/30/90 days). Public page at `/share/[token]` — no login required.

**PDF export:** Using `@react-pdf/renderer` (not puppeteer — too heavy for Vercel). Two variants: overview (company-level) and full (with candidates). Multi-page: cover, executive summary, tier breakdowns.

**Presentation mode:** Full-screen, clean view optimized for screen-sharing. No editing controls, enlarged typography, keyboard navigation.

### AI Outreach Generation

> Note: This was built as a standalone feature — see [Outreach Studio](OUTREACH_STUDIO.md).

**`outreach_messages` table:** Stores generated messages per candidate with subject_line, first_line, body, variant, status.

**Generation flow:** Recruiter selects candidates, enters selling points + tone, Claude generates personalized messages per candidate. Messages are editable before export.

**Export:** CSV format compatible with Apollo sequences, Outreach, Salesloft.

### Pipeline Funnel View

**Per-map funnel:** Horizontal funnel visualization showing status stages with counts and conversion rates. Click stage to filter map. Pure frontend calculation.

**Aggregate dashboard:** `/market-map/dashboard` with summary metrics across all maps (active maps, total candidates, in-pipeline count, response rate).

**Status timestamps:** `candidate_status_history` table — append-only log of every status change with from_status, to_status, changed_at, changed_by.

### Outreach Tracking

**Manual response logging:** "Mark as responded" / "Mark as bounced" on candidate detail panel. Auto-advances pipeline status.

**Response rate per company:** Aggregate signal shown on company cards after 3+ candidates contacted.

**`outreach_signals` table:** Anonymized outreach data (no PII) designed for cross-user aggregation in Phase 4.

---

## Phase 4: Defensibility **[Planned]**

Phase 4 makes the platform get smarter over time. Living maps, hiring pattern detection, competitive alerts, and data foundation for cross-search intelligence.

### Living Maps (Auto-Refresh)

**Refresh infrastructure:** `map_refresh_jobs` table tracks refresh status. Maps can be set to auto_refresh with weekly/biweekly/monthly cadence.

**Refresh logic:** Per company: re-run Apollo People Search, diff results against existing candidates (new people inserted, gone people flagged as `possibly_departed`), re-run job postings + news, re-classify. Does NOT re-tier companies, re-enrich emails, or change pipeline status.

**Change log:** `map_change_log` table (append-only) records all diffs. Change digest shown as in-app notification: "5 changes since last visit."

**Scheduled cron:** Vercel Cron Job (`/api/cron/refresh-maps`) runs weekly. If timeout issues, fall back to Hetzner VPS worker.

**Cost control:** Only refresh maps viewed in last 30 days. Rate limit: max 5 maps/user/week on free tier.

### Hiring Pattern Detection

**Employment history capture:** `candidate_employment_history` table. Parse from Apollo People Search results during enrichment.

**Pattern computation:** Per company: "Where did their team come from?" (group previous employers), "Hiring velocity by source" (recent hires by source company).

**Frontend:** "Top source companies" list on expanded company cards. Talent flow table showing source → target company movement. Only shown if 3+ candidates have history data.

### Team Health Scoring

**Metrics:** Average tenure, recent departure signals, backfill ratio, leadership stability, growth rate context.

**Claude synthesis:** Scores each company as stable/transitioning/unstable with health_reasoning and sourcing_implication.

**Schema additions on `map_companies`:**
```
team_health: text (enum: "stable", "transitioning", "unstable")
team_health_reasoning: text
sourcing_implication: text
avg_tenure_months: integer
backfill_ratio: float
```

**Frontend:** Health indicator dots on company cards, expanded health section, "Show unstable teams only" filter. Frame as directional signal, not verdict.

### Competitive Intelligence Alerts

**Company watch list:** `watched_companies` table. Auto-populated from Tier A companies on map generation.

**Alert detection:** Weekly job alongside refresh. Checks news + job postings for significant changes. Creates alerts for layoffs, leadership changes, funding, hiring surge/freeze, key departures, acquisitions.

**`alerts` table:** Stores alert_type, severity (info/important/urgent), title, summary. Bell icon in header with unread count.

**Alert → action:** Each alert links to relevant map context with specific CTAs.

**Alert fatigue prevention:** Only alert on genuinely significant events. Batch "info" alerts into weekly digest. Let recruiter configure sensitivity.

### Cross-Search Intelligence (Data Foundation)

**`company_intelligence` table:** Aggregated metrics across all users — response_rate, avg_response_time, departure_rate, source_company_affinity.

**Thresholds before surfacing:** Response rate needs 10+ attempts, departure rate needs 5+ maps, source affinity needs 15+ data points.

**Future surfacing (not built yet):** "Community insight" badges, reachability scores, trending companies, suggested tier improvements.

**Privacy:** Never expose which users generated signals or which candidates responded. Aggregate at company level with minimum thresholds.

---

## Environment Variables

```
APOLLO_API_KEY=
ANTHROPIC_API_KEY=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```
