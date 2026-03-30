# API Routes

All routes are Next.js App Router API routes in `src/app/api/`.

## Auth

| Method | Path | Description |
|--------|------|-------------|
| * | `/api/auth/[...nextauth]` | NextAuth.js handler (GitHub OAuth) |

## Search

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/search` | Full developer search pipeline |
| GET | `/api/search` | Search with query params |
| POST | `/api/search/quick` | Quick search (lightweight) |
| POST | `/api/search/deep` | Deep search (comprehensive) |
| POST | `/api/find-similar` | Find developers similar to a given profile |
| POST | `/api/lookup/linkedin` | Lookup person by LinkedIn URL |

## Profiles & Scoring

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/profiles/[username]` | Get developer profile |
| GET | `/api/score/[username]` | Get/compute developer score |
| GET | `/api/developer-card` | Generate developer card image |
| POST | `/api/scouting-report` | Generate AI scouting report |

## Enrichment

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/enrich/[developerId]` | Enrich developer profile (Apollo) |
| GET | `/api/enrich/status/[developerId]` | Check enrichment status |
| GET | `/api/enrich/compensation` | Estimate compensation range |
| GET | `/api/enrich/packages` | Get package/dependency data |

## Market Map

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/market-map/generate` | Create map from role brief |
| POST | `/api/market-map/enrich-company` | Enrich one company (Apollo People Search) |
| POST | `/api/market-map/enrich-news` | Fetch company news for flight risk |
| POST | `/api/market-map/classify` | AI classification (fit score, flight risk) |
| POST | `/api/market-map/reveal-contacts` | Reveal emails/phones (costs credits) |
| GET | `/api/market-map/list` | List all maps for current user |
| GET | `/api/market-map/dashboard` | Dashboard aggregate stats |
| GET | `/api/market-map/[id]` | Fetch complete map |
| PATCH | `/api/market-map/[id]/company/[companyId]` | Update company (tier, hidden) |
| POST | `/api/market-map/[id]/company/add` | Add company manually |
| PATCH | `/api/market-map/[id]/candidate/[candidateId]` | Update candidate status |
| POST | `/api/market-map/[id]/candidates/bulk-update` | Bulk update candidates |
| GET | `/api/market-map/[id]/connections` | Get connection data for map |
| GET | `/api/market-map/[id]/company-response-rates` | Response rates per company |
| POST | `/api/market-map/[id]/generate-outreach` | Generate outreach for candidates |
| GET | `/api/market-map/[id]/outreach/by-candidate` | Get outreach messages by candidate |
| GET | `/api/market-map/[id]/outreach/[messageId]` | Get specific outreach message |
| PATCH | `/api/market-map/[id]/outreach/[messageId]` | Update outreach message |
| POST | `/api/market-map/[id]/share` | Create share link |
| GET | `/api/market-map/[id]/share` | List share links |
| DELETE | `/api/market-map/[id]/share` | Revoke share link |
| POST | `/api/market-map/[id]/export-pdf` | Generate PDF export |

## Market Map Templates

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/market-map/templates` | List templates |
| POST | `/api/market-map/templates` | Save map as template |
| POST | `/api/market-map/templates/[templateId]/clone` | Clone map from template |
| GET | `/api/market-map/outreach-templates` | List outreach templates |
| POST | `/api/market-map/outreach-templates` | Create outreach template |
| PATCH | `/api/market-map/outreach-templates/[templateId]` | Update outreach template |
| DELETE | `/api/market-map/outreach-templates/[templateId]` | Delete outreach template |

## Connections

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/connections/home-base` | Get home base company |
| POST | `/api/connections/setup-home-base` | Set up home base (one-time) |
| POST | `/api/connections/lookup` | Run connection lookup for a target company |
| GET | `/api/connections/lookup/[lookupId]` | Get lookup results |
| POST | `/api/connections/linkedin-import` | Import LinkedIn connections |
| POST | `/api/connections/draft-intro` | AI-generate intro request |

## Lists

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/lists` | List all saved lists |
| POST | `/api/lists` | Create new list |
| GET | `/api/lists/[listId]` | Get list details |
| PATCH | `/api/lists/[listId]` | Update list |
| DELETE | `/api/lists/[listId]` | Delete list |
| POST | `/api/lists/[listId]/entries` | Add candidate to list |
| PATCH | `/api/lists/[listId]/entries/[entryId]` | Update list entry |
| DELETE | `/api/lists/[listId]/entries/[entryId]` | Remove from list |
| GET | `/api/lists/[listId]/entries/[entryId]/notes` | Get notes for entry |
| POST | `/api/lists/[listId]/entries/[entryId]/notes` | Add note to entry |
| GET | `/api/lists/[listId]/export` | Export list as CSV |

## Favorites

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/favorites` | List favorites |
| POST | `/api/favorites` | Add favorite |
| DELETE | `/api/favorites/[developerId]` | Remove favorite |

## Outreach Studio

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/outreach/generate` | Generate outreach sequence |
| POST | `/api/outreach/rewrite` | Rewrite a message |
| POST | `/api/outreach/improve` | Improve a message with feedback |
| POST | `/api/outreach/adapt-channel` | Adapt message for different channel |
| POST | `/api/outreach/regenerate-step` | Regenerate one step in sequence |
| POST | `/api/outreach/suggestions` | Get AI suggestions for outreach |
| GET | `/api/outreach/analytics` | Outreach performance analytics |
| GET | `/api/outreach/sequences` | List outreach sequences |
| POST | `/api/outreach/sequences` | Create new sequence |
| GET | `/api/outreach/sequences/[id]` | Get sequence |
| PATCH | `/api/outreach/sequences/[id]` | Update sequence |
| DELETE | `/api/outreach/sequences/[id]` | Delete sequence |
| GET | `/api/outreach/templates` | List outreach templates |
| POST | `/api/outreach/templates` | Create template |
| DELETE | `/api/outreach/templates/[id]` | Delete template |
| POST | `/api/outreach-draft` | Quick outreach draft |

## Sequences (Email Automation)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/sequences` | List sequences |
| POST | `/api/sequences` | Create sequence |
| GET | `/api/sequences/[id]` | Get sequence |
| PATCH | `/api/sequences/[id]` | Update sequence |
| DELETE | `/api/sequences/[id]` | Delete sequence |
| POST | `/api/sequences/[id]/steps` | Add step to sequence |
| PUT | `/api/sequences/[id]/steps` | Reorder steps |
| POST | `/api/sequences/[id]/enroll` | Enroll candidate |
| GET | `/api/sequences/[id]/enrollments` | List enrollments |
| POST | `/api/sequences/[id]/activate` | Activate sequence |
| POST | `/api/sequences/[id]/pause` | Pause sequence |
| POST | `/api/sequences/process` | Process pending sequence emails |

## Alerts & Intelligence

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/alerts/scan` | Scan for new signals |
| GET | `/api/alerts/signals` | List signals |
| GET | `/api/alerts/signals/[id]` | Get signal details |
| PATCH | `/api/alerts/signals/[id]` | Update signal (mark read) |
| GET | `/api/alerts/signals/[id]/candidates` | Candidates related to signal |
| GET | `/api/alerts/unread-count` | Unread alert count |
| GET | `/api/alerts/watchlist` | List watched companies |
| POST | `/api/alerts/watchlist` | Add company to watchlist |
| PATCH | `/api/alerts/watchlist/[id]` | Update watchlist entry |
| DELETE | `/api/alerts/watchlist/[id]` | Remove from watchlist |

## Ashby Integration

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/ashby/connect` | Check Ashby connection status |
| POST | `/api/ashby/connect` | Connect Ashby account |
| DELETE | `/api/ashby/connect` | Disconnect Ashby |
| GET | `/api/ashby/jobs` | List Ashby jobs |
| POST | `/api/ashby/push` | Push candidate to Ashby |
| GET | `/api/ashby/pushes` | List pushed candidates |

## Pipeline & Matching

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/pipeline` | Pipeline operations |
| POST | `/api/match` | Match candidates to job description |
| POST | `/api/match/parse` | Parse job description |
| POST | `/api/candidates/add` | Add candidate to pipeline |

## Apollo

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/apollo/company-search` | Company autocomplete search |

## Shared/Public

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/share/[token]` | Public shared map view |

## Cron Jobs

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/cron` | Main cron handler |
| GET | `/api/cron/index-developers` | Index new developers |
| GET | `/api/cron/scan-signals` | Scan for market signals |

## Stats

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/stats` | Platform stats |
| GET | `/api/stats/cities` | Stats by city |

## Data Ingestion

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/index` | Index developer data |
