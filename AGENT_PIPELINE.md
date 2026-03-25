# Agent Task: Data Pipeline, Search Infrastructure & Scheduled Syncing

## Your Job

Make the data pipeline production-grade: add proper error handling with retry logic, implement rate limit awareness for the GitHub API, set up scheduled re-syncing so profiles don't go stale, add bulk ingestion capability, and replace the naive `ILIKE` search with Postgres full-text search (`tsvector`/`tsquery`) for proper relevance ranking.

---

## Context

- **Stack:** Next.js 16.2.1, Prisma 7, PostgreSQL (Supabase), TypeScript
- **Prisma client import:** `import { PrismaClient } from "@/generated/prisma/client"` (NOT `@prisma/client`)
- **Prisma types import:** `import type { Prisma } from "@/generated/prisma/client"`
- **Path alias:** `@/*` maps to `./src/*`
- **Live at:** https://gitscout-beta.vercel.app
- **DB:** Supabase PostgreSQL via session pooler (IPv4 only). Connection string in `DIRECT_DATABASE_URL`.
- **Current state:** Pipeline syncs users one at a time with a 1s delay. No retry, no rate limit handling. Search uses Prisma `contains` (ILIKE) across 5 fields. Elasticsearch package is installed but unused.

---

## Files to Modify

### Must change:
- **`src/pipeline/github.ts`** — Add retry logic, rate limit detection (HTTP 403 + `X-RateLimit-Remaining` header), exponential backoff, bulk ingestion from GitHub search pages. Do NOT change the scoring logic (AGENT_SCORING owns `computeScore`).
- **`src/app/api/search/route.ts`** — Replace ILIKE `contains` queries with Postgres full-text search. Add search result highlighting if feasible.
- **`src/app/api/pipeline/route.ts`** — Add error responses with details, support `{ mode: "bulk", query: "language:rust stars:>100", pages: 3 }` for multi-page ingestion.

### Must create:
- **`src/pipeline/scheduler.ts`** — Logic for determining which developers need re-syncing (stale > 7 days). Export a function that the cron route calls.
- **`src/app/api/cron/route.ts`** — Vercel Cron endpoint. Must export a GET handler. Vercel calls this on schedule.
- **`vercel.json`** — Cron configuration (e.g. daily at 3am UTC).

### May need to modify:
- **`prisma/schema.prisma`** — Add a `searchVector` field or raw SQL migration for `tsvector` column + GIN index. May add `lastSyncError` or `syncAttempts` fields to `Developer`.

### May need to read (but do NOT modify):
- `src/types/index.ts` — Existing type interfaces
- `src/lib/prisma.ts` — Prisma client singleton
- `src/lib/utils.ts` — Shared utilities
- `.env` — For `GITHUB_TOKEN`, `PIPELINE_SECRET`

---

## Do NOT Touch

- `src/components/` — No UI changes (that's AGENT_UI)
- `src/app/page.tsx` — Landing page (AGENT_UI)
- `src/app/search/page.tsx` — Search page UI (AGENT_UI)
- `src/app/profile/` — Profile page (AGENT_UI)
- Auth-related files — That's AGENT_AUTH
- `computeScore()` — That's AGENT_SCORING (you can call it, but don't modify its logic)
- `src/lib/prisma.ts` — Shared singleton, don't change

---

## Acceptance Criteria

### 1. Rate Limit Handling
- Read `X-RateLimit-Remaining` and `X-RateLimit-Reset` headers from every GitHub API response.
- When remaining < 10, pause until the reset timestamp.
- When receiving HTTP 403/429, wait for `X-RateLimit-Reset` then retry.
- Log rate limit status so operators can see what's happening.

### 2. Retry Logic
- Wrap `fetchGitHubUser()` and `fetchGitHubRepos()` with retry (3 attempts, exponential backoff: 1s, 3s, 9s).
- Network errors and 5xx responses should retry. 404s should not.
- If all retries fail, log the error, skip the user, increment `errors` in `SyncLog`, and continue.

### 3. Bulk Ingestion
- Support paginated GitHub search: `POST /api/pipeline` with `{ query: "language:typescript stars:>50", pages: 5 }` fetches 5 pages of search results (30 users/page = up to 150 users).
- GitHub search API paginates with `page` param and returns max 1000 results.
- Deduplicate against existing database entries.

### 4. Scheduled Re-syncing
- Create `src/pipeline/scheduler.ts` that finds developers where `syncedAt` is older than 7 days.
- Create `src/app/api/cron/route.ts` as a GET endpoint that:
  - Validates `Authorization: Bearer {CRON_SECRET}` header (Vercel sends this)
  - Calls the scheduler to re-sync stale profiles
  - Limits to 50 developers per cron run (to stay within Vercel function timeout of 60s on Hobby)
  - Returns JSON with `{ synced, errors, staleRemaining }`
- Create `vercel.json` with cron config:
  ```json
  { "crons": [{ "path": "/api/cron", "schedule": "0 3 * * *" }] }
  ```

### 5. Full-Text Search
- Add a generated `tsvector` column to the `Developer` table. Since Prisma doesn't natively support `tsvector`, use a raw SQL approach:
  - Create a file `prisma/migrations/add_search_vector.sql` with the raw SQL to add the column, GIN index, and trigger.
  - Document how to run it: `psql $DIRECT_DATABASE_URL -f prisma/migrations/add_search_vector.sql`
  - Alternatively, use `prisma.$queryRaw` for the search query if adding the column is too complex.
- The search should rank results by relevance, not just filter.
- Search across: `username`, `name`, `bio`, `location`, `primaryLanguage`.
- Fallback: If full-text search is too complex with Prisma 7 + Supabase, improve the existing approach by using `OR` with weighted ordering (exact username match > name contains > bio contains).

### 6. Pipeline Won't Break Existing Behavior
- `syncDevelopers({ usernames, query })` must still work with its current signature.
- The POST `/api/pipeline` endpoint must remain backward-compatible.

---

## Technical Notes & Gotchas

- **GitHub REST rate limits:** 60 requests/hr unauthenticated, 5000/hr with `GITHUB_TOKEN`. Search API has a separate limit: 10 requests/min unauthenticated, 30/min with token.
- **Vercel Hobby function timeout:** 60 seconds max. Your cron handler must complete within this. That's why the limit is 50 developers per run — ~1s per user with rate limiting.
- **Vercel Cron on Hobby:** Supports daily cron. The cron job calls your route with a `Authorization: Bearer {CRON_SECRET}` header where `CRON_SECRET` is auto-set by Vercel.
- **Supabase session pooler:** Does NOT support prepared statements. If you use `prisma.$queryRaw`, this is fine. If you use raw `pg` queries, use simple query mode.
- **Prisma `$queryRaw` syntax (Prisma 7):**
  ```typescript
  const results = await prisma.$queryRaw`
    SELECT id, username, ts_rank(search_vector, to_tsquery('english', ${query})) as rank
    FROM "Developer"
    WHERE search_vector @@ to_tsquery('english', ${query})
    ORDER BY rank DESC
    LIMIT ${limit}
  `;
  ```
- **Don't use Elasticsearch.** The package is installed but we're not running an ES cluster. Remove it from `package.json` if you want, or just ignore it.
- **`prisma db push` after schema changes.** Don't create Prisma migration files with `prisma migrate` — use `db push` for this project.
- **Next.js 16 route handlers:** Use Web Request/Response APIs. `params` is a Promise. Your new cron route is just `export async function GET(request: Request) { ... }`.
- **The `SyncLog` model** already tracks `status`, `developers`, `errors`, `startedAt`, `completedAt`. Use it for cron runs too.
