# Agent Task: Job Description Parsing & Role-Based Candidate Matching

## Your Job

Build a job description parsing system and a matching page where recruiters can select an Ashby job (or paste a JD), have Scout extract requirements via keyword extraction, and see a ranked list of matching candidates from the database. This turns Scout from "search by keyword" into "match candidates to a role."

---

## Context

- **Stack:** Next.js 16.2.1, React 19, Prisma 7, PostgreSQL (Supabase), Tailwind CSS 4, TypeScript
- **Prisma client import:** `import { PrismaClient } from "@/generated/prisma/client"`
- **Path alias:** `@/*` maps to `./src/*`
- **Auth:** NextAuth v4 with GitHub OAuth. Use `getServerSession(authOptions)` server-side.
- **Ashby:** AGENT_ASHBY is building the Ashby connection + job fetching. You can assume `src/lib/ashby.ts` exists with a `listJobs()` and `getJobPostings(jobId)` method, and that the user's Ashby API key is stored in the `AshbyConnection` model. If those don't exist yet, create placeholder API calls that fetch from your own `/api/ashby/jobs` routes.
- **Scoring:** `src/lib/scoring.ts` computes a generic 0-100 score. The existing Developer model has: `score`, `totalStars`, `followers`, `totalCommits`, `recentActivity`, `languageDiversity`, `avgRepoQuality`, `primaryLanguage`, plus related `LanguageStat[]` and `Repository[]`.
- **Search API:** `GET /api/search` already supports filtering by languages, location, minStars, hireable, sort.

---

## The Matching Flow

```
1. User goes to /match (new page)
2. Two options:
   a. "Select from Ashby" → dropdown of open jobs → fetches JD from Ashby API
   b. "Paste a JD" → textarea input
3. JD is parsed → requirements extracted (languages, skills, location, seniority keywords)
4. Requirements are shown as editable chips/tags — user can add/remove/adjust
5. Scout queries the database with extracted criteria
6. Results are ranked by fit score (not just generic score)
7. User can push matched candidates to Ashby (uses PushToAshbyButton from AGENT_ASHBY)
```

---

## Files to Create

### JD Parser:
- **`src/lib/jd-parser.ts`** — Keyword extraction engine. Takes raw JD text, returns structured requirements:
  ```typescript
  interface ParsedRequirements {
    languages: string[];        // ["TypeScript", "Python", "Rust"]
    frameworks: string[];       // ["React", "Next.js", "FastAPI"]
    tools: string[];            // ["Docker", "Kubernetes", "Terraform"]
    location: string | null;    // "San Francisco" or "Remote"
    seniority: string | null;   // "senior", "staff", "principal", "junior", "mid"
    keywords: string[];         // Other notable terms
    yearsExperience: number | null; // Extracted from "5+ years"
  }

  export function parseJobDescription(text: string): ParsedRequirements;
  ```

  Implementation approach — **keyword extraction with dictionaries:**
  - Maintain dictionaries of known programming languages (50+), frameworks (100+), tools (50+)
  - Scan JD text (case-insensitive) for matches
  - Extract seniority from patterns: "senior", "staff", "principal", "lead", "junior", "mid-level", "entry"
  - Extract years from patterns: `/(\d+)\+?\s*years?/i`
  - Extract location from patterns: city names, "remote", "hybrid", "on-site"
  - Return deduped, sorted results

### Matching/Scoring:
- **`src/lib/matcher.ts`** — Role-specific candidate scoring. Takes parsed requirements + a developer profile, returns a fit score 0-100:
  ```typescript
  interface MatchResult {
    fitScore: number;           // 0-100
    matchedLanguages: string[]; // Which required languages the dev knows
    matchedSkills: string[];    // Matched frameworks/tools (from repo topics/names)
    locationMatch: boolean;
    seniorityMatch: boolean;
    reasons: string[];          // Human-readable match reasons
  }

  export function computeFitScore(requirements: ParsedRequirements, developer: DeveloperWithDetails): MatchResult;
  ```

  Scoring logic:
  - **Language match (40%):** % of required languages the developer uses (from LanguageStat)
  - **Skill/framework match (25%):** Check repo topics, repo names, and repo descriptions for required frameworks/tools
  - **Location match (10%):** Fuzzy match on developer.location vs required location. "Remote" matches everyone.
  - **Seniority match (10%):** Infer dev seniority from account age, commits, stars, followers. Compare to required seniority.
  - **Activity/quality (15%):** Use existing `recentActivity`, `avgRepoQuality`, `totalCommits` as quality signal.

### API Routes:
- **`src/app/api/match/route.ts`** — POST: Takes `{ jobDescription: string }` OR `{ jobId: string }` (Ashby job ID). Parses JD, queries database for matching developers, scores them, returns ranked results.
  ```typescript
  // Response:
  {
    requirements: ParsedRequirements,
    candidates: Array<{
      developer: DeveloperProfile,
      fitScore: number,
      matchedLanguages: string[],
      matchedSkills: string[],
      locationMatch: boolean,
      reasons: string[]
    }>,
    total: number
  }
  ```
- **`src/app/api/match/parse/route.ts`** — POST: Takes `{ text: string }`, returns `ParsedRequirements` only (for the preview step before searching).

### Pages:
- **`src/app/match/page.tsx`** — The matching page. Layout:
  - Top section: Job input (Ashby dropdown OR paste textarea, with a toggle)
  - Middle section: Extracted requirements shown as editable tags/chips
  - "Find Matches" button
  - Results section: Ranked candidate cards with fit score, match reasons, push-to-Ashby button

### Components:
- **`src/components/match/JobInput.tsx`** — Client component. Toggle between "From Ashby" (dropdown) and "Paste JD" (textarea). Calls the parse API on submit.
- **`src/components/match/RequirementsEditor.tsx`** — Shows parsed requirements as editable chips. User can remove a language, add a skill, change location. Each category (languages, frameworks, tools, location, seniority) is a separate row.
- **`src/components/match/MatchCard.tsx`** — Like DeveloperCard but with fit score badge, matched languages highlighted, match reasons shown. Includes PushToAshbyButton.

---

## Files to Modify

- **`src/components/layout/Header.tsx`** — Add "Match" link to the nav (between Search and Settings).
- **`src/types/index.ts`** — Add `ParsedRequirements` and `MatchResult` interfaces.

---

## Do NOT Touch

- `src/pipeline/` — Data pipeline
- `src/lib/scoring.ts` — Generic scoring (you compute a SEPARATE fit score, don't modify generic score)
- `src/lib/prisma.ts` — Shared client
- `src/lib/ashby.ts` — Ashby client (AGENT_ASHBY owns this)
- `src/app/api/ashby/` — Ashby routes (AGENT_ASHBY)
- `src/app/api/search/` — Existing search (AGENT_PIPELINE)
- `src/app/profile/` — Profile page (AGENT_ASHBY adds push button)
- `prisma/schema.prisma` — No schema changes needed for this agent
- `src/app/favorites/` — Favorites page (AGENT_AUTH)

---

## Acceptance Criteria

### 1. JD Parsing Extracts Meaningful Requirements
Test with these real JD snippets:

**Input:** "We're looking for a Senior Full-Stack Engineer with 5+ years of experience in TypeScript, React, and Node.js. Experience with PostgreSQL, Redis, and AWS is preferred. Remote-friendly, US timezone preferred."

**Expected output:**
```json
{
  "languages": ["TypeScript"],
  "frameworks": ["React", "Node.js"],
  "tools": ["PostgreSQL", "Redis", "AWS"],
  "location": "Remote",
  "seniority": "senior",
  "keywords": ["full-stack"],
  "yearsExperience": 5
}
```

**Input:** "Staff Rust Engineer — San Francisco. Build high-performance distributed systems. Must have deep experience with async Rust, tokio, and gRPC. Kubernetes and Terraform experience required."

**Expected output:**
```json
{
  "languages": ["Rust"],
  "frameworks": ["tokio", "gRPC"],
  "tools": ["Kubernetes", "Terraform"],
  "location": "San Francisco",
  "seniority": "staff",
  "keywords": ["distributed systems", "high-performance"],
  "yearsExperience": null
}
```

### 2. Matching Returns Ranked Results
- Given a parsed JD, the match API returns developers sorted by fit score (descending).
- Developers who match more required languages rank higher.
- A developer who knows 3/3 required languages with high activity scores higher than one who knows 1/3 with low activity.
- Results include human-readable `reasons` (e.g., "Matches TypeScript, React", "Located in San Francisco", "Senior-level based on 8 years of activity").

### 3. Requirements Are Editable
- After parsing, the user sees the extracted requirements as chips/tags.
- User can click X to remove a requirement.
- User can type to add new languages/skills.
- Clicking "Find Matches" re-runs the search with the modified requirements.

### 4. Ashby Job Integration
- If user has Ashby connected, show a "From Ashby" tab with a dropdown of open jobs.
- Selecting a job fetches its description from `GET /api/ashby/jobs/[jobId]`.
- The JD text is automatically parsed and shown in the requirements editor.
- If Ashby is not connected, only show the "Paste JD" option.

### 5. Match Page is Usable
- Clean layout: input → requirements → results.
- Loading states while parsing and searching.
- Empty state if no matches found.
- Results show DeveloperCard-style info PLUS fit score and match reasons.

### 6. Build Must Pass
- `npm run build` with zero errors.

---

## Technical Notes & Gotchas

- **Language dictionary** — Include at minimum: TypeScript, JavaScript, Python, Rust, Go, Java, C, C++, C#, Ruby, PHP, Swift, Kotlin, Scala, Elixir, Haskell, Dart, R, Lua, Zig, Objective-C, Perl, Shell, SQL, HTML, CSS. Match case-insensitively. Handle aliases: "JS" → "JavaScript", "TS" → "TypeScript", "Golang" → "Go", "C sharp" → "C#", "node" → "Node.js".

- **Framework dictionary** — Include: React, Next.js, Vue, Angular, Svelte, Express, Fastify, NestJS, Django, Flask, FastAPI, Rails, Spring, Spring Boot, Laravel, Phoenix, Gin, Fiber, Actix, Axum, tokio, tonic, gRPC, GraphQL, REST, Tailwind, Bootstrap. Match case-insensitively.

- **Tools dictionary** — Include: Docker, Kubernetes, Terraform, AWS, GCP, Azure, PostgreSQL, MySQL, MongoDB, Redis, Elasticsearch, Kafka, RabbitMQ, Nginx, Jenkins, GitHub Actions, CircleCI, Datadog, Grafana, Prometheus. Handle aliases: "K8s" → "Kubernetes", "Postgres" → "PostgreSQL", "Mongo" → "MongoDB".

- **Fetching Ashby JD text:** The `jobPosting.list` endpoint returns postings with `descriptionHtml` and `descriptionPlain`. Use `descriptionPlain` for parsing. If AGENT_ASHBY hasn't built this endpoint yet, call the Ashby API directly using the API key from `ASHBY_API_KEY` env var as a fallback:
  ```typescript
  const apiKey = process.env.ASHBY_API_KEY;
  ```

- **Database query for matching:** Don't fetch all developers and score in-memory. Pre-filter with Prisma:
  ```typescript
  // First, find developers who match at least one required language
  const candidates = await prisma.developer.findMany({
    where: {
      languages: { some: { language: { in: requirements.languages } } }
    },
    include: { languages: true, repositories: true },
    take: 100,
    orderBy: { score: 'desc' }
  });
  // Then compute fitScore for each in-memory and re-sort
  ```

- **Seniority inference** from developer data:
  - Account age > 10 years + 1000+ commits + 500+ stars → "staff" / "principal"
  - Account age > 5 years + 500+ commits + 100+ stars → "senior"
  - Account age > 2 years + 100+ commits → "mid"
  - Otherwise → "junior"
  (These are rough heuristics — document them as configurable thresholds)

- **Next.js 16:** All page/route `params` are Promises. `searchParams` in pages are also Promises.

- **The match page should NOT require auth** to view (anyone can paste a JD and see matches). But pushing to Ashby requires auth + Ashby connection.
