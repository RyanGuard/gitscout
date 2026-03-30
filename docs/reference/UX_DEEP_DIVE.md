# Scout UX Deep Dive
## Full Platform Audit: What to Keep, What to Kill, What's Missing

---

## Current State Assessment

Based on the current deployment, Scout has a clean landing page with dark theme, a single search bar ("Search developers by name, language, or location"), tag-based quick filters (ios developers, San Francisco, machine learning, TypeScript), and the beginnings of a sourcing tool. The brand identity — the scout icon + "Scout" name — is solid.

**The honest assessment:** Right now it looks like a developer search demo, not a recruiter's daily-driver tool. That's fine for MVP — but let's map the full platform UX that makes this something recruiters can't live without.

---

## Platform Architecture: The Five Core Screens

### 1. DASHBOARD (Home After Login)
### 2. SEARCH 
### 3. DEVELOPER PROFILE
### 4. SAVED LISTS / PIPELINE
### 5. SETTINGS / ACCOUNT

---

## Screen 1: DASHBOARD

### What It Should Be
The dashboard is not a landing page. It's a recruiter's morning briefing — "here's what matters right now." Think Bloomberg terminal for hiring, not a marketing page.

### Current Problem
Right now, the landing page IS the search page. There's no logged-in state, no persistent context, no sense of "my work." A recruiter opens Scout and has zero context about what they were doing yesterday.

### What to Build

**Top Section — Active Searches Summary**
- Cards showing your 3 most recent searches with result counts
- "Continue searching" one-click resume
- Last searched timestamp
- Example: "React developers in Austin — 47 results — 2 days ago"

**Middle Section — Saved Developers Feed**
- Developers you've saved, sorted by most recently active on GitHub
- Alert badges: "3 new commits this week" or "New repo created"
- This creates a reason to come back daily

**Right Sidebar — Quick Stats**
- Total developers searched this month
- Total developers saved
- API usage / rate limit status (if relevant)
- Searches remaining (if on a usage plan)

**Bottom Section — Trending Developers (Optional/V2)**
- "Rising stars" in languages you've searched before
- Developers whose star counts are spiking
- This is a discovery play, not critical for MVP

### What to Remove
- The hero/marketing content should only show for logged-out visitors
- Once logged in, skip straight to the working dashboard
- Kill any "how it works" or promotional content from the authenticated experience

### Key UX Principles
- Zero clicks to resume yesterday's work
- Information density > whitespace (recruiters are power users)
- Everything clickable leads somewhere useful

---

## Screen 2: SEARCH (The Core Product)

### Current State
Single search bar with text input and tag chips. This is the right starting point but needs significant depth.

### What to Keep
- The dark theme works well for a tool used all day
- Single prominent search bar is correct — don't over-complicate the entry point
- Tag chips for quick filters are good for discovery

### What to Change

**Search Bar — Needs Structured Input, Not Just Free Text**

The current "Search developers by name, language, or location" is too vague. Recruiters think in structured criteria. Replace with a multi-field search or smart parser:

```
Option A: Structured fields (recommended for V1)
┌─────────────────────────────────────────────────┐
│  Language: [TypeScript    ▼]                     │
│  Location: [San Francisco   ]                    │
│  Min Stars: [100          ]                      │
│  Role Type: [Frontend ▼]                         │
│                            [Search]  [Advanced]  │
└─────────────────────────────────────────────────┘

Option B: Smart NLP bar (V2, more ambitious)
┌─────────────────────────────────────────────────┐
│  "Senior React developers in Austin with 500+   │
│   stars and active in last 90 days"              │
│                            [Search]              │
└─────────────────────────────────────────────────┘
```

Option A is better for V1 because recruiters want explicit control over filters. Option B is sexy but requires NLP parsing you'd need to build.

**Filter Sidebar (Add This)**

After search results load, show a left sidebar with refinable filters:

- **Language** — Multi-select checkboxes (Python, JavaScript, TypeScript, Go, Rust, etc.)
- **Location** — Text input with autocomplete
- **Min/Max Stars** — Range slider
- **Min/Max Followers** — Range slider
- **Account Age** — Dropdown (1yr+, 3yr+, 5yr+, 10yr+)
- **Activity** — Active in last 30/90/180/365 days
- **Hireable** — Toggle (only show profiles with hireable: true)
- **Has Email** — Toggle (critical for sourcing, this is gold)
- **Scout Score** — Range slider (once scoring is implemented)
- **Organization** — Text input (find people at specific companies)

**Results Display — Needs a Complete Overhaul**

Current tag-based display needs to become a results list that shows enough to make a go/no-go decision without clicking in:

```
┌──────────────────────────────────────────────────────┐
│ 👤 Sarah Chen                              Score: 87 │
│ @sarahchen · San Francisco, CA · ✉️ email available  │
│ "Staff Engineer at Stripe. OSS contributor."         │
│                                                      │
│ ⭐ 2,340 stars · 🔀 156 forks · 👥 890 followers    │
│ 🟢 Active 3 days ago · 📅 Member since 2016         │
│                                                      │
│ TypeScript  React  Go  Python                        │
│                                                      │
│ Top repos: stripe-node (1.2k⭐) · react-hooks (340⭐)│
│                                                      │
│ [View Profile]  [Save]  [Copy Email]                 │
└──────────────────────────────────────────────────────┘
```

**Each result card MUST show:**
1. Name + username + avatar
2. Scout Score (the big number — this is your differentiator)
3. Location
4. Email availability indicator (don't show the email, show that it exists)
5. Bio snippet
6. Key metrics: stars, followers, top languages
7. Last active date
8. Quick actions: Save, View Profile, Copy Email

**Results Sorting**
- Default: Scout Score (highest first)
- Options: Stars, Followers, Most Recently Active, Account Age
- Toggle: Grid view vs List view

### What to Remove from Search
- The current tag chips below the search bar ("ios developers", "San Francisco") feel like placeholder content. Replace with either recent searches or role-based presets ("Frontend Engineer", "ML Engineer", "DevOps", "Mobile Developer")
- Don't show an empty state with just a search bar. Show something useful: trending developers, suggested searches based on past behavior, or curated lists

### What's Missing from Search

**Bulk Actions**
- Select multiple developers → Save all to list
- Select multiple → Export to CSV
- Select multiple → Copy all emails
- This is table stakes for sourcing tools

**Search History**
- Auto-save every search
- One-click to re-run a previous search
- Show result count changes since last time ("12 new results since March 20")

**Results Count + Pagination**
- "Showing 1-25 of 347 developers"
- Load more / infinite scroll (not traditional pagination — recruiters hate clicking "Next")

---

## Screen 3: DEVELOPER PROFILE (The Deep Dive)

### What It Should Be
When a recruiter clicks into a profile, they need everything to make a sourcing decision in under 60 seconds. This is the money screen.

### Layout

**Header Section**
```
┌──────────────────────────────────────────────────────┐
│  [Avatar]   Sarah Chen           Scout Score: 87     │
│             @sarahchen           ████████░░  High     │
│             Staff Engineer                           │
│             San Francisco, CA                        │
│             🔗 sarahchen.dev · 🐦 @sarahchen        │
│             ✉️ sarah@example.com                     │
│                                                      │
│  [Save to List ▼]  [Copy Email]  [Open GitHub]      │
└──────────────────────────────────────────────────────┘
```

**Score Breakdown Panel**
This is Scout's differentiator. Don't just show a number — show WHY.

```
┌─ Score Breakdown ────────────────────────────────────┐
│                                                      │
│  Impact          ████████░░  82/100                  │
│  Contributions   █████████░  91/100                  │
│  Consistency     ███████░░░  73/100                  │
│  Technical Depth ████████░░  85/100                  │
│  Reputation      █████████░  88/100                  │
│                                                      │
│  Confidence: HIGH (Active profile, rich data)        │
└──────────────────────────────────────────────────────┘
```

Show recruiters what each pillar means on hover/click. They need to explain this score to a hiring manager.

**Contribution Activity**
- GitHub contribution calendar heatmap (the green squares) — visually powerful
- Contribution count for last 12 months
- Trend indicator: "↑ 23% more active than previous year"

**Top Repositories Table**
```
Name              Stars  Forks  Language    Last Updated
stripe-node       1,240  189    TypeScript  2 days ago
react-hooks-lib   340    42     TypeScript  1 week ago
go-cache          128    31     Go          3 months ago
```
Sort by stars (default), recently updated, or forks.

**Language Breakdown**
Visual bar chart or pie chart showing percentage of code by language across all repos. Recruiters need to quickly see "this person is 60% TypeScript, 25% Go, 15% Python."

**External Contributions Section**
- PRs merged to repos they don't own (the gold standard metric)
- Notable orgs contributed to
- This section alone can make or break a sourcing decision

**Achievements & Badges**
- Pull Shark tier, Starstruck tier, Arctic Code Vault, etc.
- Display visually with the actual GitHub badge icons

**Organizations**
- List org memberships with logos if possible
- Flag notable orgs (FAANG, major OSS foundations, YC companies)

**Contact & Outreach Section**
- Email (if public)
- Personal website
- Twitter/X
- LinkedIn (if discoverable — could be a V2 enrichment feature)
- Blog URL
- "Best channel to reach" recommendation

**Recruiter Notes (V2)**
- Freeform text area for recruiters to add notes
- "Reached out on 3/25" tracking
- Tags: "Interested", "Not Responding", "Passed", "Scheduled"

### What to Remove
- Don't show raw API data or JSON
- Don't show every single repo — top 10 is enough, with "show all" expansion
- Don't show forked repos by default (they didn't write that code)

---

## Screen 4: SAVED LISTS / PIPELINE (Currently Missing — MUST BUILD)

### Why This Is Critical
Without saved lists, Scout is a search engine. With saved lists, it's a sourcing platform. This is the difference between a tool someone uses once and a tool they live in.

### What to Build

**List Management**
- Create named lists: "Senior React - Austin - March 2026"
- Default list: "Saved Developers" (unsorted catch-all)
- Drag developers between lists
- Bulk move/copy/remove

**List View**
```
┌─ Senior React - Austin ──────────── 12 developers ──┐
│                                                      │
│  ☐ Sarah Chen      87  TypeScript/React  ✉️  Active │
│  ☐ Mike Torres     82  JavaScript/React  ✉️  Active │
│  ☐ Priya Sharma    79  TypeScript/Node   ✉️  Stale  │
│  ☐ James Liu       75  React/Python      ❌  Active │
│                                                      │
│  [Export CSV]  [Copy All Emails]  [Share List]       │
└──────────────────────────────────────────────────────┘
```

**Export Functionality**
- CSV export with all profile data
- Columns: Name, Username, Email, Location, Score, Top Languages, Stars, Followers, GitHub URL, Bio
- This is the bridge to your ATS/CRM. Without export, recruiters can't integrate Scout into their workflow

**Status Tracking (V2)**
- Pipeline stages: New → Contacted → Replied → Interviewing → Passed
- This turns Scout from a search tool into a mini-CRM
- Don't go too deep here — you're not building an ATS

---

## Screen 5: SETTINGS / ACCOUNT

### What to Include
- API key management (GitHub token input + validation)
- Account/subscription info
- Search preferences (default location, preferred languages)
- Export format preferences
- Notification preferences (V2: alerts when saved developers become more active)
- Dark/light mode toggle

### What NOT to Build (Yet)
- Team management / multi-seat — save for after PMF
- Integrations page — premature
- Billing / payment — use Stripe's hosted checkout

---

## Global UX Issues to Fix

### 1. Navigation
**Problem:** No persistent navigation. The user has no way to move between search, saved lists, and settings.

**Fix:** Add a left sidebar or top nav bar:
```
┌────────────────────────────────────────┐
│  🔍 Search                             │
│  📋 Saved Lists                        │
│  📊 Dashboard                          │
│  ⚙️ Settings                           │
└────────────────────────────────────────┘
```
Keep it minimal. Four items max. Recruiters don't want to think about navigation.

### 2. Empty States
**Problem:** Every screen needs a thoughtful empty state. "No results" is not helpful.

**Fix examples:**
- No search results → "No developers matched. Try broadening your filters." + suggested modifications
- Empty saved list → "Save developers from search to build your pipeline here."
- Dashboard first load → Quick start guide: "Run your first search to get started"

### 3. Loading States
**Problem:** GitHub API calls take time, especially GraphQL queries. Users need feedback.

**Fix:**
- Skeleton loading cards while results stream in
- Progress indicator: "Scoring 47 developers..." with a progress bar
- Stream results in as they're scored (don't wait for all to finish)

### 4. Responsive Design
**Problem:** Recruiters work on laptops, often with multiple screens. Some check on mobile between meetings.

**Fix:**
- Primary design target: 13-15" laptop screens
- Ensure the search results and profile views work at 1280px width
- Mobile: read-only is fine (view saved lists, check profiles) — don't try to make search work on mobile

### 5. Keyboard Shortcuts (Power User Feature)
- `/` to focus search
- `s` to save a developer while viewing their profile
- `j/k` to navigate between results (vim-style)
- `Esc` to go back
- Recruiters who source all day will love this

---

## Priority Roadmap: What to Build When

### Phase 1: Core Loop (Ship in 1-2 weeks)
1. ✅ Search with structured filters (language, location)
2. ✅ Results list with key metrics per card
3. ✅ Developer profile page with score breakdown
4. ✅ Persistent nav (sidebar or top bar)
5. ✅ GitHub token setup in settings

### Phase 2: Retention Features (Weeks 3-4)
1. Saved lists (create, add, remove)
2. CSV export
3. Search history
4. Dashboard with recent searches + saved developers
5. "Has email" and "Hireable" filter toggles

### Phase 3: Power Features (Month 2)
1. Scout Score with full 5-pillar breakdown
2. Contribution calendar visualization
3. Bulk actions (select multiple, save all, export all)
4. Score-based sorting and filtering
5. Role-based search presets (Frontend, Backend, ML, DevOps)

### Phase 4: Differentiation (Month 3+)
1. Activity alerts ("Sarah Chen created a new repo")
2. Developer notes and status tracking
3. AI-generated outreach message suggestions (use Claude API)
4. "Find similar developers" based on a profile
5. Chrome extension for scoring any GitHub profile inline

---

## Competitive Gaps to Exploit

| What Competitors Do Poorly | Scout's Opportunity |
|---------------------------|----------------------|
| SeekOut is $12K/year and complex | Scout: affordable, simple, GitHub-focused |
| GitRoll shows scores but no sourcing workflow | Scout: search + score + save + export in one flow |
| GitHunt has no saved lists or pipeline | Scout: full sourcing workflow, not just search |
| All competitors are black-box scoring | Scout: transparent, explainable scores |
| Most tools require onboarding calls | Scout: self-serve, paste your GitHub token, go |
| LinkedIn Recruiter misses GitHub-only devs | Scout: finds developers LinkedIn can't see |

---

## The One Thing That Will Make or Break Scout

**Speed.**

A recruiter needs to go from "I need a React developer in Austin" to "here's a list of 20 scored candidates with emails" in under 2 minutes. If that loop is fast, they'll come back every day. If it takes 5+ minutes or requires multiple page loads, they'll go back to LinkedIn.

Every UX decision should optimize for time-to-first-useful-result.
