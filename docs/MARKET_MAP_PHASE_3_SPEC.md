# GitScout Market Map — Phase 3 Build Spec

## Context

Phase 1 built the core: schema, Apollo enrichment, Claude classification, progressive-loading map UI.
Phase 2 added control + intelligence: drag-and-drop tiers, add/remove companies, candidate status tracking, bulk actions, flight risk signals, saved templates.

Phase 3 turns the map into a complete recruiting workflow. Four features:

1. HM-shareable export (branded PDF + live shareable link)
2. AI outreach generation (personalized messages from map context)
3. Pipeline funnel view (visual pipeline tracking across maps)
4. Outreach tracking + response logging

Read the full codebase including Phase 1 and Phase 2 work before starting. Understand how maps, companies, and candidates are stored, how enrichment works, and how the frontend renders map state.

---

## Feature 1: HM-Shareable Export

This is the feature that sells GitScout. When a recruiter can walk into a kickoff call with a branded market landscape, the product sells itself.

### 1A: Share Link with Permission Tiers

**New table: `map_shares`**
```
id: uuid (PK)
map_id: uuid (FK to market_maps)
user_id: uuid (FK to auth.users — who created the share)
share_token: text (unique, URL-safe random string, 32 chars)
permission_level: text (enum: "overview", "full")
recipient_name: text (optional — "John Smith, VP Eng")
recipient_email: text (optional — for tracking who it was shared with)
expires_at: timestamptz (default: 30 days from creation)
view_count: integer (default 0)
last_viewed_at: timestamptz
created_at: timestamptz
```

**Permission levels:**

`overview` — the hiring manager sees:
- Map title and role brief summary
- Company tier breakdown (Tier A/B/C with company names, headcount, HQ, growth rate)
- Aggregate stats: total companies mapped, total candidates identified, average fit score, count by status
- Flight risk distribution per company (e.g. "3 high flight risk candidates at CoreWeave")
- Comp range context (if available from job postings)
- Does NOT show: individual candidate names, emails, LinkedIn URLs, or GitScout scores

`full` — the hiring manager sees everything the recruiter sees, minus edit controls:
- All candidate names, titles, fit scores, flight risk
- No emails/phones (those are never shared externally)
- No edit capabilities (read-only view)
- No outreach or pipeline status (internal to the recruiter)

**Backend routes:**

```
POST /api/market-map/[mapId]/share
Body: {
  "permission_level": "overview",
  "recipient_name": "John Smith",
  "recipient_email": "john@company.com",
  "expires_days": 30
}
Response: {
  "share_url": "https://gitscout.dev/share/[share_token]",
  "share_token": "abc123...",
  "expires_at": "2026-04-25T..."
}
```

```
GET /api/share/[share_token]
```
Public route (no auth required). Validates token, checks expiration, increments view_count, returns map data filtered by permission level.

**Frontend — share modal:**
- Button on map header: "Share with HM"
- Modal opens with:
  - Permission level toggle: "Overview (company-level only)" vs "Full detail (includes candidates)"
  - Optional: recipient name and email fields
  - Expiration dropdown: 7 days, 14 days, 30 days, 90 days
  - "Generate link" button
- After generating: show the URL with a copy button, and a "Send via email" option (opens mailto: with a pre-drafted message)

**Frontend — shared view page:**

New route: `/share/[token]` — this is a public page, no login required.

Design this as a clean, branded, read-only view:
- GitScout logo in header + "Shared by [recruiter name]"
- Role brief summary at top
- Map laid out by tiers (same visual structure as the main map, but no edit controls)
- For "overview" permission: company cards without expanding to candidates, stat cards, tier summaries
- For "full" permission: expandable company cards showing candidates with fit scores and flight risk
- Footer: "Powered by GitScout · This link expires [date]"
- No sidebar navigation. No login prompts. Clean, self-contained page.

**Important:** This page must render well for non-technical hiring managers. No jargon. "GitScout score" should have a tooltip: "Quality signal based on open source contributions." Flight risk badges should say "Likely open to new opportunities" not "High flight risk."

### 1B: PDF Export

**What it generates:** A polished, multi-page PDF that the recruiter can attach to an email or present in a meeting.

**Page structure:**
- Page 1: Cover — role title, date generated, recruiter name, GitScout branding
- Page 2: Executive summary — total companies mapped, candidates identified, tier breakdown chart, top-line stats
- Page 3+: Tier A companies (one section per company: name, domain, headcount, growth, candidate count, avg fit score, flight risk summary)
- Then Tier B, then Tier C (same format)
- Final page: methodology note — "This market map was generated using GitScout's AI-powered talent intelligence platform. Companies were classified by relevance to the role brief. Candidate quality is scored using GitScout's 5-pillar evaluation engine."

**Two PDF variants:**
- "Overview PDF" — company-level only, no candidate names. For initial HM alignment.
- "Full PDF" — includes candidate names, titles, fit scores. For deep-dive conversations.

**Implementation:**

Use `@react-pdf/renderer` (runs server-side in Next.js API routes). Don't use puppeteer — it requires a headless browser and is heavy for Vercel deployment.

```
POST /api/market-map/[mapId]/export-pdf
Body: {
  "variant": "overview" | "full"
}
Response: PDF file stream (Content-Type: application/pdf)
```

The route:
1. Fetches the complete map data (companies + candidates)
2. Renders the PDF using @react-pdf/renderer components
3. Returns the PDF as a downloadable file

**Frontend:**
- "Export" dropdown button on map header with two options:
  - "Download overview PDF (company-level)"
  - "Download full PDF (with candidates)"
- Loading state while PDF generates (can take 2-5 seconds)
- Auto-downloads when ready

### 1C: Presentation Mode

**What it does:** A full-screen, clean view of the map optimized for screen-sharing on Zoom/Meet calls. Strip all editing controls, enlarge typography, simplify the layout.

**Frontend:**
- Button on map header: "Present" (or a screen/projector icon)
- Enters a full-screen mode (use the Fullscreen API, or just a dedicated `/market-map/[id]/present` route)
- Layout changes:
  - No sidebar
  - No search/filter controls
  - No edit buttons, checkboxes, or action bars
  - Company cards are larger with more whitespace
  - Tier headers are prominent
  - Stats cards are large and centered at top
  - Candidate list hidden by default — click a company to expand (so the recruiter controls the reveal)
- ESC or a close button exits presentation mode
- Keyboard navigation: arrow keys to move between tiers, Enter to expand a company

This is lower effort than the export features — it's mostly a CSS/layout variant of the existing map view with controls hidden.

---

## Feature 2: AI Outreach Generation

The map identifies who to reach out to. This feature writes the first message.

### 2A: Schema Addition

New table: `outreach_messages`
```
id: uuid (PK)
map_id: uuid (FK to market_maps)
candidate_id: uuid (FK to map_candidates)
user_id: uuid (FK to auth.users)
subject_line: text
first_line: text (the personalized opening — the hard part)
body: text (the template body)
variant: text (e.g. "direct", "warm_intro", "referral_ask")
status: text (enum: "draft", "sent", "responded", "bounced")
sent_at: timestamptz
response_received_at: timestamptz
created_at: timestamptz
```

### 2B: Message Generation

**Trigger:** Recruiter selects candidates (using bulk checkboxes from Phase 2), clicks "Generate outreach" in the floating action bar.

**Flow:**
1. Check if selected candidates have emails revealed. If not, prompt: "3 of 5 selected candidates don't have emails yet. Reveal emails first? (3 credits)"
2. After emails are confirmed, open the outreach generation modal
3. Modal shows:
   - Role brief summary (pre-filled from the map)
   - Tone selector: "Professional", "Casual", "Technical peer" (changes Claude's writing style)
   - Selling points: text area where the recruiter adds 2-3 bullet points about why the role/company is compelling (e.g. "Series B, just raised $50M", "Founding platform team", "Remote-friendly")
   - "Generate messages" button
4. Claude generates a personalized message per candidate
5. Results shown in a review interface: list of candidates, each with their generated message, editable before export

**Backend route:**
```
POST /api/market-map/[mapId]/generate-outreach
Body: {
  "candidate_ids": ["uuid1", "uuid2", ...],
  "tone": "professional",
  "selling_points": ["Series B, $50M raised", "Founding platform eng team", "Remote-first"],
  "custom_instructions": "optional freeform notes"
}
```

**Claude prompt for outreach generation:**

```
You are a technical recruiter writing personalized outreach messages to engineering candidates. Your messages should feel human, specific, and respectful of the candidate's time.

ROLE BRIEF:
Title: {role_title}
Level: {role_level}
Stack: {role_stack}
Company selling points:
{selling_points as bullet list}

TONE: {tone}
- "professional": polished but warm, like a senior recruiter at a top firm
- "casual": friendly and conversational, like a peer reaching out
- "technical_peer": focuses on the technical challenge, speaks engineer-to-engineer

For each candidate, write:
1. SUBJECT LINE: Short, specific, no clickbait. Reference something real about the candidate or their company.
2. FIRST LINE: 1-2 sentences that are personalized to THIS specific person. Reference their current company, role, or something specific about their background. Never generic. Never "I came across your profile."
3. BODY: 3-4 sentences about the opportunity. Lead with what's compelling for THEM, not what the company needs. End with a soft ask (15-min chat, not "apply now").

CANDIDATES:
{for each candidate, include:}
- Name: {name}
- Current title: {title}
- Current company: {company_name}
- Company context: {company_domain — what the company does}
- Seniority: {seniority}
- Location: {city, state}
- Fit score: {fit_score}/100
- Fit reasoning: {fit_reasoning}
- Flight risk: {flight_risk}
- Flight risk signals: {flight_risk_signals}
{if GitScout score exists:}
- GitScout score: {gitscout_score} (based on open source contributions)
{end if}

RULES:
- Never mention flight risk, fit scores, or GitScout scores in the message. Those are internal signals.
- If flight risk is high, make the outreach slightly more urgent but don't reference why.
- If the candidate has a GitScout score, you can reference their open source work naturally: "I noticed your contributions to [relevant area]" — but only if it feels organic.
- Each message must be different. Do not use the same opening formula twice.
- Keep total message length under 150 words. Shorter is better.

Respond in JSON:
{
  "messages": [
    {
      "candidate_id": "...",
      "subject_line": "...",
      "first_line": "...",
      "body": "..."
    }
  ]
}
```

### 2C: Outreach Review Interface

**Frontend — outreach modal (after generation):**

Full-screen or large modal showing all generated messages:

- Left sidebar: list of candidates with name, company, and a checkmark (default all checked)
- Main area: currently selected candidate's message
  - Subject line (editable input)
  - First line (editable text, highlighted in a different color to show it's the personalized part)
  - Body (editable textarea)
  - "Regenerate" button per message (calls Claude again for just this one candidate with the note "try a different angle")
- Bottom actions:
  - "Export selected as CSV" — downloads a CSV with columns: first_name, last_name, email, subject_line, first_line, body, company, title
  - "Copy all to clipboard" — for pasting into outreach tools
  - "Save as drafts" — saves to outreach_messages table with status "draft" for later

**CSV format:** Design the CSV to be directly importable into Apollo sequences, Outreach, or Salesloft. The column headers should match what these tools expect:
```
first_name, last_name, email, company, title, subject, body
```
Where `body` is the concatenation of first_line + body.

### 2D: Outreach Templates

Let the recruiter save their selling points + tone as a reusable outreach template, so they don't re-enter them for every batch.

**Schema addition — new table: `outreach_templates`**
```
id: uuid (PK)
user_id: uuid (FK to auth.users)
name: text
tone: text
selling_points: text[]
custom_instructions: text
body_template: text (optional — a fixed body the recruiter always uses, with {first_line} placeholder)
created_at: timestamptz
```

**Frontend:**
- In the outreach generation modal, add "Save as template" button after entering selling points
- Add "Load template" dropdown above the selling points field
- Template management page (simple CRUD) under settings or as a sub-page

---

## Feature 3: Pipeline Funnel View

Phase 2 added candidate status tracking (mapped → shortlisted → contacted → responded → screening → offer → rejected). Phase 3 adds the visual funnel and aggregate dashboard.

### 3A: Funnel View Per Map

**New component:** Funnel visualization at the top of each map page, collapsible.

**Frontend:**
- Horizontal funnel showing status stages as connected sections
- Each section shows: stage name, candidate count, conversion rate from previous stage
- Visual width of each section is proportional to the count (classic funnel shape)
- Click any stage to filter the map below to only show candidates in that status
- Color coding matches the status badges from Phase 2

**Example funnel:**
```
Mapped (87) → Shortlisted (23) → Contacted (14) → Responded (6) → Screening (3) → Offer (1)
                 26% conversion    61%              43%              50%             33%
```

**Implementation:**
- Pure frontend calculation — query all candidates for the map, group by status, compute counts and percentages
- Use a simple SVG or CSS-based funnel (not a charting library — keep it lightweight)
- The funnel should be compact: one horizontal bar with colored segments, numbers below each segment
- Collapsible: recruiter can hide it to focus on the map itself

### 3B: Aggregate Dashboard

**New page:** `/market-map/dashboard`

Shows the recruiter's recruiting activity across ALL active maps.

**Layout:**
- Top row: summary metric cards
  - Active maps: count of maps with status "ready"
  - Total candidates tracked: across all maps
  - In pipeline (shortlisted+): total candidates past the "mapped" stage
  - Response rate: responded / contacted (percentage)
  - Avg time to first response: if tracking timestamps

- Middle: list of active maps with mini-funnels
  - Each map shows: name, role title, date created, mini funnel bar, key stats
  - Sort by: most recently active, most candidates, most stale
  - Click to open the full map

- Bottom: activity feed (optional, lower priority)
  - "You shortlisted 5 candidates on your CoreWeave map"
  - "2 candidates responded on your Platform Engineer search"
  - Chronological log of status changes across all maps

**Backend route:**
```
GET /api/market-map/dashboard
```
Returns: array of maps with aggregate stats per map. Single query with GROUP BY on candidate status per map.

### 3C: Pipeline Status Timestamps

To calculate conversion rates and time-in-stage, add timestamp tracking for status changes.

**Schema addition — new table: `candidate_status_history`**
```
id: uuid (PK)
candidate_id: uuid (FK to map_candidates)
map_id: uuid (FK to market_maps)
from_status: text
to_status: text
changed_at: timestamptz
changed_by: uuid (FK to auth.users)
```

Every time a candidate's status changes (via the PATCH endpoint or bulk update), insert a row into this table. This enables:
- Time-in-stage calculations (how long before a shortlisted candidate gets contacted?)
- Conversion rate tracking over time
- Activity feed for the dashboard
- Historical audit trail

Update the candidate status PATCH route and bulk-update route to write to this table on every status change.

---

## Feature 4: Outreach Tracking + Response Logging

Close the loop: after outreach is sent, track what happens.

### 4A: Manual Response Logging

**Frontend — on the candidate detail panel:**
- If the candidate has outreach_messages with status "sent", show an "Outreach history" section
- Show: date sent, subject line, body preview
- Action buttons: "Mark as responded" / "Mark as bounced"
- "Mark as responded" → updates outreach_messages.status to "responded", sets response_received_at, and auto-advances the candidate's pipeline status to "responded"

### 4B: Outreach Status on Map

**Frontend — on the candidate row in the map:**
- If candidate has been contacted (outreach_messages exist), show a small mail icon
- Icon color: gray (sent, no response), green (responded), red (bounced)
- Hover tooltip: "Outreach sent Mar 15 · No response" or "Responded Mar 18"

### 4C: Response Rate Per Company

**Aggregate signal:** After enough outreach has been sent, compute response rates per company.

**Backend:**
```
GET /api/market-map/[mapId]/company-response-rates
```
For each company on the map, return:
- candidates_contacted: count
- candidates_responded: count
- response_rate: percentage
- avg_response_time_days: average days between sent and responded

**Frontend:**
- Show response rate as a small badge on the company card (only visible after 3+ candidates contacted at that company)
- This becomes the foundation for Phase 4's cross-search intelligence — eventually you aggregate this across ALL users, not just one recruiter's maps

### 4D: Response Data for Future Intelligence

This is the data logging foundation for Phase 4's network effects. Even if you don't surface cross-user intelligence yet, start capturing:

On every outreach status change, log to a new table:

**New table: `outreach_signals`**
```
id: uuid (PK)
company_domain: text (normalized — e.g. "coreweave.com")
candidate_seniority: text
candidate_title_keywords: text[] (normalized — e.g. ["platform", "engineer"])
outreach_tone: text
outreach_sent_at: timestamptz
response_received: boolean
response_time_hours: integer
bounce: boolean
user_id: uuid (FK — for per-user filtering, but data can be aggregated anonymously)
created_at: timestamptz
```

No candidate PII in this table — just the signals. This table is designed to be aggregatable across users later. When you have 50+ recruiters using GitScout and thousands of outreach signals, you can compute: "What's the average response rate for senior engineers at [company]?" and surface it on the map.

Don't build the aggregation UI yet. Just build the logging. The data is the moat.

---

## Build Sequence

**Step 1: Share link backend**
Create the map_shares table. Build the POST /share and GET /share/[token] routes. Test with curl — verify token generation, permission filtering, and expiration.

**Step 2: Shared view page**
Build the public `/share/[token]` page. Two variants: overview and full. Test by generating a share link and opening it in an incognito window.

**Step 3: Share modal UI**
Add the "Share with HM" button to the map header. Build the modal with permission toggle, expiration, and copy-link flow.

**Step 4: PDF export backend**
Install @react-pdf/renderer. Build the PDF generation route. Start with the overview variant — cover page, executive summary, tier breakdown. Test the output.

**Step 5: PDF export — full variant**
Add the full PDF variant with candidate details. Add the export dropdown to the map header.

**Step 6: Presentation mode**
Build the `/market-map/[id]/present` route or fullscreen mode. Strip controls, enlarge typography, add keyboard navigation.

**Step 7: Outreach generation backend**
Create the outreach_messages table. Build the generate-outreach route with the Claude prompt. Test with real candidate data — verify messages are personalized and not generic.

**Step 8: Outreach review UI**
Build the outreach modal: candidate sidebar, editable messages, regenerate per-candidate, export as CSV.

**Step 9: Outreach templates**
Create the outreach_templates table. Add save/load template to the generation modal.

**Step 10: Pipeline status timestamps**
Create the candidate_status_history table. Update all status-change routes to log history. Test that history is recorded on every change.

**Step 11: Funnel view per map**
Build the funnel visualization component. Add to the map page header (collapsible). Wire to real candidate status data.

**Step 12: Aggregate dashboard**
Build the /market-map/dashboard page. Metric cards, map list with mini-funnels, activity feed.

**Step 13: Manual response logging**
Add outreach history section to candidate detail panel. "Mark as responded" / "Mark as bounced" buttons. Auto-advance pipeline status.

**Step 14: Outreach status on map**
Add mail icon to candidate rows showing outreach state. Hover tooltips.

**Step 15: Response rate per company**
Build the company response rate aggregation. Add badge to company cards.

**Step 16: Outreach signals logging**
Create the outreach_signals table. Log anonymized outreach signals on every status change. No UI for this — it's infrastructure for Phase 4.

---

## Important Implementation Notes

### PDF Generation
- Use `@react-pdf/renderer`, NOT puppeteer or playwright. Puppeteer requires a headless browser which is problematic on Vercel serverless.
- The PDF route may take 3-5 seconds for large maps. Return a loading state to the frontend while it generates.
- Keep the PDF design simple and professional. Use only 2 fonts (one sans-serif for body, one for headings). GitScout green (#0F6E56) as the accent color. White background. Clean tables for company data.
- Test PDF output at different map sizes: 5 companies (small), 15 companies (medium), 25 companies (large). Make sure pagination works correctly.

### Share Link Security
- Share tokens must be cryptographically random (use `crypto.randomBytes(24).toString('hex')` or similar)
- The public share route must NOT leak data beyond the permission level. Double-check: if permission is "overview", no candidate names appear anywhere in the API response — not in the data, not in metadata, not in error messages.
- Rate limit the public share route to prevent scraping (10 requests per minute per token)
- Add a "Revoke link" option in the share modal that deletes the map_shares row

### Outreach Message Quality
- The Claude prompt is the most important piece of this feature. Test it extensively with real candidate data. The messages must feel like a human recruiter wrote them — not AI slop.
- Common failure modes to watch for:
  - Generic openings ("I came across your profile...") — the prompt explicitly forbids this but verify
  - Mentioning internal signals ("your high flight risk score...") — never expose internal data
  - Same opening formula across all candidates — each must be unique
  - Messages that are too long (>150 words) — recruiters know shorter = higher response rate
- If the first generation produces weak messages, iterate on the prompt before shipping.

### CSV Export Compatibility
- Test the CSV import in Apollo's sequence tool if you have access. Column headers matter.
- Include a BOM (byte order mark) at the start of the CSV for Excel compatibility: `\uFEFF`
- Escape any commas or newlines in message content
- UTF-8 encoding

### Performance
- The dashboard page may be slow if the recruiter has many maps with thousands of candidates. Use Supabase aggregate queries (COUNT, GROUP BY) rather than fetching all candidates and computing on the frontend.
- The funnel component should be pure frontend calculation based on already-fetched candidate data — no additional API call needed.
- Outreach generation for 10 candidates takes one Claude API call (batch). For 20+, split into batches of 10 to avoid token limits and timeout issues.

### Data Model Integrity
- Every outreach_messages row must reference a valid candidate_id and map_id. Enforce with foreign keys.
- candidate_status_history is append-only. Never update or delete rows in this table.
- outreach_signals is designed for future aggregation. Keep it denormalized (company_domain as text, not FK) so it can be queried independently of the map structure.

Start with Step 1 and work through sequentially. Each step should be committed and testable before moving to the next. Ask me if you hit any ambiguity.
