# GitScout Market Map — Phase 4 Build Spec

## Context

Phases 1-3 built a complete recruiting workflow: map generation, Apollo enrichment, AI classification, map editing, flight risk signals, HM exports, AI outreach, and pipeline tracking.

Phase 4 is different. It's not about new user-facing features — it's about making the platform get smarter over time. Living maps, hiring pattern detection, competitive alerts, and the data foundation for cross-search intelligence. These are the features that make GitScout defensible.

The guiding principle: every piece of data flowing through GitScout should be captured, structured, and reusable. A recruiter running a search today is generating intelligence that makes every future search better — for them and eventually for all users.

---

## Feature 1: Living Maps (Auto-Refresh)

Saved maps don't go stale. Background jobs re-enrich active maps on a weekly cadence.

### 1A: Refresh Infrastructure

**New table: `map_refresh_jobs`**
```
id: uuid (PK)
map_id: uuid (FK to market_maps)
trigger: text (enum: "scheduled", "manual", "template_clone")
status: text (enum: "pending", "running", "complete", "failed")
started_at: timestamptz
completed_at: timestamptz
changes_detected: jsonb ({
  new_candidates: integer,
  removed_candidates: integer,
  title_changes: integer,
  company_changes: integer,
  flight_risk_changes: integer
})
error: text (null unless failed)
created_at: timestamptz
```

**New columns on `market_maps`:**
```
auto_refresh: boolean (default false)
last_refreshed_at: timestamptz
refresh_cadence: text (enum: "weekly", "biweekly", "monthly" — default "weekly")
next_refresh_at: timestamptz
```

### 1B: Refresh Logic

**What a refresh does:**

For each company on the map:
1. Re-run Apollo People API Search with the same filters (title, seniority, location)
2. Diff the results against existing map_candidates:
   - **New people** (in Apollo results but not in map_candidates): insert as new candidates with status "mapped"
   - **Gone people** (in map_candidates but not in Apollo results): could mean they left the company. Flag with a new field `possibly_departed: boolean`. Do NOT auto-delete — the recruiter should review.
   - **Changed people** (title changed, etc.): update the record, log the change
3. Re-run job postings fetch (free endpoint)
4. Re-run news search for the company
5. Re-run Claude classification for any new or changed candidates
6. Re-compute flight risk for all candidates (signals may have changed — tenure is longer, news is different)

**What a refresh does NOT do:**
- Does NOT re-tier companies (respects tier_override and original AI classification)
- Does NOT re-enrich emails/phones (those are cached with 30-day TTL and only refreshed when actually stale)
- Does NOT change candidate pipeline status (recruiter controls that)
- Does NOT remove companies the recruiter manually added or removed

### 1C: Diff Detection + Change Log

**New table: `map_change_log`**
```
id: uuid (PK)
map_id: uuid (FK to market_maps)
refresh_job_id: uuid (FK to map_refresh_jobs)
change_type: text (enum: "new_candidate", "candidate_departed", "title_change", "company_change", "flight_risk_change", "new_job_posting", "news_event")
entity_type: text (enum: "candidate", "company")
entity_id: uuid (FK to map_candidates or map_companies)
old_value: jsonb (null for new entities)
new_value: jsonb
summary: text (human-readable: "Sarah Chen changed title from Sr. Engineer to Staff Engineer")
created_at: timestamptz
```

This table powers the change digest and the activity feed. It's append-only.

### 1D: Change Digest

After a refresh completes, generate a summary for the recruiter.

**Backend route:**
```
GET /api/market-map/[mapId]/changes?since=[timestamp]
```
Returns the change_log entries since the given timestamp, grouped by change_type, with counts and details.

**Notification options (implement at least one):**

Option A — In-app notification:
- Badge on the map card in the dashboard/history view: "5 changes since last visit"
- On the map page itself: banner at top "This map was refreshed on [date]. 3 new candidates found, 1 person may have departed. [View changes]"
- "View changes" opens a side panel or modal showing the change log in chronological order

Option B — Email digest (higher effort, higher value):
- Weekly email: "Your GitScout maps updated this week"
- Per-map summary: "Sr. Platform Engineer map: 2 new candidates at CoreWeave, 1 person departed from Lambda, flight risk upgraded to high for 2 candidates at Anyscale"
- CTA: "Open map" link for each

Start with Option A. Email digest can come later.

### 1E: Scheduled Refresh Cron

**Implementation options:**

Option A — Vercel Cron Jobs:
- Add a cron route: `app/api/cron/refresh-maps/route.ts`
- Vercel cron config in `vercel.json`:
  ```json
  {
    "crons": [{
      "path": "/api/cron/refresh-maps",
      "schedule": "0 6 * * 1"
    }]
  }
  ```
  This runs every Monday at 6 AM UTC.
- The cron route: queries `market_maps WHERE auto_refresh = true AND next_refresh_at <= now()`, creates refresh jobs, and processes them sequentially (or with limited concurrency)
- Vercel cron has a 60-second timeout on Hobby, 300 seconds on Pro. For maps with many companies, you may need to split into multiple invocations.

Option B — Supabase Edge Functions + pg_cron:
- Use Supabase's pg_cron to trigger a database function weekly
- The function inserts pending refresh jobs
- A Supabase Edge Function picks them up and processes them
- More reliable for long-running jobs, but more infrastructure to manage

Option C — External worker (your Hetzner VPS):
- Simple Node.js script that runs on a cron schedule
- Queries Supabase for maps needing refresh, processes them
- Most flexible, no timeout issues, but requires managing another service

**Recommendation:** Start with Option A (Vercel Cron) for simplicity. If you hit timeout issues, move to Option C. The refresh logic itself is the same regardless of where it runs.

### 1F: Frontend — Auto-Refresh Controls

**On the map page header:**
- Toggle: "Auto-refresh" (on/off) — sets market_maps.auto_refresh
- If on, show cadence selector: "Weekly / Biweekly / Monthly"
- Show: "Last refreshed: [date]" with a manual "Refresh now" button
- "Refresh now" creates a manual refresh job and kicks it off immediately

**On the dashboard/map history:**
- Maps with auto_refresh on get a small recurring-arrow icon
- Maps with pending changes get a notification badge

---

## Feature 2: Hiring Pattern Detection

Where do engineers at target companies come from? Where do they go when they leave? This tells recruiters where to fish.

### 2A: Employment History Capture

Apollo's People Search response includes employment history when available. During enrichment (Phase 1), capture this data.

**Schema addition — new table: `candidate_employment_history`**
```
id: uuid (PK)
candidate_id: uuid (FK to map_candidates)
apollo_person_id: text
company_name: text
company_domain: text
title: text
start_date: text (may be partial — "2023" or "2023-06")
end_date: text (null if current)
is_current: boolean
created_at: timestamptz
```

**During enrichment:** When processing Apollo People Search results, if the response includes employment history, parse and store each entry. Not all Apollo results include full history — some only show current role. Store what's available.

### 2B: Pattern Computation

**Backend route:**
```
GET /api/market-map/[mapId]/hiring-patterns
```

For each company on the map, compute:

**"Where did their team come from?"**
- Query candidate_employment_history for all candidates at this company
- Look at their previous employer (the entry before the current one)
- Group by previous company_domain
- Return: `[{ source_company: "aws.amazon.com", count: 4 }, { source_company: "cloudflare.com", count: 2 }]`

**"Where do people go when they leave?"**
- This requires data from DIFFERENT maps or a broader dataset
- For now, compute from what you have: if a candidate was previously at Company X and is now at Company Y, that's a data point about Company X's outflow
- This gets much more powerful in Phase 4's cross-search intelligence when you have data across many users' maps

**"Hiring velocity by source"**
- For each company, what percentage of their current team joined in the last 12 months? (derived from start_date on current employment)
- Which source companies are they hiring from most aggressively right now?

### 2C: Frontend — Hiring Patterns

**On the company card (expanded view):**
- New section below the candidate list: "Hiring patterns"
- "Top source companies" — horizontal bar chart or simple list:
  - "AWS (4 people) · Cloudflare (2) · Fastly (2) · Google (1)"
- "Recent hires" — count of people who joined in last 12 months
- This section only appears if enough employment history data is available (3+ candidates with history)

**On the map level:**
- New tab or toggle: "Talent flow view"
- Shows a simplified Sankey or flow diagram: arrows between companies showing where talent moves
- Source companies on the left, target companies (on the map) on the right, arrow thickness = count
- This is visually impressive for HM presentations and genuinely useful for identifying feeder companies

**Implementation note:** The Sankey diagram is complex. For V1, a simple table is fine:
```
| Source company | → Tier A (count) | → Tier B (count) | → Tier C (count) |
| AWS            | 6                | 3                | 8                |
| Cloudflare     | 2                | 4                | 5                |
```
A visual flow diagram can come later as a polish feature.

---

## Feature 3: Team Health Scoring

Per-company signal that tells the recruiter how stable or unstable a team is. Unstable teams = easier sourcing.

### 3A: Health Score Computation

**Backend — add to the classify or enrich-company flow:**

Compute these metrics per company from available data:

1. **Average tenure** — mean tenure_months across all candidates at this company. Low avg tenure = high turnover.
2. **Recent departure signals** — count of candidates flagged as `possibly_departed` from living map refreshes. High count = active attrition.
3. **Backfill ratio** — (open job postings with similar titles) / (total candidates mapped at this company). High ratio = lots of backfilling.
4. **Leadership stability** — from news events: any CTO/VP Eng departures in last 6 months? From Phase 2 news search.
5. **Growth rate context** — rapid growth (>50% YoY) can indicate instability even without departures.

**Claude synthesis:**
Pass all five metrics to Claude and ask for a team health assessment:

```
You are analyzing the engineering team health at {company_name} for recruiting intelligence.

Data:
- Average tenure of mapped engineers: {avg_tenure} months
- Engineers who may have departed recently: {departed_count}
- Open job postings similar to mapped roles: {backfill_count}
- Total engineers mapped: {total_mapped}
- Recent news events: {news_events}
- Company growth rate: {growth_rate}

Assess the team health as:
- STABLE: low turnover signals, good tenure, no concerning news
- TRANSITIONING: some turnover signals but not alarming, could indicate normal growth
- UNSTABLE: multiple turnover signals, high backfill ratio, or concerning news

Provide:
- health_score: "stable", "transitioning", or "unstable"
- health_reasoning: one sentence
- sourcing_implication: one sentence for the recruiter — what does this mean for their outreach strategy?

Respond in JSON only.
```

**Schema addition on `map_companies`:**
```
team_health: text (enum: "stable", "transitioning", "unstable")
team_health_reasoning: text
sourcing_implication: text
avg_tenure_months: integer
backfill_ratio: float
```

### 3B: Frontend — Team Health Display

**On the company card header:**
- Small health indicator dot:
  - Stable: green dot (or no indicator — don't clutter)
  - Transitioning: amber dot
  - Unstable: coral/red dot
- Hover tooltip: "{health_reasoning}. {sourcing_implication}"

**On the company card expanded:**
- "Team health" section with the metrics:
  - "Avg tenure: 14 months"
  - "Backfill ratio: 3 open roles / 8 mapped engineers"
  - "Sourcing note: [sourcing_implication from Claude]"

**Map-level filtering:**
- Add filter option: "Show unstable teams only"
- This is the "where should I focus my time?" view

---

## Feature 4: Competitive Intelligence Alerts

Proactive notifications when something changes at a company the recruiter cares about.

### 4A: Company Watch List

**Schema — new table: `watched_companies`**
```
id: uuid (PK)
user_id: uuid (FK to auth.users)
company_domain: text
company_name: text
watch_reasons: text[] (e.g. ["competitor", "talent_source", "client"])
alert_types: text[] (e.g. ["layoffs", "leadership_change", "funding", "key_departure"])
created_at: timestamptz
```

**Auto-populate:** When a recruiter generates a market map, auto-add all Tier A companies to their watch list (with a prompt: "Watch these companies for changes?"). They can also manually add companies from any map.

### 4B: Alert Detection

**Runs alongside the living map refresh cron (or as a separate weekly job):**

For each watched company:
1. Run Apollo News Search (same as Phase 2 flight risk news search)
2. Run Apollo Job Postings (free — check for significant changes in posting volume)
3. Compare against previous data in enrichment_cache
4. If significant changes detected, create an alert

**New table: `alerts`**
```
id: uuid (PK)
user_id: uuid (FK to auth.users)
company_domain: text
company_name: text
alert_type: text (enum: "layoffs", "leadership_change", "funding", "hiring_surge", "hiring_freeze", "key_departure", "acquisition")
severity: text (enum: "info", "important", "urgent")
title: text ("CoreWeave VP Engineering departed")
summary: text (Claude-generated 2-3 sentence summary)
source_data: jsonb (the raw news article or job posting data)
related_map_ids: uuid[] (which of the recruiter's maps include this company)
read: boolean (default false)
created_at: timestamptz
```

**Alert type detection rules:**
- `layoffs`: news articles mentioning layoffs/RIF + severity from Claude analysis
- `leadership_change`: news about CTO/VP Eng/CEO departure or replacement
- `funding`: new funding round announced (positive signal — might mean more hiring)
- `hiring_surge`: job posting count increased >50% week-over-week
- `hiring_freeze`: job posting count dropped >50% (or postings removed)
- `key_departure`: a specific candidate on one of the recruiter's maps is now flagged as `possibly_departed` from a living map refresh. This is the killer alert: "Sarah Chen, Staff Engineer at CoreWeave, may have left the company."
- `acquisition`: news about company being acquired or acquiring

### 4C: Alert Notification

**In-app:**
- Bell icon in the GitScout header with unread count badge
- Click opens an alert panel/page showing all alerts, most recent first
- Each alert card: company logo placeholder, title, summary, timestamp, severity badge
- "Urgent" alerts (layoffs at a Tier A company, key departure) get a visual pop
- Click an alert to see full detail + link to the relevant map(s)
- "Mark as read" / "Dismiss"

**Email digest (build after in-app is working):**
- Weekly email: "GitScout Intelligence Digest"
- Grouped by company: all alerts for that company in one section
- For each alert: title, summary, link to the map
- Only sent if there are unread alerts

### 4D: Alert → Action

When a recruiter sees an alert, what do they do? Make the next step obvious:

- "CoreWeave VP Engineering departed" → CTA: "View CoreWeave on your Platform Engineer map" + "3 engineers at CoreWeave are now high flight risk"
- "Lambda raised Series C ($150M)" → CTA: "Lambda is growing — consider upgrading from Tier B to Tier A" + "View 5 open engineering roles at Lambda"
- "Key departure: Sarah Chen may have left CoreWeave" → CTA: "Reach out to Sarah?" + auto-generated outreach message referencing the transition

Each alert should link directly to the relevant context in the recruiter's maps. Don't make them figure out what to do with the information.

---

## Feature 5: Cross-Search Intelligence (Data Foundation)

This feature requires meaningful user scale to be useful. Don't build the UI yet. Build the data capture so it's ready when you have the users.

### 5A: Aggregate Signal Tables

Phase 3 created `outreach_signals` for logging anonymized outreach data. Extend this pattern:

**New table: `company_intelligence`**
```
id: uuid (PK)
company_domain: text
metric_type: text (enum: "response_rate", "avg_response_time", "departure_rate", "source_company_affinity", "team_health_trend")
metric_value: jsonb (flexible — could be a number, an array, or an object)
sample_size: integer (how many data points this is based on)
computed_at: timestamptz
confidence: text (enum: "low", "medium", "high" — based on sample_size thresholds)
```

**Computation (runs weekly, aggregates across all users):**

```sql
-- Response rate per company
INSERT INTO company_intelligence (company_domain, metric_type, metric_value, sample_size, computed_at, confidence)
SELECT 
  os.company_domain,
  'response_rate',
  jsonb_build_object('rate', ROUND(AVG(CASE WHEN os.response_received THEN 1 ELSE 0 END)::numeric, 3)),
  COUNT(*),
  now(),
  CASE 
    WHEN COUNT(*) >= 20 THEN 'high'
    WHEN COUNT(*) >= 5 THEN 'medium'
    ELSE 'low'
  END
FROM outreach_signals os
WHERE os.created_at > now() - interval '90 days'
GROUP BY os.company_domain
HAVING COUNT(*) >= 3;
```

### 5B: When to Surface Cross-Search Data

Set thresholds before showing aggregate data to users:
- Response rate per company: only show if 10+ outreach attempts across all users
- Departure rate: only show if company appears on 5+ maps
- Source company affinity: only show if 15+ employment history data points

Until thresholds are met, don't show the data — showing "50% response rate" based on 2 data points is misleading.

### 5C: Future Surfacing (Don't Build Yet, Just Plan)

When the data is ready, surface it as:
- "Community insight" badge on company cards: "Engineers at CoreWeave respond to outreach 2.3x the industry average (based on GitScout network data)"
- "Reachability score" per company: aggregated from response rates, flight risk, and team health
- "Trending companies" on the dashboard: "These companies have high reachability scores this month"
- "Suggested tier" improvements: "Based on GitScout network data, Anyscale engineers are a better fit for platform roles than the AI initially predicted"

---

## Build Sequence

**Step 1: Employment history capture**
Update the enrichment pipeline to parse and store employment history from Apollo results. Create the candidate_employment_history table.

**Step 2: Hiring pattern computation**
Build the /hiring-patterns route. Compute "where did their team come from" per company.

**Step 3: Hiring patterns UI**
Add the hiring patterns section to expanded company cards. Simple list/table format first.

**Step 4: Team health scoring**
Add health computation to the enrichment/classify flow. Claude prompt for team health assessment. Store on map_companies.

**Step 5: Team health UI**
Health indicator dots on company cards. Expanded health section. "Show unstable teams only" filter.

**Step 6: Living map refresh logic**
Build the refresh job infrastructure: map_refresh_jobs table, refresh logic (re-enrich, diff, change log).

**Step 7: Refresh cron**
Set up Vercel cron (or your preferred runner). Test with a single map on a manual trigger first, then enable the schedule.

**Step 8: Change digest UI**
Build the change notification banner on maps, the "View changes" panel, and the dashboard badges.

**Step 9: Company watch list**
Create watched_companies table. Auto-populate from Tier A maps. Manual add/remove UI.

**Step 10: Alert detection**
Build the alert detection job that runs alongside refresh. Create alerts table. Test with real company news.

**Step 11: Alert notification UI**
Bell icon in header, alert panel, alert cards with severity badges, mark-as-read.

**Step 12: Alert → action CTAs**
Add contextual CTAs to each alert type. Link to relevant maps and candidates.

**Step 13: Aggregate signal tables**
Create company_intelligence table. Build the weekly aggregation query. Don't surface to users yet — just verify data is being captured correctly.

---

## Important Notes

### Living Maps — Cost Control
Each refresh re-runs Apollo People Search (free) and news search (credits). For a user with 10 active maps x 20 companies each = 200 news searches per week. At scale this adds up. Consider:
- Only refresh maps that the recruiter has viewed in the last 30 days (don't refresh abandoned maps)
- Rate limit: max 5 maps auto-refreshed per user per week on free tier, unlimited on premium
- Track refresh credit cost per user and surface it in settings

### Hiring Patterns — Data Quality
Employment history from Apollo is incomplete. Many profiles only show current role. Don't present patterns with high confidence from small samples. Show: "Based on 8 profiles with history" so the recruiter calibrates their trust.

### Team Health — Avoid False Confidence
Team health scoring is directional, not definitive. A "transitioning" score doesn't mean the team is falling apart. Frame it as a signal, not a verdict. The sourcing_implication from Claude should be nuanced: "Team appears to be in transition — outreach may be well-timed, but candidates may also be in retention conversations" not "This team is unstable, go poach them."

### Cross-Search Intelligence — Privacy
Never expose which specific users generated signals. Never expose which specific candidates responded. Aggregate at the company level with minimum thresholds. If a recruiter can reverse-engineer that their competitor is also sourcing from CoreWeave because the response rate data appeared, that's a problem. Keep aggregations broad enough to be useful without being attributable.

### Alert Fatigue
This is the biggest risk with competitive intelligence alerts. If every company gets 3 alerts per week, the recruiter stops reading them. Be aggressive about filtering:
- Only alert on genuinely significant events (layoffs, leadership changes, key departures)
- "Info" severity alerts should be batched into the weekly digest, not shown in real-time
- "Urgent" alerts should be rare — max 1-2 per week across all watched companies
- Let the recruiter configure alert sensitivity: "Only alert me on urgent events" vs "Alert me on everything"

Start with Step 1 and work through sequentially. Steps 1-5 (hiring patterns + team health) can be built independently of Steps 6-12 (living maps + alerts), so you could parallelize if you have capacity. Step 13 (aggregate tables) should wait until outreach tracking from Phase 3 is generating real data.
