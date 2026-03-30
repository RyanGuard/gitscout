## Task: Build 8 Differentiating Features That Make Scout Unforgettable

This is a Next.js App Router project (TypeScript, Tailwind, Supabase, Vercel). The app has a dark theme, persistent top nav (Search, Match, Lists), role-based quick search cards, and a developer search flow. We're adding features that turn Scout from a search tool into an intelligence platform recruiters can't live without.

Build all 8 features below. Work through them in order — some depend on earlier ones.

---

### Feature 1: Scouting Report Generator (`/components/features/ScoutingReport.tsx` + `/app/api/scouting-report/route.ts`)

A one-click AI-generated natural language summary of a developer that recruiters can copy and send to hiring managers.

**API Route specs:**
- POST endpoint that accepts `{ username, profileData, scoreData }` 
- Calls the Anthropic API (Claude Sonnet) with a system prompt that acts as a senior technical recruiter
- System prompt context: "You are a senior technical recruiter writing a brief scouting report for a hiring manager. Be specific, cite actual data, and focus on signals that indicate engineering quality. Keep it to 3-4 sentences. Never fabricate data — only reference what's provided."
- Pass the developer's profile data (name, bio, location, company, stars, followers, top repos, languages, contribution count, merged external PRs, account age, org memberships, score breakdown) as the user message
- Return the generated report as a string

**Example output the API should produce:**
"Sarah Chen is a Staff-level TypeScript engineer based in San Francisco with 8 years of GitHub activity. She's a top contributor — her code has been merged into 34 external repos including Next.js and Stripe's SDK. She ships consistently (active 48 of the last 52 weeks) and her work has earned 2,300+ stars. Currently appears to be at Stripe based on org membership."

**Component specs:**
- Button on the developer profile page: "Generate Scouting Report" with a sparkle/wand icon
- Clicking it shows a loading state ("Writing report...") with a subtle typewriter animation
- Report appears in a styled card with:
  - The generated text
  - A "Copy to clipboard" button (shows "Copied!" toast for 2 seconds)
  - A "Regenerate" button (in case they want a different angle)
  - A "Share" button that copies a formatted version with the Scout score header
- Cache the generated report in Supabase so it doesn't re-generate on every page visit (cache for 24 hours)
- The report card should have a subtle green left border accent to make it stand out on the profile page

**Copy format when shared:**
```
🦄 Scout Scouting Report — Sarah Chen (Score: 87/100)
───────────────────────────
Sarah Chen is a Staff-level TypeScript engineer based in San Francisco...
───────────────────────────
Sourced via Scout · gitscout.dev
```

---

### Feature 2: Outreach Draft Generator (`/components/features/OutreachDraft.tsx` + `/app/api/outreach-draft/route.ts`)

One-click personalized cold outreach message based on the developer's actual GitHub activity.

**API Route specs:**
- POST endpoint that accepts `{ username, profileData, roleContext?, companyContext? }`
- Calls Anthropic API with system prompt: "You are an expert technical recruiter writing a cold outreach message to a developer. The message MUST reference specific projects, PRs, or technical work from their GitHub profile — never generic flattery. Keep it under 100 words. Casual but professional tone. End with a soft ask (open to a chat, not 'apply now'). Do not use exclamation marks excessively. Sound like a human, not a template."
- Generate 2 variants:
  - **Direct approach**: Lead with their specific technical work, pitch the opportunity
  - **Soft approach**: Lead with genuine admiration for a specific project, mention you're building something related, ask for a conversation
- Return both variants as an array

**Component specs:**
- Button on developer profile: "Draft Outreach" with a message/pen icon
- Opens a modal or slide-over panel with:
  - Optional inputs at the top (not required, enhance the output):
    - "Role you're hiring for" text input (e.g., "Senior Frontend Engineer")
    - "Your company" text input (e.g., "Acme Corp — Series B fintech startup")
  - A "Generate" button
  - Two tabs: "Direct approach" and "Soft approach"
  - Each tab shows the generated message in an editable textarea so the recruiter can tweak it
  - "Copy" button per variant
  - "Regenerate" button
  - Character count shown (some platforms have limits)
- Animate the text appearing with a subtle typewriter/streaming effect (reveal character by character over ~1.5 seconds, like watching Claude type)
- Save the last generated drafts to localStorage so they persist if the recruiter navigates away and comes back

---

### Feature 3: Daily Scout Briefing (`/components/features/DailyBriefing.tsx`)

Replace the static "Good morning" dashboard greeting with a dynamic, personalized daily briefing.

**Data sources:**
- Saved developers list from Supabase
- Recent search history from Supabase
- Compare saved developers' current GitHub activity against their last cached data

**Briefing cards to generate (show 2-3 most relevant):**

1. **Activity alerts**: "3 developers you saved became more active this week"
   - Compare current `contributionsCollection` against last cached snapshot
   - Show which developers and what changed (new repos, contribution spikes)

2. **New matches**: "2 new unicorns appeared matching 'React + Austin'"
   - Re-run saved search criteria in background, compare against previous results
   - Highlight developers who are NEW to the results (weren't there before)

3. **Profile updates**: "Sarah Chen just created a new public repo in TypeScript"
   - Monitor saved developers' recent events via GitHub Events API
   - Show repo creation, significant commits, new org memberships

4. **Stale alert**: "You haven't checked your 'ML Engineers' list in 12 days"
   - Nudge recruiters to revisit lists they haven't touched

**Component specs:**
- Render below the "Good morning" greeting on the dashboard
- Each briefing item is a compact card with an icon, the message, and a CTA button ("View", "Search again", "Check profile")
- Cards animate in with the stagger animation from our previous animation features
- If there's nothing to report, show: "All quiet today. Ready to scout?" with the search bar focused
- Include a "Dismiss" (x) button on each card
- Greeting should be time-aware: "Good morning" / "Good afternoon" / "Good evening" / "Burning the midnight oil?" (after 11pm)

**For MVP (ship this first):**
- Just do the time-aware greeting and the stale list nudge (these don't require background jobs)
- The activity monitoring can be Phase 2 when you have a cron job set up

---

### Feature 4: Shareable Developer Cards (`/app/api/developer-card/route.ts` + `/components/features/ShareCard.tsx`)

Generate a beautiful, branded card image for any developer profile that can be shared in Slack, email, or ATS.

**Card design specs (generate as an SVG that gets converted to PNG):**
- Dimensions: 1200x630px (OpenGraph standard — works in Slack previews, Twitter, etc.)
- Dark background matching Scout theme (#0a0a0a or your app's bg color)
- Layout:
  ```
  ┌────────────────────────────────────────────────┐
  │  [Avatar]   Sarah Chen            🦄 Score: 92 │
  │             @sarahchen                         │
  │             San Francisco, CA                  │
  │                                                │
  │  ⭐ 2,340    👥 890    🔀 156    📅 Since 2016 │
  │                                                │
  │  TypeScript ████████░░  62%                    │
  │  React      █████░░░░░  35%                    │
  │  Go         ██░░░░░░░░  18%                    │
  │                                                │
  │  ─────────────────────────────────────────     │
  │  Scout · gitscout.dev               [QR?]      │
  └────────────────────────────────────────────────┘
  ```
- Include the tier emoji (unicorn, fire, gem, etc.) next to the score
- Language bars with percentage fills in accent colors
- Scout branding at the bottom — subtle, not obnoxious
- The card should look good on both light and dark Slack themes

**Implementation:**
- Use `@vercel/og` (Vercel's OG image generation) or `satori` to render the SVG server-side
- API route accepts a username and returns a PNG image
- Also expose this as the OpenGraph image for developer profile pages so when someone shares a Scout profile link in Slack, the card auto-previews

**Component specs:**
- "Share Card" button on the developer profile
- Clicking opens a preview of the card
- Buttons: "Copy Image", "Download PNG", "Copy Profile Link"
- The profile link (gitscout.dev/dev/sarahchen) should have OG meta tags that reference the card image API route

---

### Feature 5: Sound Design System (`/lib/sounds.ts` + `/components/ui/SoundToggle.tsx`)

Subtle, satisfying audio feedback for key actions.

**Sound events:**
| Event | Sound | Description |
|-------|-------|-------------|
| Search initiated | Soft "whoosh" | Quick 200ms swept sine wave, low volume |
| Unicorn found (90+ score in results) | Gentle "ping" chime | Two-note ascending tone, 300ms, slightly magical |
| Developer saved to list | Soft "pop" | Quick bubble pop, 100ms |
| Email copied | Subtle "click" | Mechanical click, 50ms |
| Scouting report generated | Soft "complete" chime | Three ascending notes, 400ms, satisfying |
| Export completed | "Success" tone | Warm completion sound, 300ms |

**Implementation:**
- Use the Web Audio API to generate sounds programmatically (no audio files to load) — use OscillatorNode with gain envelopes
- Create a `SoundEngine` class in `/lib/sounds.ts` with methods like `playSearch()`, `playUnicorn()`, `playSave()`, `playCopy()`, `playComplete()`
- Each sound is generated with oscillators + gain nodes — short, clean, professional
- **Sounds OFF by default** — user must opt-in via toggle
- Store preference in localStorage
- `SoundToggle` component: a small speaker icon in the top nav or settings, toggles sound on/off
- Create a React context provider (`SoundProvider`) so any component can call `const { playUnicorn } = useSound()` to trigger sounds
- Volume at ~20% max — these should be ambient, not jarring
- **Respect prefers-reduced-motion** — if enabled, disable sounds too

**The unicorn ping is the signature moment.** When a recruiter gets that sound while scrolling results, it's instant dopamine. Tune this one to be especially satisfying — a clean two-note ascending chime with a tiny bit of reverb. Think Nintendo "item get" but way more subtle.

---

### Feature 6: Keyboard Scout Mode (`/lib/keyboard.ts` + `/components/features/KeyboardOverlay.tsx`)

Vim-inspired keyboard navigation for power-user sourcers.

**Key bindings:**
| Key | Context | Action |
|-----|---------|--------|
| `/` | Anywhere | Focus search bar |
| `Escape` | Anywhere | Close modal/panel, or go back |
| `j` | Results list | Move to next result |
| `k` | Results list | Move to previous result |
| `Enter` | Results list | Open selected developer profile |
| `s` | Profile or result focused | Save developer to default list |
| `e` | Profile or result focused | Copy email to clipboard |
| `r` | Profile page | Generate scouting report |
| `o` | Profile page | Draft outreach message |
| `?` | Anywhere | Show keyboard shortcuts overlay |
| `g then h` | Anywhere | Go to dashboard (home) |
| `g then s` | Anywhere | Go to search |
| `g then l` | Anywhere | Go to lists |

**Implementation:**
- Create a `useKeyboardNav` hook that registers event listeners
- Track "active index" for results list navigation — highlight the focused card with a subtle border glow
- The `j/k` navigation should scroll the focused card into view smoothly
- `g` key starts a "go-to" chord — show a tiny floating indicator "g..." and wait 500ms for the second key
- `?` opens a full-screen overlay showing all shortcuts in a clean grid layout
- The overlay should be beautiful — dark backdrop, centered card with shortcuts organized by context (Navigation, Search Results, Developer Profile, Global)
- Store keyboard mode preference in localStorage
- Only active when no text input is focused (don't capture keystrokes when typing in search bar)

**Keyboard overlay design:**
```
┌─────────────────────────────────────────────┐
│              Keyboard shortcuts              │
│                                              │
│  NAVIGATION                                  │
│  /          Focus search                     │
│  g → h      Go home                          │
│  g → s      Go to search                     │
│  g → l      Go to lists                      │
│  Esc        Go back / close                  │
│                                              │
│  SEARCH RESULTS                              │
│  j / k      Navigate results                 │
│  Enter      Open profile                     │
│  s          Save developer                   │
│  e          Copy email                       │
│                                              │
│  DEVELOPER PROFILE                           │
│  s          Save to list                     │
│  e          Copy email                       │
│  r          Generate scouting report         │
│  o          Draft outreach                   │
│                                              │
│  Press ? to toggle this overlay              │
└─────────────────────────────────────────────┘
```

---

### Feature 7: Celebration Moments (`/components/features/Celebrations.tsx`)

Micro-celebrations for milestone moments that create emotional payoff.

**Trigger events:**

1. **First unicorn found**: When a 90+ score developer first appears in any search result
   - Confetti burst animation (particles in purple + gold)
   - Toast: "You found a unicorn! 🦄"
   - Only triggers once ever per user (store flag in localStorage)

2. **List milestone**: When a saved list hits 10, 25, 50, 100 developers
   - Subtle confetti (lighter than unicorn)
   - Toast: "Your list just hit 25 developers — nice pipeline!"

3. **First export**: When the user exports their first CSV
   - Toast with personality: "Go get 'em. Your candidates are ready."
   - Small rocket animation

4. **Streak**: If the user searches on 3+ consecutive days
   - Toast on the dashboard: "3-day scouting streak 🔥 Keep hunting."
   - Store last-active dates in localStorage

5. **Easter egg — Konami code**: Up Up Down Down Left Right Left Right B A
   - Trigger a full-screen matrix-rain animation of GitHub usernames for 3 seconds
   - Toast: "You found the secret. You're clearly a 10x recruiter."

**Implementation:**
- Create a `CelebrationProvider` context that wraps the app
- `useCelebration()` hook with methods: `celebrateUnicorn()`, `celebrateMilestone(count)`, `celebrateExport()`, `celebrateStreak(days)`
- Confetti: use canvas-confetti library (`npm install canvas-confetti`) — it's tiny and battle-tested
- Toasts: use a custom toast component or sonner (`npm install sonner`) — position bottom-right, dark themed, auto-dismiss after 4 seconds
- Track all milestone flags in localStorage under a single `scout_celebrations` key
- Each celebration only fires ONCE per milestone (don't spam)
- Respect `prefers-reduced-motion` — show toast text only, skip animations

---

### Feature 8: Find Similar Developers (`/components/features/FindSimilar.tsx` + `/app/api/find-similar/route.ts`)

One-click button to find more developers like the one you're viewing.

**Logic:**
- Extract from the current developer profile:
  - Top 3 languages (by repo count)
  - Location (if available)
  - Star range (±50% of their total stars)
  - Follower range (±50%)
  - Account age range (±2 years)
- Auto-construct a GitHub Search API query: `GET /search/users?q=language:{lang1}+language:{lang2}+location:{location}+followers:{min}..{max}`
- Filter OUT the current developer from results
- Score and rank the results using the existing scoring engine
- Return top 20 matches

**Component specs:**
- Button on the developer profile page: "Find Similar" with a people/copy icon
- Clicking it navigates to the search results page with pre-filled filters and a banner at the top: "Developers similar to Sarah Chen" with a link back to her profile
- Show which attributes were used to find similar developers as active filter chips: "TypeScript", "San Francisco", "500+ stars"
- The recruiter can then modify/remove any of these chips to refine the search

**Edge cases:**
- If the developer has no location, skip location filter and note "Location not available — showing global results"
- If only 1 language found, use just that language
- If fewer than 5 results, automatically broaden the search (remove location first, then widen star range)

---

### Integration & Wiring

After building all 8 features, wire them together:

1. **Developer profile page** should now have these action buttons in the header:
   - "Generate Scouting Report" (Feature 1)
   - "Draft Outreach" (Feature 2)
   - "Find Similar" (Feature 8)
   - "Share Card" (Feature 4)
   - "Save to List" (existing)
   - "Copy Email" (existing)

2. **Dashboard** should show the Daily Briefing (Feature 3) below the greeting

3. **Search results** should trigger:
   - Sound effects (Feature 5) — whoosh on search, unicorn ping on 90+ results
   - Celebrations (Feature 7) — first unicorn confetti

4. **Global providers** to add to the root layout:
   - `<SoundProvider>`
   - `<CelebrationProvider>`
   - Keyboard listener initialization (Feature 6)

5. **Settings page** should include:
   - Sound toggle (on/off)
   - Keyboard shortcuts toggle (on/off)
   - Celebration animations toggle (on/off)

### Environment Variables Needed
```
ANTHROPIC_API_KEY=          # For scouting reports and outreach drafts
NEXT_PUBLIC_APP_URL=        # For shareable links and OG images
```

### Packages to Install
```bash
npm install canvas-confetti sonner @vercel/og
```

### Priority If You Need to Ship Incrementally
1. Feature 1 (Scouting Report) — highest impact, showcases AI
2. Feature 2 (Outreach Draft) — immediate recruiter value
3. Feature 6 (Keyboard shortcuts) — power user retention
4. Feature 8 (Find Similar) — keeps the search loop going
5. Feature 5 (Sounds) — delight layer
6. Feature 7 (Celebrations) — retention layer
7. Feature 3 (Daily Briefing) — MVP version with time-greeting
8. Feature 4 (Share Cards) — growth/virality play
