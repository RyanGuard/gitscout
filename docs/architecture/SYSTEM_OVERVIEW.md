# System Overview

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    YOUR MAC                              │
│                                                         │
│  ~/gitscout/          — GitScout web app (Next.js)      │
│  ~/gitscout-agent/    — Electron LinkedIn agent         │
│                                                         │
│  Claude Code agents run here for app development        │
└──────────────┬──────────────────────────────────────────┘
               │ git push → Vercel auto-deploys
               │
┌──────────────▼──────────────────────────────────────────┐
│              VERCEL                                      │
│  https://gitscout-beta.vercel.app                       │
│  Hosts the GitScout web app (Next.js API routes)        │
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

## Components

### GitScout Web App
- **Stack:** Next.js (App Router), React, Tailwind, Prisma ORM
- **Hosted on:** Vercel (auto-deploys from main branch)
- **URL:** https://gitscout-beta.vercel.app
- **Local:** `cd ~/gitscout && npm run dev` (localhost:3000)
- **Features:** Developer search, market map, connection mapper, outreach studio, saved lists

### GitScout Agent (Electron Desktop App)
- **Stack:** Electron, React, Vite, Tailwind, playwright-extra
- **Location:** ~/gitscout-agent
- **Purpose:** LinkedIn automation agent with stealth browser and behavioral simulation
- **Run:** `cd ~/gitscout-agent && npm run dev`

### Eval System (VPS)
- **Stack:** Node.js, TypeScript, node-cron, PM2
- **Location:** Hetzner VPS at 89.167.106.102, /opt/scout-eval
- **Purpose:** 6 eval agents + research + planner + builder + post-deploy eval running 24/7
- **Manages itself:** Detects issues, creates tickets, plans fixes, builds and deploys them
- **See:** [VPS Guide](../infrastructure/VPS_GUIDE.md) for access and management

### Supabase Database
- **Project:** GITSCOUT
- **URL:** https://pdjyzontpwiwkvklerea.supabase.co
- **Shared by:** Web app (Prisma-managed tables), eval system (SQL-managed tables), LinkedIn agent (SQL-managed tables)

## External APIs

| API | Used for | Cost |
|---|---|---|
| Apollo People Search | Finding candidates by company/title/location | Free |
| Apollo Job Postings | Company hiring velocity | Free |
| Apollo Organization Search | Company autocomplete | Credits |
| Apollo Bulk Enrichment | Revealing emails/phones | Credits |
| Apollo News Search | Company news for flight risk | Credits |
| GitHub API | Developer scoring, OSS analysis | Free (rate limited) |
| Anthropic Claude API | Company suggestions, classification, outreach | Per token |

## Data Flow

1. **Recruiter enters role brief** → Claude suggests target companies
2. **Apollo People Search** (free) → finds matching candidates per company
3. **Claude classification** → scores fit and flight risk per candidate
4. **Recruiter actions** → shortlist, contact, track pipeline status
5. **Apollo enrichment** (credits) → reveal emails/phones on demand
6. **Outreach Studio** → Claude generates personalized messages
7. **Eval system** (VPS) → monitors quality, detects issues, auto-fixes
