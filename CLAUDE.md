@AGENTS.md

# GitScout

Talent sourcing tool that searches GitHub in real-time to find engineering candidates, enrich their profiles, and push them into Ashby ATS.

## Stack
- Next.js 16.2.1 (Turbopack), React 19, TypeScript, Tailwind CSS 4
- Prisma 7 + Supabase PostgreSQL (session pooler, IPv4)
- NextAuth v4 with GitHub OAuth
- Vercel deployment (Hobby tier — 60s function timeout)
- Apollo.io for contact enrichment
- Ashby ATS integration

## Live
- **App:** https://gitscout-beta.vercel.app
- **Repo:** https://github.com/RyanGuard/gitscout

## Architecture — How Search Works

Search queries GitHub's Search API **live** — we do NOT pre-index all developers. The flow is:

1. User searches → hits GitHub `/search/users` API in real-time
2. Results merged with any locally stored profiles (which have scores, languages, repos)
3. User clicks a profile → fetched live from GitHub if not in our DB
4. User clicks "Enrich" → Apollo.io + commit email mining → stored locally
5. User clicks "Push to Ashby" → candidate created in ATS

**Only developers the recruiter interacts with get stored locally.** The local DB is for enriched/scored profiles and favorites, not a mirror of GitHub.

## Key Files

### Pipeline & Data
- `src/pipeline/github.ts` — GitHub API client with retry, rate limiting, bulk sync
- `src/pipeline/graphql.ts` — GitHub GraphQL API for contribution data
- `src/pipeline/scheduler.ts` — Stale profile re-sync (7-day threshold, 50/run)
- `src/lib/scoring.ts` — Developer scoring engine (normalized 0-100)

### Auth & Users
- `src/lib/auth.ts` — NextAuth config (GitHub OAuth + Prisma adapter)
- `src/components/auth/AuthButton.tsx` — Sign in/out + user menu
- `src/components/auth/FavoriteButton.tsx` — Save/unsave developer
- `src/components/auth/Providers.tsx` — SessionProvider wrapper

### API Routes
- `GET /api/search` — **Live GitHub search** + local DB merge
- `GET /api/profiles/[username]` — Profile (local DB → GitHub fallback)
- `GET /api/stats` — Dashboard stats
- `POST /api/pipeline` — Trigger bulk sync (auth: `PIPELINE_SECRET`)
- `GET /api/cron` — Scheduled re-sync (auth: `CRON_SECRET`)
- `GET|POST /api/auth/[...nextauth]` — NextAuth endpoints
- `GET|POST /api/favorites` — List/add favorites
- `DELETE /api/favorites/[developerId]` — Remove favorite

### Pages
- `/` — Landing page with search bar + stats
- `/search` — Search with filters (URL-synced), Cmd+K shortcut
- `/profile/[username]` — Developer profile (works for ANY GitHub user)
- `/favorites` — Saved developers (auth required)

### Components
- `src/components/ui/` — SearchInput, Badge, StatCard
- `src/components/layout/Header.tsx` — Nav with AuthButton
- `src/components/profile/` — DeveloperCard, LanguageBar, RepoCard
- `src/components/search/` — SearchFilters, SearchResults

## Database Schema (Prisma)

**Core:** Developer, LanguageStat, Repository, SyncLog
**Auth:** User, Account, Session, VerificationToken, Favorite

Developer has computed fields: `score`, `totalCommits`, `recentActivity`, `languageDiversity`, `avgRepoQuality`, `lastSyncError`

## Environment Variables

```
DATABASE_URL          — Prisma Postgres local dev server
DIRECT_DATABASE_URL   — Supabase session pooler (production)
GITHUB_TOKEN          — GitHub PAT (for API rate limits: 5000/hr)
GITHUB_ID             — GitHub OAuth App client ID
GITHUB_SECRET         — GitHub OAuth App client secret
NEXTAUTH_SECRET       — NextAuth session encryption
PIPELINE_SECRET       — Bearer token for /api/pipeline
CRON_SECRET           — Vercel Cron auth token
ASHBY_API_KEY         — Ashby ATS API key
APOLLO_API_KEY        — Apollo.io people enrichment API key
```

## Agent Task Files

### Phase 1 (complete):
- AGENT_SCORING.md — Scoring formula + commit counting
- AGENT_PIPELINE.md — Pipeline reliability + search + cron
- AGENT_UI.md — Frontend polish, SEO, responsive, error states
- AGENT_AUTH.md — GitHub OAuth, user accounts, favorites

### Phase 2 (ready to build):
- AGENT_ASHBY.md — Ashby ATS integration (connect, push candidates, sequences)
- AGENT_JD_MATCH.md — Job description parsing + role-based candidate matching
- AGENT_ENRICHMENT.md — Apollo.io + email mining + contact info + company normalization
- AGENT_CRM.md — Candidate lists, notes, tags, pipeline stages

Each file defines: scope, exact files to modify/create, files NOT to touch, acceptance criteria, and technical gotchas.

## Critical Rules

### Imports
- Prisma client: `from "@/generated/prisma/client"` (NOT `@prisma/client`)
- Prisma singleton: `from "@/lib/prisma"` (never instantiate your own)
- Auth: `from "@/lib/auth"` for `authOptions`
- Path alias: `@/*` maps to `./src/*`

### Next.js 16 Breaking Changes
- `params` in pages and route handlers is a **Promise** — must `await params`
- `headers()` and `cookies()` are **async** — must `await`
- `searchParams` in page components is a **Promise**
- Check `node_modules/next/dist/docs/` for full docs

### lucide-react Icon Names
- `Github` and `Twitter` icons do NOT exist — use `GitBranch` and `AtSign`
- Verify icons exist before importing

### Database
- Always `npx prisma generate` after schema changes
- Always `npx prisma db push` (NOT `prisma migrate`) for this project
- Supabase connection is IPv4 session pooler — does NOT support prepared statements
- Schema at `prisma/schema.prisma`, generated client at `src/generated/prisma/`

### Ashby API
- All endpoints are POST (even reads)
- Auth: Basic auth with API key as username, empty password
- Docs: https://developers.ashbyhq.com

### Apollo.io API
- Endpoint: `POST https://api.apollo.io/v1/people/match`
- Auth: `X-Api-Key` header
- Best matches via name+company or LinkedIn URL

### Build & Deploy
- Always `npm run build` to verify before committing
- Build script: `prisma generate && prisma db push && next build`
- Never commit `.env`
- Vercel Hobby tier: 60-second function timeout (keep syncs small)
- `vercel.json` has daily cron at 3am UTC for stale profile re-sync

### Worktrees for Parallel Agents
When running multiple agents, use git worktrees to isolate:
```bash
git worktree add ~/gitscout-{name} -b feat/{name}
cd ~/gitscout-{name} && cp ~/gitscout/.env . && npm install && npx prisma generate
claude --dangerously-skip-permissions "Read AGENT_{NAME}.md and execute all tasks."
```
Merge back: `cd ~/gitscout && git merge feat/{name}`
Cleanup: `git worktree remove ~/gitscout-{name} && git branch -d feat/{name}`
