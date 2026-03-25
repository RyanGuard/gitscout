@AGENTS.md

# GitScout

Talent sourcing tool for finding engineering candidates on GitHub.

## Stack
- Next.js 16, TypeScript, Tailwind CSS 4
- Prisma 7 + Supabase (PostgreSQL via session pooler)
- NextAuth v4 with GitHub OAuth
- Vercel deployment

## Key files
- src/pipeline/github.ts — data sync pipeline
- src/pipeline/graphql.ts — GitHub GraphQL for contributions
- src/lib/scoring.ts — developer scoring engine (0-100)
- src/lib/auth.ts — NextAuth configuration
- src/lib/ashby.ts — Ashby ATS client (Phase 2)
- src/app/api/ — all API routes
- src/components/ — UI components
- prisma/schema.prisma — DB schema

## DB connection
Use Session Pooler URL (IPv4 compatible).
DIRECT_DATABASE_URL in .env points to Supabase pooler.

## Agent Task Files

### Phase 1 (complete):
- AGENT_SCORING.md — Scoring formula + commit counting
- AGENT_PIPELINE.md — Pipeline reliability + search + cron
- AGENT_UI.md — Frontend polish, SEO, responsive, error states
- AGENT_AUTH.md — GitHub OAuth, user accounts, favorites

### Phase 2:
- AGENT_ASHBY.md — Ashby ATS integration (connect, push candidates, sequences)
- AGENT_JD_MATCH.md — Job description parsing + role-based candidate matching
- AGENT_ENRICHMENT.md — Email mining, contact info, company normalization
- AGENT_CRM.md — Candidate lists, notes, tags, pipeline stages

Each file defines: scope, files to modify, files NOT to touch, acceptance criteria, and gotchas.

## Rules
- Never commit .env
- Always run `npx prisma generate` after schema changes
- Always run `npm run build` to verify before finishing
- Push changes to your feature branch only
- Do not touch other agents' feature areas
- Prisma client import: `from "@/generated/prisma/client"` (NOT `@prisma/client`)
- Next.js 16: `params`, `headers()`, `cookies()` are all Promises — must await them
- Ashby API: All endpoints are POST. Auth is Basic (apiKey + ':' base64 encoded).
