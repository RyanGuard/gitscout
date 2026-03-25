# Agent Task: Developer Scoring & Commit Counting

## Your Job

Overhaul the developer scoring system so it produces meaningful, differentiated scores — and populate the `totalCommits` field that is currently always `0`. The current scoring formula is naive (`stars*2 + followers*1.5 + repos*0.5 + hireable bonus`). You need to replace it with a richer signal that incorporates commit activity, repo quality, language diversity, and recency.

---

## Context

- **Stack:** Next.js 16.2.1, Prisma 7, PostgreSQL (Supabase), TypeScript
- **Prisma client import:** `import { PrismaClient } from "@/generated/prisma/client"` (NOT `@prisma/client`)
- **Path alias:** `@/*` maps to `./src/*`
- **Live at:** https://gitscout-beta.vercel.app
- **DB connection:** Uses `@prisma/adapter-pg` with Supabase session pooler (IPv4). See `src/lib/prisma.ts`.

---

## Files to Modify

### Must change:
- **`src/pipeline/github.ts`** — `computeScore()` function and `syncOneUser()` to fetch + store commit data
- **`prisma/schema.prisma`** — If you need new fields on `Developer` (e.g. `recentActivity`, `languageDiversity`, `avgRepoQuality`). Keep all existing fields and relations intact.

### May create:
- **`src/pipeline/graphql.ts`** — GitHub GraphQL API client for fetching `contributionsCollection` (commit counts, PR counts, etc.)
- **`src/lib/scoring.ts`** — If you want to extract scoring logic into its own module (recommended)

### May need to read (but do NOT modify):
- `src/types/index.ts` — For existing type definitions
- `src/lib/prisma.ts` — For the Prisma client singleton
- `.env` — For `GITHUB_TOKEN` (needed for GraphQL API)

---

## Do NOT Touch

- `src/app/` — No page or API route changes
- `src/components/` — No UI changes
- `src/lib/utils.ts` — Shared utility, other agents depend on it
- `src/lib/prisma.ts` — Shared Prisma client
- Auth-related files — That's AGENT_AUTH's job
- Elasticsearch — That's AGENT_PIPELINE's job

---

## Acceptance Criteria

1. **`totalCommits` is populated** for every synced developer. Use the GitHub GraphQL API `contributionsCollection` query to fetch the last year of commit contributions. Fall back to 0 if the GraphQL call fails (don't break the pipeline).

2. **New scoring formula** that produces scores between 0–100 (normalized) and accounts for:
   - Total stars (diminishing returns — log scale)
   - Followers (diminishing returns — log scale)
   - Commit activity (last 12 months)
   - Repo quality (avg stars per non-fork repo)
   - Language diversity (number of distinct languages)
   - Recency (when was the user last active / pushed)
   - Hireable bonus (small bump)

3. **Scores are differentiated.** Running the pipeline on 20+ developers should produce a visible spread, not all clustering at the same value.

4. **GraphQL calls are authenticated.** The GitHub GraphQL API requires a token. Read `GITHUB_TOKEN` from `process.env`. If no token is present, skip commit fetching (don't error) and compute score without commit data.

5. **Rate limiting is respected.** GitHub GraphQL has a 5000-point budget per hour. A simple user contributions query costs ~1 point. Add a comment documenting the cost.

6. **Schema changes (if any) require `prisma db push`** after modifying `schema.prisma`. Run `npx prisma generate` after any schema change. Do NOT create migration files — use `db push` for this project.

7. **Existing pipeline still works.** The POST `/api/pipeline` endpoint should continue to work exactly as before. Don't change function signatures of `syncDevelopers()`.

---

## Technical Notes & Gotchas

- **GitHub GraphQL endpoint:** `https://api.github.com/graphql` — POST with `Authorization: Bearer {token}` and `Content-Type: application/json`.
- **Contributions query example:**
  ```graphql
  query($login: String!) {
    user(login: $login) {
      contributionsCollection {
        totalCommitContributions
        totalPullRequestContributions
        totalIssueContributions
        restrictedContributionsCount
        contributionCalendar {
          totalContributions
        }
      }
    }
  }
  ```
- **Prisma 7 quirk:** The generated client is at `src/generated/prisma/client` (not the default `@prisma/client`). This directory is gitignored — you must run `npx prisma generate` before the app works.
- **Supabase session pooler:** The connection URL uses `postgres.{project_ref}` as the username, not just `postgres`. Don't change the connection setup.
- **The `score` field is `Float` in the schema.** If you want to store 0–100, that works. If you add new fields, make them optional with defaults so existing data isn't broken.
- **`syncOneUser()` is called in a loop** with a 1-second delay between users. Your GraphQL call adds to this — keep the per-user overhead under 2 seconds total.
- **Next.js 16:** `params` in route handlers and pages are Promises that must be awaited. Not relevant to your files, but FYI.
