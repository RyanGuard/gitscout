# Scout Expert Outreach Writer — Build Spec

## What Is This

An interactive outreach writing tool that lives in the Sequences tab of Scout. It's not a template generator — it's an AI writing partner that understands recruiting, knows the candidate's background, adapts to channels, generates full sequences, and learns from response data to get better over time.

A recruiter opens it and either: selects a candidate from their Scout search/map results (auto-fills everything), or pastes in candidate details manually (works standalone). Then they interact with the writer to craft perfect outreach.

## Core Concept: The Outreach Studio

The Outreach Studio is a full-page interactive workspace. Left side: candidate context + controls. Right side: live message preview that updates as the recruiter adjusts settings.

It feels like writing with a senior recruiter looking over your shoulder — someone who knows the candidate, knows what works, and helps you craft something that actually gets replies.

---

## Schema

### `outreach_sequences`
A full outreach sequence for one candidate.
```sql
create table if not exists outreach_sequences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  
  -- Candidate info (auto-filled from Scout or manual entry)
  candidate_name text not null,
  candidate_title text,
  candidate_company text,
  candidate_location text,
  candidate_linkedin_url text,
  candidate_email text,
  candidate_github_url text,
  candidate_context jsonb,
  -- { gitscout_score, fit_score, flight_risk, top_repos, recent_activity, bio }
  
  -- Source linkage (null if standalone)
  source_type text,
  -- "search", "market_map", "connection", "manual"
  source_developer_id text,
  source_map_id uuid,
  source_map_candidate_id uuid,
  
  -- Role info
  role_title text,
  role_company text,
  role_selling_points text[],
  
  -- Sequence settings
  channel text not null default 'email',
  -- "email", "linkedin", "text", "multi_channel"
  tone text not null default 'professional',
  -- "professional", "casual", "technical_peer", "executive", "warm_intro"
  sequence_length integer default 3,
  -- number of touches in the sequence
  
  -- Status
  status text not null default 'draft',
  -- "draft", "ready", "sending", "completed"
  
  -- Response tracking
  sent_at timestamptz,
  response_received boolean default false,
  response_received_at timestamptz,
  response_sentiment text,
  -- "positive", "neutral", "negative", "no_response"
  
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

### `outreach_messages`
Individual messages within a sequence.
```sql
create table if not exists outreach_messages (
  id uuid primary key default gen_random_uuid(),
  sequence_id uuid references outreach_sequences(id) on delete cascade,
  
  step_number integer not null,
  -- 1 = initial outreach, 2 = first follow-up, 3 = second follow-up, etc.
  
  delay_days integer not null default 0,
  -- days after previous message. Step 1 = 0, Step 2 = 3, Step 3 = 5, etc.
  
  channel text not null,
  -- "email", "linkedin", "text"
  
  subject_line text,
  -- null for LinkedIn/text
  
  body text not null,
  
  -- Per-message tracking
  sent_at timestamptz,
  opened_at timestamptz,
  responded_at timestamptz,
  
  -- Version history (stores previous drafts)
  revision_history jsonb default '[]',
  
  created_at timestamptz default now()
);
```

### `outreach_templates`
Reusable templates that the recruiter saves from successful sequences.
```sql
create table if not exists outreach_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  name text not null,
  description text,
  channel text not null,
  tone text not null,
  sequence_length integer not null,
  role_context text,
  selling_points text[],
  template_messages jsonb not null,
  -- array of { step_number, delay_days, channel, subject_line, body_template }
  -- body_template uses {placeholders}: {candidate_name}, {candidate_company}, {role_title}, etc.
  
  -- Performance data
  times_used integer default 0,
  response_rate float,
  -- calculated from sequences that used this template
  
  created_at timestamptz default now()
);
```

### `outreach_analytics`
Aggregated performance data for learning what works.
```sql
create table if not exists outreach_analytics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  
  -- What was sent
  channel text not null,
  tone text not null,
  sequence_length integer,
  candidate_seniority text,
  candidate_company_size text,
  role_type text,
  
  -- Anonymized content signals (not the actual message)
  used_oss_reference boolean,
  used_company_news boolean,
  used_mutual_connection boolean,
  used_specific_project boolean,
  message_word_count integer,
  subject_line_word_count integer,
  personalization_score float,
  
  -- Outcome
  response_received boolean,
  response_sentiment text,
  response_time_hours integer,
  
  created_at timestamptz default now()
);

create index idx_outreach_analytics_user on outreach_analytics (user_id, created_at desc);
create index idx_outreach_analytics_outcome on outreach_analytics (response_received, channel, tone);
```

---

## Page: Outreach Studio

### Route: `/outreach` (replace the current placeholder)

### Layout

Full-width page with three panels:

**Left Panel (280px): Candidate Context**
- If auto-filled from Scout: candidate card showing name, title, company, Scout score, fit score, flight risk, top repos, recent activity
- If manual: form fields for name, title, company, LinkedIn URL, any context
- "Import from search" button — opens a modal to pick from recent search results
- "Import from map" button — opens a modal to pick from a market map candidate

**Center Panel (flex, main area): Message Editor**
- The active message being composed/edited
- Subject line input (for email)
- Rich text body editor
- Below the editor: the sequence timeline showing all steps
- Each step is a card: "Day 0: Initial outreach (Email)" → "Day 3: Follow-up 1 (LinkedIn)" → "Day 7: Follow-up 2 (Email)"
- Click any step to edit that message

**Right Panel (300px): AI Controls + Intelligence**
- Channel selector: Email / LinkedIn / Text / Multi-channel
- Tone selector: Professional / Casual / Technical Peer / Executive / Warm Intro
- Sequence length: 1-5 touches (slider)
- Role info: title, company, selling points (editable list)
- "Generate" button — creates the full sequence
- "Rewrite" button — rewrites the current message with different approach
- "Improve" button — keeps the structure but makes it better
- "Shorten" / "Lengthen" toggles
- Intelligence section (below controls):
  - "What's working for you" — shows the recruiter's personal response rate by channel, tone, and message length
  - "Suggested approach" — Claude recommends the best strategy for THIS candidate based on their profile + the recruiter's historical data

---

## Feature 1: Write From Scratch

### Flow
1. Recruiter selects a candidate (from Scout or manual entry)
2. Fills in role info + selling points (or loads a template)
3. Sets channel, tone, sequence length
4. Clicks "Generate"

### Claude Prompt for Initial Generation
```
You are an elite technical recruiter writing outreach to a software engineering candidate. You have a 40% response rate — double the industry average. Your secret: extreme personalization, brevity, and genuine respect for the candidate's time.

CANDIDATE:
Name: {candidate_name}
Title: {candidate_title}
Company: {candidate_company}
Location: {candidate_location}
{if Scout data exists:}
Scout Score: {score}/100
Top repositories: {top_repos}
Recent activity: {recent_activity}
Bio: {bio}
{if from market map:}
Fit score: {fit_score}/100
Flight risk: {flight_risk}
Flight risk signals: {flight_risk_signals}
{if connection mapper data:}
Warm connections: {connections}
{end if}

ROLE:
Title: {role_title}
Company: {role_company}
Selling points:
{selling_points as bullets}

CHANNEL: {channel}
TONE: {tone}
SEQUENCE LENGTH: {sequence_length} messages

CHANNEL RULES:
- Email: subject line (5-8 words, specific, no clickbait) + body (under 100 words for initial, under 60 for follow-ups)
- LinkedIn: no subject line, under 300 characters for connection request, under 150 words for InMail
- Text: under 160 characters, extremely casual, feels like a friend texting

TONE RULES:
- Professional: polished but warm. "I noticed your work on..." not "I came across your profile..."
- Casual: conversational, like a peer. Contractions, short sentences, maybe humor.
- Technical peer: focus on the technical challenge, speak engineer-to-engineer. Reference specific tech.
- Executive: formal, strategic, focuses on impact and leadership.
- Warm intro: you have a mutual connection. Lead with the connection. "Sarah Chen suggested I reach out..."

SEQUENCE RULES:
- Message 1 (Day 0): The hook. Personalized opening + brief role pitch + soft ask.
- Message 2 (Day 3): The value add. Share something useful (article, insight, company news) + gentle nudge.
- Message 3 (Day 5-7): The human. Short, direct, acknowledges they're busy. "Totally understand if the timing isn't right."
- Message 4+ (Day 10-14): The pivot. Try a different angle or channel.

{if multi_channel:}
MULTI-CHANNEL SEQUENCE:
- Message 1: Email (most professional, detailed)
- Message 2: LinkedIn (shorter, more casual, references the email)
- Message 3: Email (follow-up, different angle)
- Message 4+: LinkedIn or text depending on seniority
{end if}

PERSONALIZATION RULES:
- NEVER: "I came across your profile", "Hope this finds you well", "I'm reaching out because"
- ALWAYS: Reference something SPECIFIC about the candidate — a repo they built, their company's recent news, a technical decision they made
- If Scout data exists: reference their actual code contributions, not generic claims
- If connection data exists: lead with the connection in message 1
- Each message in the sequence must use a DIFFERENT personalization angle
- If the candidate has flight risk signals, subtly increase urgency without being desperate

{if recruiter has response data:}
YOUR PERSONAL DATA:
Your highest response rate channel: {best_channel}
Your best performing tone: {best_tone}
Average response rate: {avg_response_rate}%
Best message length: {best_length} words
{end if}

Generate the full sequence. For each message provide:
- step_number
- delay_days (from previous message)
- channel
- subject_line (null if LinkedIn/text)
- body

Respond in JSON:
{
  "strategy": "one sentence explaining the overall approach",
  "messages": [
    {
      "step_number": 1,
      "delay_days": 0,
      "channel": "email",
      "subject_line": "...",
      "body": "..."
    }
  ]
}
```

---

## Feature 2: Rewrite / Improve Existing Draft

### Flow
1. Recruiter pastes their own draft into the editor
2. Clicks "Improve" or "Rewrite"
3. Claude analyzes and either polishes or completely rewrites

### "Improve" — keeps the structure, makes it better
```
You are editing a recruiter's outreach message. Keep their voice and structure but make it better.

THEIR DRAFT:
{message}

CANDIDATE CONTEXT:
{candidate info if available}

Improve this message by:
1. Making the opening more specific and personal (remove any generic phrases)
2. Tightening the body (cut words, not ideas)
3. Making the ask clearer and softer
4. Keeping THEIR voice — don't make it sound like a different person wrote it

Return the improved version only. No explanation.
```

### "Rewrite" — completely new approach
```
The recruiter wants a completely different take on this outreach.

THEIR ORIGINAL (for context on what they're trying to do):
{message}

CANDIDATE:
{candidate info}

Write a fresh version from scratch. Different opening angle, different structure, different ask. Keep the same tone and channel constraints.
```

---

## Feature 3: Follow-Up Sequences

The sequence timeline at the bottom of the editor shows all messages as a visual timeline:

```
┌─────────┐    ┌─────────┐    ┌─────────┐
│ Day 0   │───▶│ Day 3   │───▶│ Day 7   │
│ Email   │    │ LinkedIn│    │ Email   │
│ Initial │    │ Nudge   │    │ Close   │
│ ✏️      │    │ ✏️      │    │ ✏️      │
└─────────┘    └─────────┘    └─────────┘
```

- Click any step to edit it in the center panel
- Drag to reorder or change timing
- "+" button to add a step
- "×" to remove a step
- Each step shows: day number, channel icon, message preview (first 50 chars)
- The active step is highlighted

### Regenerate Single Step
If the recruiter likes messages 1 and 3 but not message 2, they can click "Regenerate" on just that step. Claude gets context of the full sequence and generates a new message 2 that fits between 1 and 3.

---

## Feature 4: Channel Adaptation

When the recruiter switches channels (email → LinkedIn), Claude automatically adapts:

```
Convert this email outreach to a LinkedIn message.

ORIGINAL EMAIL:
Subject: {subject}
{body}

LINKEDIN RULES:
- No subject line
- Under 150 words for InMail, under 300 characters for connection request
- More casual than email
- No formal sign-off
- Reference that you're connecting on LinkedIn specifically

Convert while keeping the same personalization and core message.
```

Same for text:
```
Convert this to a text message. Under 160 characters. 
Extremely casual, like texting a friend. Drop all formality.
Keep the core ask.
```

The channel selector should show a real-time character/word count that changes color as you approach the limit (green → yellow → red).

---

## Feature 5: Learning From Response Data

This is what makes the tool get smarter over time.

### Data Collection
When a recruiter marks a sequence as "sent", track:
- Channel, tone, sequence length
- Whether they referenced OSS, company news, mutual connections
- Word count, personalization level
- Whether they got a response, and the sentiment

Write to `outreach_analytics` on every status change.

### Personal Intelligence
On the right panel, show the recruiter their own data:

**"What's working for you"**
```
Your stats (last 90 days):
• Best channel: LinkedIn (38% response rate vs 22% email)
• Best tone: Technical peer (41% response rate)
• Optimal length: 60-80 words (34% response rate vs 18% for 120+ words)
• Top signal: Referencing specific repos (+15% response rate)
```

This is computed from their `outreach_analytics` data. Only show when they have 10+ data points.

**"Suggested approach"**
Before they generate, Claude recommends a strategy based on their data + the candidate:

```
Based on your track record and this candidate's profile:

📧 Use LinkedIn — your LinkedIn response rate is 1.7x your email rate
🎯 Lead with their Kubernetes contributions — your messages referencing specific projects get 15% more responses
📏 Keep it under 80 words — your shorter messages consistently outperform
⏰ Send Tuesday morning — your best response times are Tue-Thu before noon

[Apply these suggestions]
```

Clicking "Apply these suggestions" pre-sets the channel, tone, and generates with those constraints.

### Global Intelligence (Future — when you have multiple users)
Aggregate anonymized response data across all users:
- "Engineers at companies with 50-200 employees respond 2.3x more on LinkedIn vs email"
- "Messages under 75 words get 40% more responses than messages over 120 words"
- "Referencing open source contributions increases response rate by 18%"

Don't build this yet — just capture the data. Same pattern as the market map outreach_signals table.

---

## Integration Points

### From Search Results
On each developer card in search results, add a small "Write outreach" icon. Clicking it opens the Outreach Studio with the candidate auto-filled from their Scout profile (name, title, company, score, top repos, etc.).

### From Market Map
On each candidate in the market map, add "Write outreach" to the action menu. Auto-fills candidate info + fit score + flight risk + company context.

### From Connection Mapper
If the candidate has warm connections, pre-fill the connection data and default to "warm_intro" tone. The generated message leads with the mutual connection.

### Export
- "Copy to clipboard" — plain text for pasting into email/LinkedIn
- "Export as CSV" — for importing into Apollo sequences, Outreach, or Salesloft
- "Save as template" — saves the sequence as a reusable template

---

## Build Sequence

### Step 1: Schema
Create all 4 tables: outreach_sequences, outreach_messages, outreach_templates, outreach_analytics

### Step 2: API Routes
- POST /api/outreach/generate — generate a full sequence
- POST /api/outreach/improve — improve an existing message
- POST /api/outreach/rewrite — rewrite a message with new approach
- POST /api/outreach/adapt-channel — convert between channels
- POST /api/outreach/regenerate-step — regenerate one step in a sequence
- GET /api/outreach/sequences — list user's sequences
- GET /api/outreach/sequences/[id] — get a sequence with messages
- POST /api/outreach/sequences — create/save a sequence
- PATCH /api/outreach/sequences/[id] — update status (sent, responded, etc.)
- GET /api/outreach/analytics — personal response data
- GET /api/outreach/templates — list templates
- POST /api/outreach/templates — save a template
- GET /api/outreach/suggestions/[candidateId] — AI-suggested approach for a specific candidate

### Step 3: Outreach Studio Page
Build the three-panel layout at /outreach:
- Left: candidate context panel
- Center: message editor with sequence timeline
- Right: AI controls and intelligence

### Step 4: Generate + Edit Flow
Wire up the generate button → Claude API → message display. Make the editor interactive — editable text, regenerate per step, reorder.

### Step 5: Improve / Rewrite
Add the improve and rewrite buttons. These call Claude with the current message and return an updated version. Show a diff or side-by-side so the recruiter can compare.

### Step 6: Channel Adaptation
Wire up the channel selector to auto-adapt messages. Show character/word count with color coding.

### Step 7: Sequence Timeline
Build the visual timeline component. Drag to reorder, click to edit, add/remove steps.

### Step 8: Templates
Save/load template functionality. Track usage count and response rate per template.

### Step 9: Integration — Search + Map + Connections
Add "Write outreach" entry points on developer cards, map candidates, and connection results. Each auto-fills the studio with relevant context.

### Step 10: Analytics + Learning
Build the response tracking pipeline. Show "What's working for you" panel. Generate AI suggestions based on personal data.

### Step 11: Export
Copy to clipboard, CSV export (compatible with Apollo/Outreach/Salesloft), save as template.

---

## Important Notes

### The Messages Must Be Good
This feature lives or dies on message quality. If the AI writes generic recruiter spam, nobody will use it. Every generated message must:
- Reference something SPECIFIC about the candidate (not just their company/title)
- Be under 100 words for email, under 300 chars for LinkedIn
- Never use phrases like "I came across your profile", "hope this finds you well", "I'm reaching out because"
- Feel like a real person wrote it, not AI

Test extensively with real candidates before shipping. The Claude prompts above are starting points — iterate on them based on output quality.

### The Learning Loop is the Moat
Any tool can generate outreach with Claude. The differentiator is learning from response data and getting better over time. The "What's working for you" panel + "Suggested approach" is what turns this from a commodity feature into a competitive advantage. But it only works if recruiters actually mark sequences as sent/responded. Make that tracking frictionless — ideally automatic via email integration, but manual marking as a V1.

### Channel Constraints are Real
- LinkedIn InMail: 200 character subject, 1900 character body (but shorter is better)
- LinkedIn connection request: 300 characters max
- Email: no hard limit but 50-100 words performs best
- Text/SMS: 160 characters for single SMS, 1600 for MMS
- Show these limits in the UI with a live counter

### Multi-Channel is the Power Move
The best recruiters don't just email. They email, then LinkedIn, then email again with a different angle. The multi-channel sequence is what separates this from a simple email template tool. Make it easy to mix channels within one sequence.
