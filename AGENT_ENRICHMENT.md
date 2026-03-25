# Agent Task: Profile Enrichment — Email Mining, Contact Info & Company Normalization

## Your Job

Build a profile enrichment system that extracts real contact information from GitHub data. Mine email addresses from public commits, normalize company names, extract social links from bios/blogs, and infer seniority. This makes developer profiles actionable for recruiting — you can't reach out to someone if you only have their GitHub username.

---

## Context

- **Stack:** Next.js 16.2.1, React 19, Prisma 7, PostgreSQL (Supabase), Tailwind CSS 4, TypeScript
- **Prisma client import:** `import { PrismaClient } from "@/generated/prisma/client"`
- **Path alias:** `@/*` maps to `./src/*`
- **Auth:** NextAuth v4. Use `getServerSession(authOptions)` server-side.
- **Existing Developer fields:** `email` (from GitHub profile, often null), `company` (free text like "@google"), `blog`, `twitterUsername`, `location`
- **GitHub Token:** `GITHUB_TOKEN` env var available for authenticated API calls (5000 req/hr).

---

## Enrichment Sources (All Free, No Third-Party APIs)

### 1. Commit Email Mining
GitHub exposes author email in public commits. The REST API endpoint:
```
GET /repos/{owner}/{repo}/commits?author={username}&per_page=5
```
Each commit has `commit.author.email`. Filter out:
- `noreply@github.com` and `users.noreply.github.com` variants
- Empty strings
- Generic patterns like `user@localhost`

Often developers use their real email in commits even if their profile email is hidden.

### 2. Company Normalization
The `company` field on GitHub is free-text. Examples:
- `@google` → "Google"
- `Google Inc.` → "Google"
- `@meta` → "Meta"
- `Facebook, Inc` → "Meta"
- `@microsoft` → "Microsoft"
- `self-employed` → "Self-employed"
- `Freelance` → "Freelance"

Build a normalizer that handles @ prefixes, common suffixes (Inc, Inc., LLC, Corp), and known company aliases.

### 3. Social Link Extraction
Parse the `blog` and `bio` fields for URLs:
- LinkedIn: `linkedin.com/in/{handle}`
- Twitter/X: `twitter.com/{handle}` or `x.com/{handle}`
- Mastodon: `{instance}/@{handle}`
- Dev.to: `dev.to/{handle}`
- Medium: `medium.com/@{handle}`
- Personal site: anything else that's a URL

### 4. Seniority Inference
Estimate seniority from GitHub signals:
- **Account age** (years since `created_at`)
- **Total contributions** (commits, PRs, issues)
- **Follower count** relative to peers
- **Stars** earned
- **Repo maturity** (do they maintain popular packages?)

Map to levels: `junior`, `mid`, `senior`, `staff`, `principal`

---

## Files to Create

### Enrichment Pipeline:
- **`src/pipeline/enrichment.ts`** — Core enrichment module. Functions:
  - `enrichDeveloper(developerId: string)` — Orchestrates all enrichment for one developer. Fetches commit emails, normalizes company, extracts social links, infers seniority. Updates ContactInfo + Developer records.
  - `mineCommitEmails(username: string, repos: string[])` — Fetches recent commits from top repos, extracts unique email addresses.
  - `normalizeCompany(rawCompany: string | null)` — Cleans up company field.
  - `extractSocialLinks(bio: string | null, blog: string | null)` — Parses URLs from text.
  - `inferSeniority(developer: DeveloperWithStats)` — Returns seniority level string.

- **`src/lib/company-aliases.ts`** — Dictionary mapping raw company strings to normalized names:
  ```typescript
  export const COMPANY_ALIASES: Record<string, string> = {
    '@google': 'Google', 'google inc': 'Google', 'google llc': 'Google',
    '@meta': 'Meta', 'facebook': 'Meta', 'facebook inc': 'Meta',
    '@microsoft': 'Microsoft', 'microsoft corp': 'Microsoft',
    '@apple': 'Apple', 'apple inc': 'Apple',
    '@amazon': 'Amazon', 'amazon web services': 'Amazon',
    '@netflix': 'Netflix', '@stripe': 'Stripe',
    '@vercel': 'Vercel', '@shopify': 'Shopify',
    // ... 50+ entries
  };
  ```

### Schema Changes:
Add to `prisma/schema.prisma`:

```prisma
model ContactInfo {
  id              String    @id @default(cuid())
  developerId     String    @unique
  emails          String[]  @default([])
  primaryEmail    String?
  linkedinUrl     String?
  twitterUrl      String?
  mastodonUrl     String?
  devtoUrl        String?
  mediumUrl       String?
  personalSite    String?
  currentTitle    String?
  normalizedCompany String?
  seniorityLevel  String?
  timezone        String?
  enrichedAt      DateTime?
  enrichmentSource String?
  developer       Developer @relation(fields: [developerId], references: [id], onDelete: Cascade)
}
```

Also add to existing `Developer` model:
- `contactInfo ContactInfo?`

### API Routes:
- **`src/app/api/enrich/[developerId]/route.ts`** — POST: Trigger enrichment for a specific developer. Requires auth. Returns the enriched ContactInfo. This is the "Enrich" button handler.
- **`src/app/api/enrich/status/[developerId]/route.ts`** — GET: Check enrichment status for a developer (enriched? when? what data?).

### Components:
- **`src/components/profile/EnrichButton.tsx`** — Client component. "Enrich Profile" button shown on developer profile pages. On click, calls the enrich API. Shows loading spinner, then reveals enriched data (emails, LinkedIn, etc.).
- **`src/components/profile/ContactCard.tsx`** — Displays enriched contact info: email addresses (with copy button), LinkedIn link, Twitter link, personal site, normalized company, inferred seniority badge.

---

## Files to Modify

- **`prisma/schema.prisma`** — Add ContactInfo model + relation on Developer.
- **`src/app/profile/[username]/page.tsx`** — Add EnrichButton and ContactCard to the profile page. Show ContactCard if enrichment data exists; show EnrichButton if not yet enriched.
- **`src/types/index.ts`** — Add `ContactInfo` interface.

---

## Do NOT Touch

- `src/pipeline/github.ts` — Main sync pipeline (AGENT_PIPELINE)
- `src/pipeline/graphql.ts` — GraphQL contributions (AGENT_SCORING)
- `src/lib/scoring.ts` — Scoring engine (AGENT_SCORING)
- `src/lib/ashby.ts` — Ashby client (AGENT_ASHBY)
- `src/app/api/ashby/` — Ashby routes (AGENT_ASHBY)
- `src/app/api/search/` — Search endpoint (AGENT_PIPELINE)
- `src/app/api/match/` — Matching (AGENT_JD_MATCH)
- `src/lib/prisma.ts` — Shared Prisma client (use, don't modify)
- `src/lib/auth.ts` — Auth config (use, don't modify)
- `src/lib/utils.ts` — Shared utilities (use, don't modify)

---

## Acceptance Criteria

### 1. Commit Email Mining Works
- For a developer with public repos, `mineCommitEmails` fetches commits from their top 3 repos (by stars).
- Extracts unique email addresses, filtering out GitHub noreply addresses.
- Stores all found emails in `ContactInfo.emails[]`.
- Sets `primaryEmail` to the most common non-noreply email found.
- If no emails found, `emails` is empty and `primaryEmail` is null — don't error.

### 2. Company Normalization
- `@google` → "Google"
- `Google, Inc.` → "Google"
- `@vercel` → "Vercel"
- `Freelance developer` → "Freelance"
- Unknown company → cleaned version (remove @, trim, title case)
- `null` / empty → null

### 3. Social Link Extraction
- Given a bio like "Rust developer. https://linkedin.com/in/johndoe | @johndoe on Twitter"
  - Extracts LinkedIn URL
  - Extracts Twitter URL
- Given a blog URL like "https://dev.to/johndoe"
  - Identifies it as a Dev.to profile
- Given a blog URL like "https://johndoe.com"
  - Stores it as personal site

### 4. Seniority Inference
- Account > 10 years, 5000+ commits, 1000+ stars → "staff" or "principal"
- Account > 6 years, 1000+ commits, 200+ stars → "senior"
- Account > 3 years, 200+ commits → "mid"
- Account < 3 years or < 50 commits → "junior"
- These thresholds should be constants at the top of the file for easy tuning.

### 5. Enrichment UI
- Profile page shows an "Enrich Profile" button for non-enriched developers.
- Button only visible to logged-in users.
- Clicking triggers enrichment — shows loading state.
- After enrichment, ContactCard appears with all discovered info.
- Email addresses have a "Copy" button.
- LinkedIn/Twitter/etc. are clickable links.
- If already enriched, show the data directly (no button needed) with "Re-enrich" option.
- Show "Enriched {timeAgo}" timestamp.

### 6. Rate Limit Awareness
- Commit email mining makes ~3 API calls per developer (one per repo, 5 commits each).
- Use the same `GITHUB_TOKEN` as the main pipeline.
- If rate limited, return partial results (whatever was mined before the limit) rather than erroring.

### 7. Build Must Pass
- `npm run build` with zero errors.
- `npx prisma generate && npx prisma db push` after schema changes.

---

## Technical Notes & Gotchas

- **Commit email endpoint:**
  ```
  GET https://api.github.com/repos/{owner}/{repo}/commits?author={username}&per_page=5
  ```
  Response includes `commit.author.email` and `commit.committer.email`. Check both.
  Some commits have the same email in both fields — deduplicate.

- **GitHub noreply patterns to filter:**
  - `{id}+{username}@users.noreply.github.com`
  - `{username}@users.noreply.github.com`
  - `noreply@github.com`
  - `github@users.noreply.github.com`

- **Company normalization algorithm:**
  1. Lowercase the input
  2. Remove leading `@`
  3. Remove trailing suffixes: `, inc.`, `, inc`, `, llc`, `, corp`, `, ltd`
  4. Trim whitespace
  5. Look up in `COMPANY_ALIASES` dictionary
  6. If not found, return title-cased cleaned version

- **URL extraction regex** for social links:
  ```typescript
  const URL_REGEX = /https?:\/\/[^\s,)]+/gi;
  ```
  Then classify each URL by domain.

- **The Developer model** already has `email`, `company`, `blog`, `twitterUsername`. The enrichment system should:
  - Use these as starting points
  - Store enriched data in the separate `ContactInfo` model
  - Not overwrite the original Developer fields (those come from GitHub API)

- **Prisma `String[]` arrays** work with Supabase PostgreSQL. No special setup needed.

- **Auth check** for enrichment API:
  ```typescript
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  ```

- **Next.js 16 async params:**
  ```typescript
  export async function POST(
    _request: Request,
    { params }: { params: Promise<{ developerId: string }> }
  ) {
    const { developerId } = await params;
  }
  ```

- **Schema changes:** After modifying `prisma/schema.prisma`, run `npx prisma generate && npx prisma db push`.
