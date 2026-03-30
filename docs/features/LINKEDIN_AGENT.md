# GitScout LinkedIn Agent — Electron Desktop App Spec

## What Is This

A desktop app that recruiters install on their Mac or Windows machine. It connects to their GitScout account, pulls outreach sequences from the Outreach Studio, and executes LinkedIn actions (profile views, post likes, connection requests, messages) automatically using a stealth browser with biomechanical human simulation.

The recruiter's own machine is the stealth layer. Their real IP, timezone, location, and browser cookies make LinkedIn see normal activity from a normal user. GitScout provides the intelligence (who to reach, what to say, when to say it). The desktop agent provides the execution.

## User Experience

### Install
1. Recruiter goes to gitscout.com/download
2. Downloads GitScout Agent for Mac (.dmg) or Windows (.exe)
3. Drags to Applications / runs installer
4. Opens the app
5. Signs in with their GitScout account (OAuth or email/password)
6. App prompts: "Connect your LinkedIn session" → one-click imports cookies from their Chrome browser
7. Done. Agent starts working.

### Daily Usage
1. Recruiter opens GitScout Agent in the morning (or it auto-starts on login)
2. Agent shows: "12 actions queued for today"
3. Agent runs quietly in background — system tray icon with status
4. Throughout the day, it executes actions at human speed
5. Recruiter can watch live: "Viewed Sarah Chen's profile... Liked post by Marcus Webb... Sent connection request to Priya Sharma..."
6. End of day: "Today: 14 profiles viewed, 6 posts liked, 4 connections sent (3 accepted), 2 messages sent"
7. Close the app or let it run — it only operates during configured active hours

### The App Window

Minimal, clean interface. Think Linear or Raycast — not a bloated dashboard.

```
┌─────────────────────────────────────────────────┐
│ GitScout Agent                    ─  □  ✕       │
│                                                 │
│  ● Connected to GitScout    LinkedIn: Active    │
│                                                 │
│  ┌─────────────────────────────────────────────┐│
│  │  Today's Activity                     ▼     ││
│  │                                             ││
│  │  ✓ Viewed Sarah Chen's profile    9:14 AM   ││
│  │  ✓ Liked post by Marcus Webb      9:18 AM   ││
│  │  ✓ Viewed Priya Sharma's profile  9:23 AM   ││
│  │  ● Sending connection to James... 9:27 AM   ││
│  │  ○ View Alex Torres (queued)      ~9:32 AM  ││
│  │  ○ Like post by Nina Park (queued) ~9:37 AM ││
│  │                                             ││
│  └─────────────────────────────────────────────┘│
│                                                 │
│  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐       │
│  │  14  │  │   6  │  │   4  │  │   2  │       │
│  │Views │  │Likes │  │Conn. │  │Msgs  │       │
│  └──────┘  └──────┘  └──────┘  └──────┘       │
│                                                 │
│  Acceptance rate: 75%    Next action in: 2m 14s │
│                                                 │
│  [  ⏸ Pause  ]              [  ⚙ Settings  ]   │
│                                                 │
└─────────────────────────────────────────────────┘
```

### System Tray
When minimized, the app lives in the system tray (Mac menu bar / Windows taskbar):
- Green dot: actively running
- Yellow dot: paused
- Red dot: error or LinkedIn warning detected
- Click to open the full window
- Right-click menu: Pause / Resume / Quit

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│ GitScout Cloud (existing)                           │
│                                                     │
│ Web App (Vercel)                                    │
│ ├── Outreach Studio: write messages, build sequences│
│ ├── Market Map: identify target companies/candidates│
│ └── Connection Mapper: find warm paths              │
│                                                     │
│ Supabase                                            │
│ ├── linkedin_action_queue: pending actions           │
│ ├── linkedin_sessions: user session state            │
│ ├── linkedin_profile_data: scraped profile data     │
│ ├── outreach_sequences: message sequences            │
│ └── outreach_analytics: response tracking            │
└───────────────────┬─────────────────────────────────┘
                    │ HTTPS API
                    │
┌───────────────────▼─────────────────────────────────┐
│ GitScout Agent (Electron app on recruiter's machine)│
│                                                     │
│ ┌─────────────┐  ┌──────────────┐  ┌─────────────┐ │
│ │ Queue       │  │ Stealth      │  │ Behavioral  │ │
│ │ Processor   │──│ Browser      │──│ Engine      │ │
│ │ (polls      │  │ (fingerprint │  │ (mouse,     │ │
│ │  Supabase)  │  │  -chromium)  │  │  keyboard,  │ │
│ │             │  │              │  │  scroll)    │ │
│ └─────────────┘  └──────────────┘  └─────────────┘ │
│                                                     │
│ ┌─────────────┐  ┌──────────────┐  ┌─────────────┐ │
│ │ Rate        │  │ Detection    │  │ Session     │ │
│ │ Limiter     │  │ Monitor      │  │ Manager     │ │
│ │ (daily/     │  │ (CAPTCHA,    │  │ (cookie     │ │
│ │  weekly     │  │  warnings)   │  │  import)    │ │
│ │  limits)    │  │              │  │             │ │
│ └─────────────┘  └──────────────┘  └─────────────┘ │
│                                                     │
│ ┌─────────────────────────────────────────────────┐ │
│ │ UI: Activity feed, stats, settings, pause/resume│ │
│ └─────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

### Key Principle: Cloud = Intelligence, Desktop = Execution

The GitScout web app handles all the thinking: who to reach, what to say, when to say it, in what order. The desktop agent handles all the doing: actually opening LinkedIn, typing messages, clicking buttons.

This means:
- Recruiter can use GitScout web app on their phone/any device to set up sequences
- The desktop agent on their computer executes them
- If the agent isn't running (laptop closed), actions queue up and execute next time it's open
- No VPS cost per user, no proxy cost per user

---

## Tech Stack

### Electron App
- **Electron** — cross-platform desktop framework (Mac + Windows)
- **React** — UI framework (same as GitScout web app)
- **Tailwind** — styling (same as GitScout web app)
- **electron-builder** — packaging for Mac (.dmg) and Windows (.exe/.msi)
- **electron-store** — local config persistence
- **electron-updater** — auto-updates

### Browser Engine
- **fingerprint-chromium** — patched Chromium binary bundled with the app
- **playwright-core** — controls the browser (NOT full playwright — just the core library, no bundled browsers)
- The fingerprint-chromium binary is included in the Electron app's resources folder
- On first launch, it's extracted to a user-accessible location

### Backend Communication
- **@supabase/supabase-js** — real-time subscription to action queue
- The agent subscribes to `linkedin_action_queue` changes for the current user
- New actions appear in real-time (no polling needed — Supabase Realtime)

---

## Project Structure

```
gitscout-agent/
├── electron/
│   ├── main.ts                    — Electron main process
│   ├── preload.ts                 — Bridge between main and renderer
│   ├── tray.ts                    — System tray management
│   └── auto-updater.ts            — Auto-update logic
├── src/
│   ├── App.tsx                    — Root React component
│   ├── pages/
│   │   ├── Dashboard.tsx          — Main activity view
│   │   ├── Settings.tsx           — Configuration
│   │   ├── Login.tsx              — GitScout auth
│   │   └── Setup.tsx              — First-run LinkedIn connection
│   ├── components/
│   │   ├── ActivityFeed.tsx        — Live action log
│   │   ├── StatsBar.tsx           — Daily counters
│   │   ├── QueueList.tsx          — Upcoming actions
│   │   └── StatusIndicator.tsx    — Connection status
│   └── hooks/
│       ├── useQueue.ts            — Supabase real-time subscription
│       ├── useSession.ts          — LinkedIn session management
│       └── useStats.ts            — Daily/weekly stat tracking
├── agent/
│   ├── index.ts                   — Agent orchestrator
│   ├── queue-processor.ts         — Pulls and executes actions
│   ├── browser.ts                 — Launches fingerprint-chromium
│   ├── session-manager.ts         — Cookie import/management
│   ├── rate-limiter.ts            — Enforces all rate limits
│   ├── detector.ts                — Detection monitoring
│   ├── humanize/
│   │   ├── mouse.ts               — Bézier curve mouse movement
│   │   ├── keyboard.ts            — Bigram keystroke dynamics
│   │   ├── scroll.ts              — Inertial scroll simulation
│   │   └── reading.ts             — Page reading simulation
│   └── actions/
│       ├── view-profile.ts        — Visit + extract profile data
│       ├── like-post.ts           — Like a recent post
│       ├── send-connect.ts        — Connection request with note
│       ├── send-message.ts        — Message to connection
│       ├── send-inmail.ts         — InMail (if credits available)
│       └── warm-up.ts             — Warm-up sequence orchestrator
├── browser/
│   ├── chromium-mac/              — fingerprint-chromium binary for Mac
│   ├── chromium-win/              — fingerprint-chromium binary for Windows
│   └── chromium-linux/            — fingerprint-chromium binary for Linux
├── package.json
├── electron-builder.yml           — Build/packaging config
└── tsconfig.json
```

---

## Cookie Import: How Users Connect LinkedIn

### Option A: Auto-import from Chrome (Recommended — Easiest for Users)

Electron can read Chrome's cookie database directly from the filesystem:
- Mac: `~/Library/Application Support/Google/Chrome/Default/Cookies`
- Windows: `%LOCALAPPDATA%\Google\Chrome\User Data\Default\Cookies`

The cookies are in an SQLite database, encrypted with the OS keychain.

```typescript
// session-manager.ts
import { app } from 'electron';
import Database from 'better-sqlite3';
import { safeStorage } from 'electron';

async function importLinkedInCookies(): Promise<Cookie[]> {
  // Find Chrome's cookie database
  const cookiePath = process.platform === 'darwin'
    ? `${app.getPath('home')}/Library/Application Support/Google/Chrome/Default/Cookies`
    : `${process.env.LOCALAPPDATA}\\Google\\Chrome\\User Data\\Default\\Cookies`;
  
  // Chrome must be closed to read the database (it locks it)
  // Copy the file first to avoid lock issues
  const tempPath = `${app.getPath('temp')}/chrome_cookies_copy`;
  fs.copyFileSync(cookiePath, tempPath);
  
  const db = new Database(tempPath, { readonly: true });
  
  // Query LinkedIn cookies
  const cookies = db.prepare(`
    SELECT host_key, name, encrypted_value, path, expires_utc, is_secure, is_httponly
    FROM cookies 
    WHERE host_key LIKE '%linkedin.com%'
  `).all();
  
  // Decrypt cookie values using OS keychain
  const decrypted = cookies.map(cookie => ({
    ...cookie,
    value: decryptChromeValue(cookie.encrypted_value),
  }));
  
  db.close();
  fs.unlinkSync(tempPath);
  
  return decrypted;
}
```

**User flow:**
1. App shows "Connect LinkedIn" button on first run
2. User clicks it
3. App reads LinkedIn cookies from their Chrome (may require Chrome to be closed momentarily)
4. Shows confirmation: "Found LinkedIn session for Ryan Guard. Connected!"
5. Stores cookies encrypted locally + syncs to Supabase for the cloud to know the session is active

### Option B: Manual Cookie Export (Fallback)

If auto-import fails (different browser, Chrome locked, permissions issue):
1. User installs a tiny Chrome extension (or goes to chrome://settings/cookies)
2. Exports LinkedIn cookies as JSON
3. Pastes or uploads into the GitScout Agent
4. Agent loads the cookies

### Session Refresh
LinkedIn cookies expire after ~1 year but refresh frequently. The agent:
- Saves updated cookies after every browser session
- If cookies become invalid (login redirect detected), prompts user: "Your LinkedIn session expired. Please log into LinkedIn in Chrome, then click Reconnect."

---

## Behavioral Engine (The Competitive Moat)

This is identical to what was speced for the VPS version — it runs locally instead.

### Mouse (agent/humanize/mouse.ts)
```typescript
// Bézier curve with Fitts's Law compliance
// 2-3 random control points for natural curvature
// Ease-in-out velocity (accelerate then decelerate)
// Gaussian micro-jitter (hand tremor simulation)
// Click slightly off-center of target element
```

### Keyboard (agent/humanize/keyboard.ts)
```typescript
// Per-character delays with bigram timing
// Common pairs (th, he, in) typed faster
// Longer pauses before capitals and punctuation
// 2% thinking pauses, 0.5% typo+correction
// Gaussian distribution, NOT uniform random
```

### Scroll (agent/humanize/scroll.ts)
```typescript
// Inertial deceleration (momentum physics)
// Large initial scroll, diminishing amounts
// 30% chance of scrolling back up
// Variable inter-scroll delays
```

### Reading (agent/humanize/reading.ts)
```typescript
// Profile reading: 15-90 seconds total
// Pause proportional to content length
// About section gets longest pause
// Experience entries: 1-2s each
// Occasional scroll-back
```

---

## Rate Limits

```typescript
const DEFAULT_LIMITS = {
  // Daily
  connections_per_day: 15,
  messages_per_day: 30,
  profile_views_per_day: 60,
  post_likes_per_day: 20,
  
  // Weekly
  connections_per_week: 70,
  
  // Timing
  min_action_delay_s: 45,
  max_action_delay_s: 240,
  mean_action_delay_s: 90,
  min_connection_delay_s: 120,
  max_connection_delay_s: 600,
  
  // Session
  max_session_minutes: 90,
  break_between_sessions_minutes: 60,
  
  // Active hours (user's local timezone)
  active_hours_start: 8,
  active_hours_end: 19,
  active_days: [1, 2, 3, 4, 5], // Mon-Fri
};

const WARMUP_SCHEDULE = {
  week_1: { connections: 5, views: 20, likes: 10 },
  week_2: { connections: 8, views: 35, likes: 15 },
  week_3: { connections: 12, views: 50, likes: 20 },
  week_4_plus: { connections: 15, views: 60, likes: 20 },
};
```

Users can adjust limits in Settings but cannot exceed safe maximums.

---

## Warm-Up Sequence

Before sending a connection request, the agent automatically warms up the relationship:

```
Day -2: view_profile
  → Agent visits their LinkedIn profile
  → They see "Ryan Guard viewed your profile" notification
  → Agent extracts profile data → sends to Supabase → enriches Outreach Studio

Day -1: like_post (if they have recent posts)
  → Agent finds and likes their most recent relevant post
  → Second touchpoint, builds familiarity

Day 0: send_connect
  → Agent sends connection request with personalized note
  → Note was written in Outreach Studio with full profile context

Day 0+: wait for acceptance (up to 7 days)

If accepted → send_message (first message from sequence)
If not accepted after 7 days → send_inmail (if available) or skip
```

This 3-touch warm-up is orchestrated automatically. When a recruiter builds a sequence in the Outreach Studio and clicks "Start sequence," the agent schedules:
1. Profile view (immediate or next active window)
2. Post like (24 hours later)
3. Connection request (48 hours later)
4. Follow-up messages (on acceptance)

---

## Integration with GitScout Web App

### How Actions Get Queued

In the GitScout web app (Outreach Studio), when a recruiter:
1. Writes a sequence for a candidate
2. Clicks "Send via LinkedIn"
3. GitScout creates entries in `linkedin_action_queue`:
   - view_profile (scheduled for now)
   - like_post (scheduled for +24h)
   - connect with note (scheduled for +48h)
   - message on acceptance (conditional, triggered by acceptance detection)

### How the Agent Picks Them Up

The Electron app subscribes to Supabase Realtime:
```typescript
supabase
  .channel('linkedin-queue')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'linkedin_action_queue',
    filter: `user_id=eq.${userId}`,
  }, (payload) => {
    // New action queued — add to local execution schedule
    addToLocalQueue(payload.new);
  })
  .subscribe();
```

Actions appear in the agent instantly. No polling.

### How Results Flow Back

After executing an action:
```typescript
await supabase.from('linkedin_action_queue').update({
  status: 'completed',
  executed_at: new Date().toISOString(),
  result: { success: true, data: extractedProfileData },
}).eq('id', actionId);

// If profile data was extracted, store it
if (profileData) {
  await supabase.from('linkedin_profile_data').upsert({
    linkedin_url: targetUrl,
    ...profileData,
    scraped_at: new Date().toISOString(),
  });
}
```

The GitScout web app sees results in real-time. The Outreach Studio updates: "Connection request sent ✓", "Response received!"

---

## Detection + Kill Switch

### Detection Monitor
After EVERY action, check:
```typescript
async function checkForProblems(page: Page): Promise<DetectionResult> {
  const url = page.url();
  const content = await page.content();
  
  return {
    captcha: url.includes('checkpoint') || content.includes('security verification'),
    restricted: content.includes('account has been restricted') || content.includes('unusual activity'),
    loginExpired: url.includes('/login') || url.includes('/authwall'),
    weeklyLimit: content.includes('weekly invitation limit'),
    rateLimited: content.includes('too many requests'),
  };
}
```

### Kill Switch
If ANY detection signal fires:
1. Stop current action immediately
2. Close the browser
3. Cancel all queued actions for today
4. Update Supabase: `linkedin_sessions.is_active = false, account_warning = true`
5. Show user notification: "⚠️ LinkedIn detected unusual activity. Automation paused. Your account is safe — we stopped immediately."
6. Require manual re-activation (user clicks "Resume" after 24 hours)

### Recovery Protocol
After a kill switch event:
- 24-hour mandatory cool-down (no automated actions)
- Resume at 50% of previous volume for 1 week
- If a second kill switch fires within 2 weeks: 72-hour cool-down, resume at 25%
- If a third fires: disable automation for this account, recommend manual-only for 30 days

---

## Packaging + Distribution

### electron-builder.yml
```yaml
appId: com.gitscout.agent
productName: GitScout Agent
copyright: Copyright © 2026 GitScout

mac:
  category: public.app-category.productivity
  icon: build/icon.icns
  target:
    - dmg
    - zip
  hardenedRuntime: true
  gatekeeperAssess: false
  entitlements: build/entitlements.mac.plist
  entitlementsInherit: build/entitlements.mac.plist

win:
  icon: build/icon.ico
  target:
    - nsis

linux:
  icon: build/icon.png
  target:
    - AppImage

extraResources:
  - from: browser/${os}/
    to: browser/
    filter:
      - "**/*"

publish:
  provider: github
  owner: RyanGuard
  repo: gitscout-agent
```

### Auto-Updates
Use electron-updater with GitHub Releases:
- When a new version is published to GitHub Releases, the app auto-downloads and installs
- This includes updated fingerprint-chromium binaries when new Chromium versions need patching

### Binary Size
- Electron: ~120MB
- fingerprint-chromium: ~150MB
- App code: ~5MB
- Total download: ~275MB (comparable to Slack, VS Code)

---

## Supabase Schema Updates

Add these tables (run in Supabase SQL editor):

```sql
-- Action queue (populated by web app, consumed by desktop agent)
create table if not exists linkedin_action_queue (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  sequence_id uuid,
  message_id uuid,
  
  action_type text not null,
  target_linkedin_url text not null,
  target_name text,
  
  connection_note text,
  message_body text,
  
  -- Warm-up chain linking
  warmup_group_id uuid,
  warmup_step integer,
  depends_on_action_id uuid,
  depends_on_status text,
  
  scheduled_for timestamptz not null,
  priority integer default 5,
  
  status text not null default 'queued',
  executed_at timestamptz,
  result jsonb,
  error text,
  retry_count integer default 0,
  
  created_at timestamptz default now()
);

create index idx_laq_user_status on linkedin_action_queue (user_id, status, scheduled_for);

-- Sessions (one per user)
create table if not exists linkedin_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique,
  
  cookies_encrypted text,
  fingerprint_seed integer,
  
  daily_connections integer default 0,
  daily_messages integer default 0,
  daily_views integer default 0,
  daily_likes integer default 0,
  daily_reset_at timestamptz,
  weekly_connections integer default 0,
  weekly_reset_at timestamptz,
  
  warmup_week integer default 1,
  warmup_started_at timestamptz,
  
  is_active boolean default true,
  last_action_at timestamptz,
  account_warning boolean default false,
  warning_count integer default 0,
  last_warning_at timestamptz,
  
  settings jsonb default '{}',
  
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Scraped profile data (enriches GitScout)
create table if not exists linkedin_profile_data (
  id uuid primary key default gen_random_uuid(),
  linkedin_url text not null unique,
  
  name text,
  headline text,
  location text,
  about text,
  current_company text,
  current_title text,
  experience jsonb,
  education jsonb,
  recent_posts jsonb,
  top_skills text[],
  connection_count text,
  mutual_connections integer,
  
  scraped_at timestamptz default now(),
  created_at timestamptz default now()
);

create index idx_lpd_url on linkedin_profile_data (linkedin_url);
```

---

## Build Sequence

### Step 1: Electron scaffold
Initialize the Electron + React + TypeScript project. Get a blank window rendering. Set up electron-builder config.

### Step 2: UI shell
Build the main window: activity feed, stats bar, pause/resume, settings page. Use mock data.

### Step 3: Supabase connection
Wire up authentication (GitScout login). Subscribe to linkedin_action_queue via Realtime. Display queued actions in the UI.

### Step 4: Browser integration
Bundle fingerprint-chromium binary (or CloakBrowser as fallback). Build browser.ts launcher. Test that it opens and navigates to linkedin.com.

### Step 5: Cookie import
Build the Chrome cookie reader. Auto-import LinkedIn cookies. Load into browser context. Verify LinkedIn session works without re-login.

### Step 6: Behavioral engine
Port the humanize modules: mouse, keyboard, scroll, reading. Test against bot detection sites.

### Step 7: Profile viewer action
First real LinkedIn action. Navigate to a profile, simulate reading, extract data, send back to Supabase.

### Step 8: Post engagement action
Like a post. More complex navigation (find activity tab, find post, click like).

### Step 9: Connection request action
The critical action. Full warm-up sequence: view → like → connect with note. Test very carefully.

### Step 10: Message action
Send messages to existing connections.

### Step 11: Rate limiter + warm-up
Enforce all limits. Implement 4-week warm-up schedule. Track daily/weekly counters in Supabase.

### Step 12: Detection monitor + kill switch
Check for CAPTCHAs, restrictions, login issues after every action. Emergency stop on any signal.

### Step 13: Queue processor
Full orchestration: poll queue → check limits → launch browser → execute action → report results → wait → next action.

### Step 14: Warm-up orchestrator
Automatically schedule view → like → connect sequences with proper timing.

### Step 15: System tray
Minimize to tray, status indicator, right-click menu.

### Step 16: Auto-updater
Wire up electron-updater with GitHub Releases.

### Step 17: Packaging
Build .dmg (Mac) and .exe (Windows) installers. Test on both platforms.

### Step 18: Integration testing
End-to-end: create a sequence in Outreach Studio web app → actions appear in desktop agent → agent executes on LinkedIn → results flow back to web app.

---

## Important Notes

### The Browser Binary is the Biggest Challenge
fingerprint-chromium provides Linux binaries. For Mac and Windows, you may need to:
- Build from source for each platform (complex, requires build infrastructure)
- Or use CloakBrowser which ships cross-platform binaries
- Or start with playwright-extra + stealth for Mac/Windows, fingerprint-chromium for Linux
- Test detection on each platform before shipping

### Chrome Cookie Reading Requires Permissions
On Mac: the app needs permission to read Chrome's data directory. macOS may prompt "GitScout Agent wants to access files in your Google Chrome folder." This is normal but may concern some users. Explain clearly in the setup flow.

On Windows: similar DPAPI decryption needed for cookie values. The electron safeStorage API handles this.

### The Agent Must Be Open to Execute
Unlike a VPS solution, the desktop agent only runs when the recruiter's computer is on and the app is running. If they close their laptop at 2 PM, actions stop. Queued actions execute the next time the app runs.

This is actually a FEATURE, not a bug: it means LinkedIn activity patterns naturally match the recruiter's working hours and device usage patterns. A VPS running at 3 AM from a Helsinki datacenter is suspicious. A MacBook running during business hours from a Houston home office is normal.

### Start with Your Own Account
Before releasing to any users, test extensively with your own LinkedIn account:
- Week 1: Profile views only (safest action)
- Week 2: Add post likes
- Week 3: Add connection requests (5/day max)
- Week 4: Full automation at conservative limits
- Monitor acceptance rates and any LinkedIn warnings throughout

### Pricing
This should be a premium feature — not included in a basic GitScout plan:
- Free tier: Outreach Studio (write messages), manual sending
- Pro tier ($29/month): Outreach Studio + LinkedIn Agent (automated execution)
- This is comparable to Expandi ($99/month) and PhantomBuster ($69/month) but with better stealth and integrated intelligence
