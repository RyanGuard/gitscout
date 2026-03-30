# GitScout Command Center
## Last updated: March 30, 2026

Everything you need to access, run, and manage every project in one place. Print this. Pin this. Bookmark this.

---

## Quick Access Cheat Sheet

| What | Where | How to access |
|---|---|---|
| GitScout web app | Vercel | https://gitscout-beta.vercel.app |
| GitScout codebase | Mac | `cd ~/gitscout` |
| GitScout Agent (Electron) | Mac | `cd ~/gitscout-agent && npm run dev` |
| Eval system | Hetzner VPS | `ssh root@89.167.106.102` → `su - scout` → `cd /opt/scout-eval` |
| LinkedIn Agent | Hetzner VPS | `ssh root@89.167.106.102` → `su - scout` → `cd /opt/linkedin-agent` |
| Supabase dashboard | Browser | https://supabase.com → GITSCOUT project |
| GitHub repo | Browser | https://github.com/RyanGuard/gitscout |
| Vercel dashboard | Browser | https://vercel.com (gitscout project) |
| Hetzner dashboard | Browser | https://console.hetzner.cloud |

---

## 1. GitScout Web App (Main Product)

**What:** Recruiting intelligence platform — developer search, market map, connection mapper
**Stack:** Next.js, React, Tailwind, Prisma, Supabase, Vercel
**Repo:** https://github.com/RyanGuard/gitscout

### Access
```bash
cd ~/gitscout
npm run dev          # runs at localhost:3000
```

### Deploy
Push to `main` → Vercel auto-deploys to https://gitscout-beta.vercel.app

### Key files
- `CLAUDE.md` — project context for Claude Code
- `docs/` — all feature specs
- `src/app/api/` — all API routes
- `prisma/schema.prisma` — database schema
- `.env` — local environment variables

### Claude Code
```bash
cd ~/gitscout
claude --dangerously-skip-permissions
```

### Feature branches (use worktrees for parallel agents)
```bash
# Create a worktree for a new feature
git worktree add ../gitscout-FEATURE feature/FEATURE-NAME
cd ../gitscout-FEATURE
claude --dangerously-skip-permissions
```

---

## 2. GitScout Agent (Electron Desktop App)

**What:** LinkedIn automation agent — stealth browser with behavioral engine
**Stack:** Electron, React, Vite, Tailwind, playwright-extra, Supabase

### Access
```bash
cd ~/gitscout-agent
npm run dev          # launches Electron app
```

### Key files
- `electron/main.ts` — Electron main process
- `src/` — React UI (pages, components, hooks)
- `agent/` — automation engine
  - `agent/humanize/` — behavioral engine (mouse, keyboard, scroll, reading)
  - `agent/actions/` — LinkedIn actions (view, like, connect, message)
  - `agent/browser.ts` — stealth browser launcher
  - `agent/session-manager.ts` — Chrome cookie import
  - `agent/rate-limiter.ts` — safety limits
  - `agent/detector.ts` — LinkedIn detection monitor
- `supabase/migration.sql` — database tables
- `.env` — VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY

### Claude Code
```bash
cd ~/gitscout-agent
claude --dangerously-skip-permissions
```

---

## 3. Eval System (VPS — Autonomous Quality Monitoring)

**What:** 6 eval agents + research + planner + builder + post-deploy eval running 24/7
**Stack:** Node.js, TypeScript, node-cron, Supabase, Claude API
**Location:** Hetzner VPS at 89.167.106.102

### Access
```bash
ssh root@89.167.106.102
# Password: [stored in Hetzner dashboard, reset via Rescue tab]
su - scout
cd /opt/scout-eval
```

### Manage
```bash
npx pm2 list                              # see running processes
npx pm2 logs scout-eval --lines 50        # recent logs
npx pm2 restart scout-eval                # restart after changes
npx pm2 stop scout-eval                   # stop
npx pm2 start ecosystem.config.js         # start
```

### Test agents manually
```bash
cd /opt/scout-eval
npx ts-node agents/search-quality.ts      # test search scoring
npx ts-node agents/api-latency.ts         # test latency monitoring
npx ts-node agents/map-quality.ts         # test map scoring
npx ts-node agents/planner.ts             # test planning
npx ts-node agents/builder.ts             # test auto-building
```

### Check results
```bash
cd /opt/scout-eval && node -e "
require('dotenv').config();
const {createClient}=require('@supabase/supabase-js');
const s=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY);
(async()=>{
  var r=await s.from('eval_runs').select('agent_name,status,overall_score,created_at').order('created_at',{ascending:false}).limit(10);
  console.log('RUNS:');(r.data||[]).forEach(function(x){console.log(x.agent_name,x.status,x.overall_score,x.created_at)});
  var t=await s.from('improvement_tickets').select('severity,title,status').order('created_at',{ascending:false}).limit(5);
  console.log('TICKETS:');(t.data||[]).forEach(function(x){console.log(x.severity,x.status,x.title)});
  var q=await s.from('development_queue').select('title,status,complexity').order('created_at',{ascending:false}).limit(5);
  console.log('QUEUE:');(q.data||[]).forEach(function(x){console.log(x.status,x.complexity,x.title)});
})();"
```

### Key files on VPS
- `/opt/scout-eval/.env` — all credentials
- `/opt/scout-eval/agents/` — all agent scripts
- `/opt/scout-eval/lib/` — shared libraries
- `/opt/scout-eval/cron.ts` — schedule config
- `/opt/scout-eval/migrations/` — SQL migrations
- `/home/scout/gitscout-autofix/` — repo clone for auto-builder

### Schedule
| Time (UTC) | Agent | What it does |
|---|---|---|
| Every hour | api-latency | Monitors 5 API routes |
| 05:00 | cache-health | DISABLED (no cache table) |
| 06:00 | search-quality | Scores 15 queries, 4 quality metrics |
| 06:30 | map-quality | Generates 5 maps, 6 quality metrics |
| 07:00 | connection-quality | Tests 3 lookups, 4 quality metrics |
| 10:00 | research | Scrapes competitors + community |
| 11:00 | planner | Prioritizes tickets, writes build specs |
| 0/4/8/12/16/20 | builder | Implements top queued item |
| 2/8/14/20 | post-deploy-eval | Verifies changes helped |
| 21:00 | score-dashboard | Trend analysis + summary |

### Claude Code on VPS
```bash
ssh root@89.167.106.102
su - scout
cd /opt/scout-eval
claude --dangerously-skip-permissions
```

---

## 4. Supabase Database

**Project:** GITSCOUT
**URL:** https://pdjyzontpwiwkvklerea.supabase.co

### Tables by system

**GitScout App (Prisma-managed):**
- User/auth tables
- Developer profiles, scores
- Market maps, companies, candidates
- Connection home base, people, repos, lookups, connections
- Lists, favorites
- Outreach sequences, messages, templates (if built)

**Eval System (SQL-managed):**
- eval_runs — agent execution results
- improvement_tickets — detected issues
- eval_scores_history — metric trends
- feature_ideas — research findings
- development_queue — build queue
- deploy_log — deployment history
- eval_test_cases — dynamic QA tests

**LinkedIn Agent (SQL-managed):**
- linkedin_action_queue — pending LinkedIn actions
- linkedin_sessions — per-user session state
- linkedin_profile_data — scraped profiles

### Access
- Dashboard: https://supabase.com → GITSCOUT project
- SQL Editor: for running migrations and ad-hoc queries
- Table Editor: for browsing data
- Settings → API: for keys

### Keys
- **Publishable (anon):** Used by client-side apps (GitScout web, Electron agent)
- **Service role:** Used by server-side only (eval system on VPS). NEVER expose client-side.

---

## 5. Credentials Quick Reference

| Credential | Where it's used | Where to find it |
|---|---|---|
| Supabase URL | Everywhere | Supabase Settings → API |
| Supabase anon key | Web app, Electron agent | Supabase Settings → API → Publishable |
| Supabase service role key | VPS eval system only | Supabase Settings → API → Secret |
| Anthropic API key | VPS eval system, GitScout app | ~/gitscout/.env |
| Apollo API key | GitScout app | ~/gitscout/.env |
| GitHub token (autofix) | VPS eval system | /opt/scout-eval/.env |
| Hetzner VPS | SSH access | console.hetzner.cloud → Rescue → Reset password |
| VPS IP | 89.167.106.102 | Hetzner dashboard |

---

## 6. Spec Files Index

All specs live in the GitScout repo at `~/gitscout/docs/` or in your Downloads:

| Spec | What it covers | Status |
|---|---|---|
| CLAUDE.md | Project overview, brand, IA, rules | Active — root of gitscout repo |
| MARKET_MAP_BUILD_SPEC.md | Phase 1: core map | Built |
| MARKET_MAP_PHASE_2_SPEC.md | Phase 2: control + intelligence | Built |
| MARKET_MAP_PHASE_3_SPEC.md | Phase 3: sharing, outreach, pipeline | Built |
| MARKET_MAP_PHASE_4_SPEC.md | Phase 4: living maps, alerts | Planned |
| CONNECTION_MAPPER_SPEC.md | Connection detection algorithms | Built |
| SCOUT_REDESIGN_SPEC.md | Platform rebrand + sidebar | Reverted (keeping GitScout for now) |
| SCOUT_EVAL_SYSTEM_SPEC.md | Eval agents, tickets, scoring | Running on VPS |
| AUTO_FIX_AGENT_SPEC.md | Auto-fix from tickets | Replaced by builder |
| AUTONOMOUS_DEV_AGENT_SPEC.md | Full self-improving loop | Running on VPS |
| ONBOARDING_SPEC.md | First-run flow, tooltips, empty states | Building (Mac agent) |
| OUTREACH_WRITER_SPEC.md | Outreach Studio | Building (Mac agent) |
| OUTREACH_DEEP_DIVE.md | Research on what works in 2026 | Reference |
| LINKEDIN_STEALTH_AGENT_SPEC.md | LinkedIn detection research | Reference |
| ELECTRON_LINKEDIN_AGENT_SPEC.md | Desktop agent architecture | Built (gitscout-agent) |

---

## 7. Active Workstreams

| Workstream | Where | Status | Next step |
|---|---|---|---|
| Eval system | VPS /opt/scout-eval | Running but not writing to DB | Disable RLS on eval tables |
| Builder agent | VPS /opt/scout-eval | Failing on JSON parse | Fix extractJSON + complexity filter |
| Outreach Studio | Mac ~/gitscout (feature branch) | Building | Check agent progress |
| Onboarding | Mac ~/gitscout (feature branch) | Building | Check agent progress |
| Electron LinkedIn Agent | Mac ~/gitscout-agent | Built, needs Supabase config fix | Fix VITE_ env prefix |
| Design unification | Mac ~/gitscout | Pending | Start after other branches merge |
| Market map enrichment | Vercel (main) | Live but Apollo returning limited results | Monitor via eval agents |

---

## 8. Common Tasks

### Start a new feature with a parallel Claude Code agent
```bash
cd ~/gitscout
git worktree add ../gitscout-FEATURE feature/FEATURE-NAME
cd ../gitscout-FEATURE
claude --dangerously-skip-permissions
```

### Merge a feature branch
```bash
cd ~/gitscout
git checkout main
git pull origin main
git merge origin/feature/FEATURE-NAME -m "feat: description"
git push origin main
```

### Check what the VPS is doing
```bash
ssh root@89.167.106.102
su - scout
npx pm2 logs scout-eval --lines 30 --nostream
```

### Run a specific eval agent manually
```bash
ssh root@89.167.106.102
su - scout
cd /opt/scout-eval
npx ts-node agents/search-quality.ts
```

### Run SQL migration
Go to Supabase → SQL Editor → paste SQL → Run

### Reset VPS password
Hetzner Console → click server → Rescue tab → Reset Root Password

### Check deployed GitScout
Open https://gitscout-beta.vercel.app in browser

---

## 9. Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    YOUR MAC                              │
│                                                         │
│  ~/gitscout/          — GitScout web app (Next.js)      │
│  ~/gitscout-agent/    — Electron LinkedIn agent         │
│  ~/gitscout-*/        — Feature worktrees               │
│                                                         │
│  Claude Code agents run here for app development        │
└──────────────┬──────────────────────────────────────────┘
               │ git push → Vercel auto-deploys
               │
┌──────────────▼──────────────────────────────────────────┐
│              VERCEL                                      │
│  https://gitscout-beta.vercel.app                       │
│  Hosts the GitScout web app                             │
└──────────────┬──────────────────────────────────────────┘
               │ API calls
               │
┌──────────────▼──────────────────────────────────────────┐
│              SUPABASE                                    │
│  https://pdjyzontpwiwkvklerea.supabase.co               │
│  PostgreSQL database for everything                     │
│  Auth, profiles, maps, connections, eval, LinkedIn      │
└──────────────┬──────────────────────────────────────────┘
               │ reads/writes
               │
┌──────────────▼──────────────────────────────────────────┐
│              HETZNER VPS (89.167.106.102)                │
│                                                         │
│  /opt/scout-eval/     — Eval system + autonomous builder│
│  /home/scout/gitscout-autofix/ — Repo clone for builder │
│                                                         │
│  PM2 keeps scout-eval running 24/7                      │
│  Claude Code agents run here for eval system work       │
└─────────────────────────────────────────────────────────┘
```
