# CLAUDE.md — Scout

## What is this project?

**Scout** is a recruiting intelligence platform. It started as GitScout (a GitHub developer sourcing tool) and has evolved into a full recruiting workflow platform covering sourcing, connection mapping, outreach, pipeline tracking, and market intelligence.

The name is **Scout** — not GitScout. Update all references, branding, logos, and copy throughout the codebase.

## Tech Stack

- **Frontend:** Next.js (App Router), React, Tailwind
- **Backend:** Next.js API routes (serverless on Vercel)
- **Database:** Supabase (PostgreSQL + Realtime) via Prisma ORM
- **AI:** Anthropic Claude API (Sonnet for classification, structured JSON output)
- **Data:** Apollo.io REST API (people search, company search, enrichment, news, job postings)
- **Data:** GitHub API (developer scoring, OSS contribution analysis)
- **Deployment:** Vercel

## Brand Identity

**Name:** Scout
**Tagline:** Recruiting intelligence
**Primary accent color:** Gold #C8A55A (CTAs, warm path indicators, badges, active nav)
**Sidebar background:** #19191A (near-black)
**Sidebar text:** #E8E6DF (warm off-white)
**Sidebar muted text:** rgba(232,230,223,0.35)
**Section labels:** rgba(232,230,223,0.2)
**Active nav indicator:** 2px left border in #C8A55A
**Alert/urgent color:** #C2413C
**Success/positive color:** #2D6A4F
**Warning/stale color:** #8B6914
**Font:** Instrument Sans (Google Fonts: https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600;700&display=swap)
**Logo:** Gold rounded square (#C8A55A, border-radius 7px) with scout icon (person silhouette + signal lines) rendered in #19191A

## Information Architecture

The platform is organized into four workflow sections plus a dashboard:

```
Dashboard (home — stats, recent searches, alerts, quick actions)

SOURCE — "Find talent"
├── Developer search (GitHub-powered talent discovery)
└── Market map (company landscape intelligence)

CONNECT — "Build warm paths"
├── Connection mapper (map warm intros to any company)
└── Outreach (AI-personalized messaging)

MANAGE — "Track pipeline"
├── Pipeline (candidate tracking across searches)
├── Saved lists (curated candidate collections)
└── Templates (reusable map & outreach templates)

INTELLIGENCE — "Stay informed"
├── Alerts (company news & departure signals)
└── Analytics (response rates & pipeline health)
```

## Navigation / Sidebar Spec

### Structure
- Dark background (#19191A), 224px fixed width
- Top: Scout logo (gold square + icon) + "Scout" wordmark (17px, 700 weight) + "RECRUITING INTELLIGENCE" subtitle (9px, uppercase, 0.06em tracking, rgba(232,230,223,0.3))
- Dashboard nav item (standalone, above sections)
- Spacer (12px)
- Four grouped sections, each with:
  - Section label (9px, uppercase, 0.1em tracking, rgba(232,230,223,0.2))
  - Nav items nested below
- Bottom (pinned to bottom):
  - Settings nav item
  - User card: avatar circle (initials in gold on dark gold bg), name, plan, notification bell with red unread dot

### Nav Item States
- Default: icon + label in muted color (rgba(232,230,223,0.5)), no background
- Active: 2px left border (#C8A55A), background rgba(232,230,223,0.06), text brightens to #E8E6DF, icon brightens
- Hover: slight background highlight

### Nav Item Badges
- "NEW" badge: gold text (#C8A55A) on dark gold bg (rgba(200,165,90,0.12)), 8px font, right-aligned
- "SOON" badge: muted text (rgba(232,230,223,0.25)) on subtle bg (rgba(232,230,223,0.06))

### Icons (15x15 SVG, stroke-based, 1.1-1.2px stroke)
- dashboard: 4 rounded squares in a grid
- search: magnifying glass
- map: folded map with dividing lines
- link: chain links (connection)
- send: paper plane (outreach)
- funnel: funnel shape (pipeline)
- list: bullet list
- copy: overlapping rectangles (templates)
- bell: notification bell
- chart: bar chart
- settings: gear/cog

## Dashboard Page Spec

The dashboard is the home screen when a user opens Scout.

### Layout
- Greeting: "Good evening, [name]" (22px, 700 weight)
- Subtitle: summary stats inline ("4 active searches · 12 candidates in pipeline · 3 new alerts")
- Quick action cards: 3 cards in a row
  - "New market map" → navigates to market map
  - "Search developers" → navigates to developer search
  - "Map connections" → navigates to connection mapper
  - Each card: white bg, 0.5px border, 10px radius, title (13px 600) + description (12px, muted)
- Stat cards: 4 in a row
  - Active maps, Candidates tracked, Warm connections (gold accent), Response rate (green accent)
  - Each: white bg, 0.5px border, 10px radius, uppercase label (10px) + large number (26px, 700 weight)
- Two-column layout below:
  - Left (wider): Recent searches — list of map cards showing name, company/candidate counts, warm path count, last updated, stale indicator
  - Right (330px): Alerts feed (urgent = red dot + tinted bg, info = neutral bg) + Connection mapper CTA card (gold tinted, setup prompt with button)

## Feature Status Tracking

### Active
- Developer search (working)
- Market map (Apollo enrichment being fixed)
- Saved lists (working)

### In Development
- Connection mapper (separate branch: feature/connection-mapper)
- Market map Phase 3 (share links, PDF export, outreach — separate branch)
- Search fix (filter bugs — separate branch: fix/search-zero-results)

### Planned
- Pipeline view
- Outreach page
- Alerts system
- Analytics dashboard
- Market map Phase 4 (living maps, hiring patterns, team health)

## Architecture Overview

### Two-Phase Enrichment Model
**Phase 1 — Map Generation (free, no Apollo credits consumed)**
1. Recruiter enters role brief (title, level, stack, geography)
2. Claude API suggests 15-25 target companies organized into Tier A/B/C
3. For each company, Apollo People API Search finds matching candidates (FREE)
4. Map renders progressively as each company's data comes back
5. Claude classifies fit scores and flight risk per company batch

**Phase 2 — Contact Enrichment (on demand, costs Apollo credits)**
1. Recruiter browses the map, identifies targets
2. Clicks "reveal contact" on specific people
3. Apollo Bulk People Enrichment reveals verified emails/phones
4. Enriched data cached for future use

### Connection Mapper
- One-time setup: recruiter registers their company domain
- Scout enriches full team from Apollo (employment history, education)
- Matches engineering team to GitHub profiles
- On any target company lookup: cross-references for former employee overlap, shared investors, shared education, GitHub/OSS overlap, LinkedIn imports
- Surfaces warm intro paths with Claude-generated suggested actions
- Integrates with market map: company cards show connection count badges

## API Details

### Apollo API
- People API Search (FREE): `POST /api/v1/mixed_people/api_search`
- Job Postings (FREE): `GET /api/v1/organizations/{id}/job_postings`
- Organization Search (credits): `POST /api/v1/organizations/search`
- Bulk People Enrichment (credits): `POST /api/v1/people/bulk_match`
- News Articles Search: `POST /api/v1/news_articles/search`

### Claude API
Model: `claude-sonnet-4-20250514`. max_tokens: 4000. Always request JSON output.

### Caching
Check `enrichment_cache` before ANY external API call:
- people_search: 7 day TTL
- company_info: 14 day TTL
- person_enrichment: 30 day TTL
- job_postings: 3 day TTL
- news_articles: 3 day TTL

## Important Rules

1. **The name is Scout.** Not GitScout. Update ALL user-facing text, titles, logos, metadata, page titles.
2. **Brand color is gold (#C8A55A).** Use for CTAs, active states, warm path badges, accent elements.
3. **Font is Instrument Sans.** Replace any existing font references.
4. **Sidebar is the primary navigation.** Dark (#19191A), four grouped sections, gold accents.
5. **Always check cache before external API calls.**
6. **People API Search is free. Enrichment costs credits.** Never reveal emails/phones without user action.
7. **Tier overrides are sacred.** Recruiter's manual tier assignments override AI.
8. **Candidate pipeline status is recruiter-controlled.** Enrichment never changes it.
9. **Progressive loading.** Show results as they arrive, don't block on full completion.
10. **Optimistic UI.** Update immediately, persist in background.
11. **Rate limit Apollo calls.** Max 3-5 concurrent. Exponential backoff on 429s.

## Environment Variables

```
APOLLO_API_KEY=
ANTHROPIC_API_KEY=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

## Build Specs

All feature specs in `/docs`:
- `MARKET_MAP_BUILD_SPEC.md` — Phase 1 core
- `MARKET_MAP_PHASE_2_SPEC.md` — Control + intelligence
- `MARKET_MAP_PHASE_3_SPEC.md` — Workflow integration
- `MARKET_MAP_PHASE_4_SPEC.md` — Defensibility + network effects
- `CONNECTION_MAPPER_SPEC.md` — Connection mapping tool
- `SCOUT_REDESIGN_SPEC.md` — Platform redesign (this rebrand)
