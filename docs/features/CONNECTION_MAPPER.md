# GitScout Connection Mapper — Build Spec

## What is this?

The Connection Mapper is a standalone tool inside GitScout that maps warm paths between a recruiter's company and any target company. Instead of cold outreach, the recruiter sees: "3 people at your company used to work at CoreWeave. Your investors share a board connection. 2 of your engineers contribute to the same OSS repos as their team."

It also integrates with the Market Map — every company card shows a connection count badge so the recruiter naturally prioritizes companies where they have warm intros.

## How It Works

**One-time setup:** The recruiter registers their "home base" company (e.g. kognitos.com). GitScout enriches the full team from Apollo: names, titles, employment history, education. For the engineering team, it also pulls GitHub profiles and maps their OSS contributions. This home base becomes the dataset that all future connection mapping runs against.

**Per-target lookup:** When the recruiter picks a target company (from the market map or manually), GitScout cross-references the home base against the target's data and surfaces every connection it finds — organized by type and strength.

**Market map integration:** On the market map, each company card shows a connection count badge. Companies with warm paths get prioritized visually.

---

## Supabase Schema

### `connection_home_base`
The recruiter's own company — the "from" side of all connections.
```
id: uuid (PK)
user_id: uuid (FK to auth.users)
company_name: text
company_domain: text
apollo_org_id: text
investors: text[] (investor/VC firm names)
funding_stage: text
setup_status: text (enum: "pending", "enriching_team", "enriching_github", "ready", "failed")
team_count: integer (total employees found)
eng_count: integer (engineering team members found)
github_matched_count: integer (eng team members with GitHub profiles found)
last_enriched_at: timestamptz
created_at: timestamptz
updated_at: timestamptz
```

### `home_base_people`
Every person at the recruiter's company, enriched with history.
```
id: uuid (PK)
home_base_id: uuid (FK to connection_home_base)
apollo_person_id: text
name: text
first_name: text
last_name: text
title: text
department: text
seniority: text
linkedin_url: text
github_username: text (null if not matched)
github_url: text (null if not matched)
education: jsonb (array of { school_name, degree, field, start_year, end_year })
employment_history: jsonb (array of { company_name, company_domain, title, start_date, end_date, is_current })
created_at: timestamptz
```

### `home_base_github_repos`
OSS repos that home base engineers contribute to. Used for cross-referencing.
```
id: uuid (PK)
home_base_id: uuid (FK to connection_home_base)
person_id: uuid (FK to home_base_people)
github_username: text
repo_full_name: text (e.g. "kubernetes/kubernetes")
repo_url: text
contribution_type: text (enum: "commit", "pr_merged", "pr_open", "issue")
contribution_count: integer
last_contributed_at: timestamptz
created_at: timestamptz
```
Index on (repo_full_name) for fast cross-company lookups.

### `connection_lookups`
Each time the recruiter maps connections to a target company.
```
id: uuid (PK)
user_id: uuid (FK to auth.users)
home_base_id: uuid (FK to connection_home_base)
target_company_name: text
target_company_domain: text
target_apollo_org_id: text
target_investors: text[]
total_connections_found: integer
connection_breakdown: jsonb ({ former_employee: 3, shared_investor: 1, shared_education: 2, github_overlap: 4 })
map_id: uuid (nullable — FK to market_maps if triggered from a market map)
map_company_id: uuid (nullable — FK to map_companies)
created_at: timestamptz
```

### `connections`
Individual connections found between home base and target.
```
id: uuid (PK)
lookup_id: uuid (FK to connection_lookups)
connection_type: text (enum: "former_employee", "shared_investor", "shared_education", "github_overlap", "linkedin_import", "manual_tag")
strength: text (enum: "strong", "medium", "weak")

-- The person at YOUR company
home_person_id: uuid (nullable — FK to home_base_people)
home_person_name: text
home_person_title: text

-- The person or entity at the TARGET company
target_person_name: text (null for investor connections)
target_person_title: text (null for investor connections)
target_person_apollo_id: text

-- Connection detail (varies by type)
detail: jsonb
-- For former_employee: { "overlapping_company": "Cloudflare", "overlap_start": "2021", "overlap_end": "2023", "overlap_months": 24 }
-- For shared_investor: { "investor_name": "Khosla Ventures", "home_round": "Series B", "target_round": "Series A" }
-- For shared_education: { "school_name": "Stanford", "home_degree": "MS CS", "target_degree": "BS CS", "years_overlap": true }
-- For github_overlap: { "repo": "kubernetes/kubernetes", "home_contributions": 12, "target_contributions": 8 }
-- For linkedin_import: { "connection_degree": 1, "imported_at": "2026-03-01" }
-- For manual_tag: { "context": "Met at KubeCon 2025", "tagged_by": "user_id" }

suggested_action: text (Claude-generated: "Ask Sarah to intro you to Marcus — they overlapped at Cloudflare for 2 years")
created_at: timestamptz
```

### `linkedin_imports`
For the LinkedIn CSV upload feature.
```
id: uuid (PK)
user_id: uuid (FK to auth.users)
connection_name: text
connection_title: text
connection_company: text
connection_linkedin_url: text
imported_at: timestamptz
```

---

## API Routes

### `POST /api/connections/setup-home-base`
One-time setup. Enriches the recruiter's company.

**Request:**
```json
{
  "company_domain": "kognitos.com"
}
```

**What it does:**
1. Create `connection_home_base` row with status "enriching_team"
2. Call Apollo Organization Enrichment to get company details + investors:
   ```
   GET https://api.apollo.io/api/v1/organizations/enrich?domain=kognitos.com
   ```
   Store investors, funding stage, org ID.
3. Call Apollo People API Search to get ALL employees (not just engineers):
   ```
   POST https://api.apollo.io/api/v1/mixed_people/api_search
   Body: { "organization_domains": ["kognitos.com"], "per_page": 100 }
   ```
   Paginate through all results. This is FREE (no credits).
4. For each person, store in `home_base_people` with their employment_history and education from the Apollo response.
5. Update status to "enriching_github"
6. For engineering team members (filter by department or title keywords), attempt GitHub username matching:
   - Try email-to-GitHub lookup via GitHub API search
   - Try name + company search on GitHub
   - Store matched github_username and github_url
7. For matched GitHub profiles, fetch their contributed repos:
   - GitHub API: `GET /users/{username}/repos?type=all&sort=pushed` for owned repos
   - GitHub Events API: `GET /users/{username}/events?per_page=100` to find repos they've contributed to (PRs, pushes to non-owned repos)
   - Store in `home_base_github_repos`
8. Update status to "ready"
9. Return the home base summary

**This is a heavy operation.** It might take 1-3 minutes depending on company size. Return the home_base_id immediately and let the frontend poll for status. Show a progress indicator: "Enriching team... 45 of 80 people processed."

### `POST /api/connections/lookup`
Map connections between home base and a target company.

**Request:**
```json
{
  "target_company_domain": "coreweave.com",
  "map_id": "optional-uuid",
  "map_company_id": "optional-uuid"
}
```

**What it does:**
1. Create `connection_lookups` row
2. Get target company data from Apollo (use cache if available from market map enrichment):
   - Organization enrichment for investors
   - People API Search for employees + employment history
3. Run each connection detection algorithm (see below)
4. For each connection found, create a `connections` row
5. Batch call Claude to generate suggested_action text for each connection
6. Update lookup with total_connections_found and breakdown
7. Return all connections

### `GET /api/connections/lookup/[lookupId]`
Fetch results of a connection lookup.

### `POST /api/connections/linkedin-import`
Import LinkedIn connections CSV.

**Request:** multipart form data with CSV file.

**Processing:**
1. Parse CSV (LinkedIn export format: First Name, Last Name, Email Address, Company, Position, Connected On)
2. Store each connection in `linkedin_imports`
3. Return count of imported connections

### `GET /api/connections/home-base`
Get the current user's home base setup status and summary.

### `GET /api/market-map/[mapId]/connections`
Bulk connection lookup for all companies on a market map. Returns connection count per company for the badge display.

**What it does:**
1. Get all companies on the map
2. For each company, check if a recent lookup exists (within 7 days). If yes, use cached results.
3. For companies without recent lookups, run lookups in parallel (max 3 concurrent)
4. Return: `{ company_id: connection_count }` mapping

---

## Connection Detection Algorithms

### Algorithm 1: Former Employee Overlap

The highest-value connection type.

**Logic:**
```
For each person P in home_base_people:
  For each employment entry E in P.employment_history:
    If E.company_domain == target_company_domain:
      → CONNECTION FOUND
      strength = "strong" if overlap > 12 months, "medium" if 6-12, "weak" if < 6
      
For each person T in target_company_people:
  For each employment entry E in T.employment_history:
    If E.company_domain == home_base.company_domain:
      → CONNECTION FOUND (reverse direction — they used to work at YOUR company)
      strength = "strong"
```

**Detail object:**
```json
{
  "direction": "home_to_target" | "target_to_home",
  "overlapping_company": "coreweave.com",
  "role_at_overlap": "Sr. Engineer",
  "overlap_start": "2021-03",
  "overlap_end": "2023-06",
  "overlap_months": 27
}
```

**Also detect:** People who worked at a THIRD company together. If Sarah (your company) and Marcus (target company) both previously worked at Cloudflare at the same time, that's a warm connection even though neither worked at the other's current company.

For third-company overlap:
```
For each person P in home_base_people:
  For each employment entry EP in P.employment_history:
    For each person T in target_company_people:
      For each employment entry ET in T.employment_history:
        If EP.company_domain == ET.company_domain AND dates_overlap(EP, ET):
          → CONNECTION FOUND (shared former employer)
          strength = "strong" if overlap > 12 months, "medium" otherwise
```

This is O(n*m) but both n and m are small (typically under 200 people each). It's fine as a brute-force comparison.

### Algorithm 2: Shared Investor Overlap

**Logic:**
```
home_investors = connection_home_base.investors  (e.g. ["Khosla Ventures", "Y Combinator"])
target_investors = target_org_enrichment.investors

shared = intersection(home_investors, target_investors)

For each shared investor:
  → CONNECTION FOUND
  strength = "medium" (investor intros are warm but indirect)
```

**Detail object:**
```json
{
  "investor_name": "Khosla Ventures",
  "home_round": "Series B",
  "target_round": "Series A"
}
```

**Normalization:** Investor names may not match exactly between Apollo records. Use fuzzy matching or normalize common variations: "Khosla Ventures" = "Khosla" = "Khosla Ventures Fund". Claude can help with this — pass both investor lists and ask it to identify matches.

### Algorithm 3: Shared Education

**Logic:**
```
For each person P in home_base_people (where education is not null):
  For each person T in target_company_people (where education is not null):
    For each school S_P in P.education:
      For each school S_T in T.education:
        If normalize(S_P.school_name) == normalize(S_T.school_name):
          → CONNECTION FOUND
          strength = "medium" if dates overlapped (same years), "weak" if different years
```

**Normalization:** School names vary wildly in Apollo data. "Stanford University" = "Stanford" = "Stanford Univ." Use a fuzzy matching function or build a small normalization map for top 100 universities.

**Detail object:**
```json
{
  "school_name": "Stanford University",
  "home_degree": "MS Computer Science, 2019",
  "target_degree": "BS Computer Science, 2018",
  "years_overlap": true
}
```

### Algorithm 4: GitHub / OSS Overlap

**Logic:**
```
home_repos = SELECT DISTINCT repo_full_name FROM home_base_github_repos

For each person T in target_company_people (where github matched):
  T_repos = fetch contributed repos from GitHub API
  shared_repos = intersection(home_repos, T_repos)
  
  For each shared repo:
    home_contributors = SELECT person_id FROM home_base_github_repos WHERE repo_full_name = shared_repo
    → CONNECTION FOUND for each (home_contributor, T, shared_repo) pair
    strength = "medium" if both have 5+ contributions, "weak" if less
```

**Detail object:**
```json
{
  "repo": "kubernetes/kubernetes",
  "repo_url": "https://github.com/kubernetes/kubernetes",
  "home_contributions": 12,
  "target_contributions": 8,
  "home_contributor_github": "jake-smith"
}
```

**Rate limiting:** This algorithm requires GitHub API calls for target company engineers. Use the same rate limiting and caching strategy as the rest of GitScout. Cache target person repo data in enrichment_cache with 7-day TTL.

### Algorithm 5: LinkedIn Import Cross-Reference

**Logic:**
```
For each imported connection L in linkedin_imports:
  If L.connection_company matches target_company_name (fuzzy match):
    → CONNECTION FOUND
    strength = "strong" if 1st degree connection
```

This is simple but powerful when the data exists. The recruiter uploads their LinkedIn connections once, and every future connection lookup checks against it.

### Suggested Action Generation

After all connections are found, batch them to Claude for action suggestions:

**Claude prompt:**
```
You are a recruiting relationship strategist. For each connection between a recruiter's company and a target company, suggest a specific action the recruiter should take to leverage this connection for a warm introduction.

Be specific and actionable. Reference the people by name and the connection context.

Connections:
{for each connection:}
- Type: {connection_type}
- Your colleague: {home_person_name}, {home_person_title}
- Target person: {target_person_name}, {target_person_title}
- Detail: {detail object}

For each connection, provide a suggested_action (one sentence, specific and actionable).

Examples of good actions:
- "Ask Sarah Chen to intro you to Marcus Webb — they overlapped at Cloudflare for 2 years on the platform team"
- "Reach out through your Khosla partner — both companies are in the portfolio, ask for a warm intro to their head of engineering"
- "Mention your shared work on the Kubernetes scheduler repo — Jake and Priya both contributed to the autoscaler module"

Respond in JSON:
{
  "actions": [
    { "connection_index": 0, "suggested_action": "..." }
  ]
}
```

---

## Frontend

### Connection Mapper Page: `/connections`

Add "Connections" to the GitScout top nav (between Lists and Map, or after Map).

**Layout:**

**Top section: Home base setup**
- If no home base configured: large CTA card — "Set up your company to map warm connections"
  - Single input: company domain
  - "Set up" button → kicks off enrichment
  - Progress bar while enriching: "Finding your team... Matching GitHub profiles... Ready!"
- If home base configured: compact summary card
  - "Kognitos · 45 team members · 18 engineers · 12 GitHub profiles matched"
  - "Last refreshed: 3 days ago" + "Refresh" button
  - "Change company" link

**Middle section: Connection lookup**
- Search input: "Enter a target company" with autocomplete (same Apollo org search as market map add-company)
- On select: run the connection lookup, show loading state
- Results appear below

**Results section:**
- Summary bar: "6 connections found to CoreWeave"
  - Breakdown pills: "3 former employees · 1 shared investor · 2 GitHub overlap"
- Connection cards, grouped by type, sorted by strength (strong first):

  **Connection card layout:**
  ```
  [Strong] Former employee overlap
  ┌──────────────────────────────────────────────┐
  │ Sarah Chen (Kognitos)  ←→  Marcus Webb (CoreWeave)  │
  │ Sr. Engineer              Staff Engineer             │
  │                                                      │
  │ Both worked at Cloudflare (2021-2023, 27 months)     │
  │                                                      │
  │ 💡 Ask Sarah to intro you to Marcus — they           │
  │    overlapped at Cloudflare for 2 years              │
  │                                              [Act ▸] │
  └──────────────────────────────────────────────┘
  ```

  - "Act" button options: "Draft intro request email" (generates an email to Sarah asking for the intro), "Copy to clipboard", "Mark as used"

**LinkedIn import section:**
- Collapsible section at bottom: "Import LinkedIn connections for deeper mapping"
- File upload: accepts CSV
- After import: "248 connections imported. These will be cross-referenced on future lookups."
- Show last import date and count

### Market Map Integration

**On each company card in the market map:**
- Small badge next to the company name: "4 connections" (teal colored, clickable)
- If 0 connections: no badge (don't clutter with zeros)
- Click the badge: opens a side panel or modal showing the connections for that company (same layout as the connections page results section)

**On the map stats bar:**
- Add a stat: "Warm paths: 14 of 20 companies have connections"

**Prerequisite:** Home base must be set up. If not, show a subtle prompt: "Set up your company in Connections to see warm paths on the map"

**When to compute:** Connection lookups for market map companies should run automatically when the map is generated — after enrichment completes for each company, fire the connection lookup as a follow-up step. Cache results per (home_base_id, target_company_domain) with 7-day TTL so repeated views are instant.

---

## Build Sequence

### Step 1: Schema
Create all tables: connection_home_base, home_base_people, home_base_github_repos, connection_lookups, connections, linkedin_imports. Add indexes.

### Step 2: Home base setup — Apollo enrichment
Build POST /api/connections/setup-home-base. Pull team from Apollo People Search (free). Store in home_base_people with employment_history and education. Test with a real company domain.

### Step 3: Home base setup — GitHub matching
Add GitHub username matching for engineering team members. Store in home_base_people.github_username. Fetch contributed repos and store in home_base_github_repos. This step has the most GitHub API calls — implement rate limiting.

### Step 4: Home base setup — frontend
Build the setup card UI on the /connections page. Domain input, progress indicator, summary card when complete.

### Step 5: Former employee detection
Build Algorithm 1. Test: set up Kognitos as home base, look up connections to a company you know people have worked at. Verify connections are found with correct overlap details.

### Step 6: Shared investor detection
Build Algorithm 2. Requires Apollo Org Enrichment on the target company. Add fuzzy matching for investor names.

### Step 7: Shared education detection
Build Algorithm 3. Add school name normalization. Only fires for people where Apollo has education data.

### Step 8: GitHub overlap detection
Build Algorithm 4. Cross-reference home_base_github_repos against target company engineers' contributed repos.

### Step 9: Connection lookup route
Build POST /api/connections/lookup. Orchestrates all four algorithms, creates connection rows, calls Claude for suggested actions. Test end-to-end with a real target company.

### Step 10: Connection results UI
Build the results section on the /connections page. Connection cards grouped by type, sorted by strength. Suggested action display.

### Step 11: LinkedIn CSV import
Build the upload route and parser. Store in linkedin_imports. Add Algorithm 5 to the lookup flow.

### Step 12: LinkedIn import UI
File upload component on the /connections page. Import count and status.

### Step 13: Market map integration — badge
Add connection count badge to company cards on the market map. Compute by running bulk lookups when the map loads (with caching).

### Step 14: Market map integration — detail panel
Click the connection badge to see full connection detail in a side panel or modal.

### Step 15: Action generation
Wire up "Draft intro request" button on connection cards. Claude generates an email to the home base colleague asking them to make the intro. Use the message_compose pattern.

---

## Important Notes

### Home Base Enrichment Cost
Apollo People Search is free (no credits). But fetching ALL employees at a large company could be hundreds of people across many pages. For companies with 500+ employees:
- Only paginate through the first 200 results by default
- Let the user request "full team enrichment" as an explicit action
- Consider filtering to only engineering/product/design departments initially

### GitHub Matching Accuracy
Matching Apollo profiles to GitHub usernames is imperfect. Methods in order of reliability:
1. Email match: if Apollo has a personal email, search GitHub for that email (most reliable)
2. Name + company: search GitHub for "{first_name} {last_name}" and filter by company in bio (medium reliability)
3. Username guess: try common patterns like first initial + last name (low reliability)

Don't present uncertain matches as confirmed. Flag confidence level on each GitHub match. Let the recruiter confirm or reject matches.

### Third-Company Overlap Detection
The most valuable former-employee connections aren't just "they worked at the target" — it's "they worked at the SAME THIRD company at the SAME TIME." This requires date overlap checking. Apollo employment history sometimes only has year-level granularity (not month). When you only have years, assume overlap if the years intersect at all. When you have month-level data, compute actual overlap in months.

### Connection Strength Ranking
When displaying connections, sort by this priority:
1. Former employee overlap (direct — worked at the target) → strongest
2. Former employee overlap (third-company, long overlap > 12mo) → strong
3. LinkedIn 1st degree connection → strong
4. GitHub OSS overlap (5+ contributions each) → medium-strong
5. Shared investor → medium
6. Former employee overlap (third-company, short overlap) → medium
7. Shared education (overlapping years) → medium
8. GitHub OSS overlap (few contributions) → weak
9. Shared education (different years) → weak
10. Manual tags → varies

### Caching Strategy
Connection lookups are expensive (multiple API calls + computation). Cache aggressively:
- Home base data: refresh weekly (or on manual trigger)
- Connection lookup results: cache per (home_base_id, target_domain) for 7 days
- If the recruiter's company is small and stable, the home base data barely changes — 30-day cache is fine
- Target company data: reuse market map enrichment cache when available

### Privacy
The home base enrichment pulls your own company's team data. Some recruiters might feel uncomfortable pulling employment history on their own colleagues. Consider:
- Clear explanation during setup: "GitScout will analyze your team's public career history to find warm connections to target companies"
- Don't expose the full employment history of home base people to the recruiter in the UI — only show the relevant connection detail
- The data is from Apollo (public/professional data), not from internal HR systems

Start with Step 1 and work through sequentially. Test each step with real data before moving on. The former employee detection (Step 5) is the most important — if that works well, the product is already valuable even without the other connection types.
