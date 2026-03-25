## Task: Build a Dual-Pipeline Search Architecture That Actually Finds Top Developers

GitScout's search needs a complete overhaul. The current approach of using GitHub's Search Users API directly is broken — it sorts by "relevance" (keyword matching on bios/usernames), not engineering quality. We need a search → enrich → score pipeline that finds actual unicorns.

This is a Next.js App Router project (TypeScript, Tailwind, Supabase, Vercel). Read the CLAUDE.md for full project context.

Build everything below in order — each piece builds on the previous.

---

## Part 1: Seed Repository Index (`/lib/search/seedRepos.ts`)

Create curated lists of landmark/elite repositories for each role category. These are the repos where the best developers contribute. We'll mine contributors from these repos to find high-quality talent.

```typescript
// Structure
export interface SeedRepo {
  owner: string;
  name: string;
  weight: number; // 1-3, how prestigious (3 = top tier like React, Kubernetes)
}

export interface RoleCategory {
  id: string;
  label: string;
  languages: string[]; // primary languages for this role
  seedRepos: SeedRepo[];
}

export const ROLE_CATEGORIES: RoleCategory[] = [...]
```

**Role categories and their seed repos (include ALL of these):**

**Frontend Engineer**
- Languages: TypeScript, JavaScript
- Weight 3 (elite): facebook/react, vercel/next.js, sveltejs/svelte, vuejs/core, tailwindcss/tailwindcss
- Weight 2 (strong): remix-run/remix, withastro/astro, solidjs/solid, preactjs/preact, radix-ui/primitives, shadcn-ui/ui, storybookjs/storybook
- Weight 1 (good): pmndrs/zustand, TanStack/query, framer/motion, recharts/recharts

**Backend Engineer**
- Languages: TypeScript, Python, Go, Java, Rust
- Weight 3: nodejs/node, expressjs/express, django/django, pallets/flask, golang/go
- Weight 2: nestjs/nest, fastify/fastify, tiangolo/fastapi, gin-gonic/gin, spring-projects/spring-boot, prisma/prisma
- Weight 1: trpc/trpc, drizzle-team/drizzle-orm, encode/starlette, labstack/echo

**ML / AI Engineer**
- Languages: Python, Jupyter Notebook, C++
- Weight 3: pytorch/pytorch, tensorflow/tensorflow, huggingface/transformers, langchain-ai/langchain
- Weight 2: scikit-learn/scikit-learn, openai/openai-python, microsoft/DeepSpeed, facebookresearch/llama, vllm-project/vllm
- Weight 1: ggerganov/llama.cpp, mlflow/mlflow, ray-project/ray, Lightning-AI/pytorch-lightning

**DevOps / Infrastructure**
- Languages: Go, Python, Shell, HCL
- Weight 3: kubernetes/kubernetes, hashicorp/terraform, docker/compose, prometheus/prometheus
- Weight 2: ansible/ansible, argoproj/argo-cd, grafana/grafana, hashicorp/vault, pulumi/pulumi
- Weight 1: containers/podman, cilium/cilium, crossplane/crossplane, open-telemetry/opentelemetry-go

**Rust Systems**
- Languages: Rust
- Weight 3: rust-lang/rust, denoland/deno, tauri-apps/tauri, tokio-rs/tokio
- Weight 2: starship/starship, BurntSushi/ripgrep, sharkdp/bat, serde-rs/serde, actix/actix-web
- Weight 1: bevyengine/bevy, pola-rs/polars, swc-project/swc, nushell/nushell

**Mobile Developer**
- Languages: Swift, Kotlin, Dart, TypeScript
- Weight 3: facebook/react-native, flutter/flutter, expo/expo
- Weight 2: realm/realm-swift, airbnb/lottie-ios, ReactiveX/RxSwift, JetBrains/compose-multiplatform
- Weight 1: nicklockwood/SwiftFormat, pointfreeco/swift-composable-architecture, cashapp/sqldelight

---

## Part 2: GitHub API Client (`/lib/github/client.ts`)

Create a robust GitHub API client with rate limiting, caching, and error handling.

```typescript
export class GitHubClient {
  private token: string;
  private rateLimitRemaining: number;
  private rateLimitReset: Date;
  
  // REST API methods
  async searchUsers(query: string, sort?: string, perPage?: number, page?: number): Promise<SearchUsersResponse>
  async searchRepos(query: string, sort?: string, perPage?: number, page?: number): Promise<SearchReposResponse>
  async getUser(username: string): Promise<UserProfile>
  async getUserRepos(username: string, perPage?: number, sort?: string): Promise<Repository[]>
  async getRepoContributors(owner: string, repo: string, perPage?: number): Promise<Contributor[]>
  async getUserEvents(username: string, perPage?: number): Promise<UserEvent[]>
  
  // GraphQL method
  async graphql<T>(query: string, variables: Record<string, any>): Promise<T>
  
  // Utilities
  private async handleRateLimit(response: Response): Promise<void>
  private getCacheKey(endpoint: string, params: any): string
}
```

**Specs:**
- Read GitHub token from environment variable `GITHUB_TOKEN`
- Track rate limit headers on every response (`X-RateLimit-Remaining`, `X-RateLimit-Reset`)
- If rate limit is below 100 remaining, slow down requests (add 1 second delay between calls)
- If rate limit is exhausted, wait until reset time and retry
- Cache all responses in Supabase table `api_cache` with columns: `cache_key TEXT PRIMARY KEY, response JSONB, created_at TIMESTAMPTZ, ttl_seconds INTEGER`
- Cache TTLs: user profiles = 24 hours, repo data = 12 hours, search results = 1 hour, contributors = 6 hours
- Before any API call, check cache first. If cache hit and not expired, return cached data.
- Log all API calls with timestamps for debugging rate limit issues
- Retry failed requests up to 3 times with exponential backoff (1s, 2s, 4s)
- Handle GitHub's 202 response (stats being computed) — wait 2 seconds and retry

---

## Part 3: Quick Search Pipeline (`/app/api/search/quick/route.ts`)

The fast path — returns results in 1-2 seconds using GitHub's Search Users API. Lower quality but gives the recruiter something to look at immediately.

**Request:**
```typescript
POST /api/search/quick
{
  language?: string,        // "typescript", "python", etc.
  location?: string,        // "San Francisco", "Austin", etc.
  minFollowers?: number,    // default 10
  minRepos?: number,        // default 5
  sort?: "followers" | "repositories" | "joined",  // default "followers"
  perPage?: number,         // default 30, max 100
  page?: number             // default 1
}
```

**Logic:**
1. Construct GitHub search query: `language:{language}+location:{location}+followers:>{minFollowers}+repos:>{minRepos}+type:user`
2. Call `GET /search/users?q={query}&sort={sort}&order=desc&per_page={perPage}`
3. For each user in results, fetch their basic profile data (this is a lightweight call — the search already returns most fields)
4. Return results tagged with `source: "quick"`

**Response:**
```typescript
{
  total_count: number,
  developers: Array<{
    username: string,
    displayName: string,
    avatarUrl: string,
    bio: string,
    location: string,
    email: string | null,
    company: string | null,
    hireable: boolean | null,
    followers: number,
    following: number,
    publicRepos: number,
    createdAt: string,
    profileUrl: string,
    source: "quick",
    // Minimal scoring (just what we can compute from search results)
    quickScore: {
      followers: number,
      repos: number,
      accountAgeDays: number,
      hasEmail: boolean,
      isHireable: boolean
    }
  }>
}
```

---

## Part 4: Deep Search Pipeline (`/app/api/search/deep/route.ts`)

The quality path — takes 5-15 seconds but finds actual top developers by mining repo contributors.

**Request:**
```typescript
POST /api/search/deep
{
  roleCategory: string,     // "frontend", "backend", "ml", "devops", "rust", "mobile"
  language?: string,        // override or additional language filter
  location?: string,        // location filter
  minStars?: number,        // minimum total stars across repos
  activeInDays?: number,    // must have activity in last N days (default 90)
  maxResults?: number       // default 50
}
```

**Logic (this is the core algorithm):**

```
Step 1: Get seed repos for the role category from seedRepos.ts
        Also search for additional high-star repos matching the language:
        GET /search/repositories?q=language:{language}+stars:>500+pushed:>{90_days_ago}&sort=stars&per_page=20
        Merge with seed repos, deduplicate

Step 2: For each repo (prioritize weight 3 first, then 2, then 1):
        GET /repos/{owner}/{repo}/contributors?per_page=30
        Collect all unique contributors across all repos
        Track which repos each contributor appears in and their commit count per repo
        STOP collecting when we have 200+ unique contributors OR we've hit 15 repos
        (this manages rate limits)

Step 3: Deduplicate contributors, rank by:
        - Number of distinct seed repos they contribute to (more = better)
        - Repo weight (contributing to a weight-3 repo counts more)
        - Commit count across repos
        Create a "raw_relevance" score from this

Step 4: For the top 100 contributors by raw_relevance:
        GET /users/{username} for full profile
        Filter by location if specified (fuzzy match — "SF" should match "San Francisco")
        Filter by activity recency

Step 5: For remaining matches (should be ~30-60 after filtering):
        Fetch repos and contribution data via GraphQL in batches of 10:
        
        query($login: String!) {
          user(login: $login) {
            contributionsCollection {
              totalCommitContributions
              totalPullRequestContributions
              totalPullRequestReviewContributions
              totalIssueContributions
              contributionCalendar {
                totalContributions
                weeks { contributionDays { contributionCount date } }
              }
            }
            repositories(first: 20, orderBy: {field: STARGAZERS, direction: DESC}, ownerAffiliations: OWNER) {
              nodes {
                name
                stargazerCount
                forkCount
                primaryLanguage { name }
                isFork
                updatedAt
              }
            }
            followers { totalCount }
            following { totalCount }
            organizations(first: 10) {
              nodes { login name }
            }
          }
        }

Step 6: Run the 5-pillar scoring engine on each enriched profile
        Return results sorted by GitScout score, tagged with source: "deep"
```

**Response:**
```typescript
{
  total_count: number,
  developers: Array<{
    // All fields from quick search, PLUS:
    source: "deep",
    score: {
      total: number,          // 0-100
      impact: number,         // 0-100
      contributionQuality: number,
      consistency: number,
      technicalDepth: number,
      reputation: number,
      confidence: "high" | "medium" | "low",
      confidenceModifier: number  // 0.5-1.0
    },
    tier: {
      emoji: string,          // "🦄", "🔥", etc.
      label: string,          // "Unicorn", "On Fire", etc.
    },
    topRepos: Array<{
      name: string,
      stars: number,
      forks: number,
      language: string,
      updatedAt: string
    }>,
    languages: Record<string, number>,  // { "TypeScript": 62, "Go": 25, "Python": 13 }
    totalStars: number,
    totalForks: number,
    contributionsLastYear: number,
    activeWeeksLastYear: number,
    externalReposContributedTo: string[],  // repos from seed list they contribute to
    organizations: string[],
    hasEmail: boolean,
    isHireable: boolean
  }>
}
```

---

## Part 5: Scoring Engine (`/lib/scoring/engine.ts`)

Implement the 5-pillar scoring engine. This is the core IP.

```typescript
export interface ScoringInput {
  // From user profile
  followers: number;
  following: number;
  publicRepos: number;
  accountCreatedAt: string;
  hireable: boolean;
  bio: string;
  
  // From repos
  repos: Array<{
    name: string;
    stars: number;
    forks: number;
    language: string;
    isFork: boolean;
    updatedAt: string;
    hasReadme?: boolean;
  }>;
  
  // From contributions (GraphQL)
  totalContributions: number;
  totalCommits: number;
  totalPRs: number;
  totalReviews: number;
  totalIssues: number;
  contributionDays: Array<{ date: string; count: number }>;
  
  // From deep search context
  externalReposContributedTo: string[];
  seedRepoContributions: Array<{ repo: string; weight: number; commits: number }>;
  organizations: string[];
  
  // Search context
  targetLanguage?: string;
  targetRole?: string;
}

export interface ScoreResult {
  total: number;
  impact: number;
  contributionQuality: number;
  consistency: number;
  technicalDepth: number;
  reputation: number;
  confidence: "high" | "medium" | "low";
  confidenceModifier: number;
  tier: { emoji: string; label: string; color: string };
  breakdown: {
    // Detailed sub-scores for the profile page breakdown UI
    [key: string]: { score: number; maxScore: number; signal: string };
  };
}

export function calculateScore(input: ScoringInput): ScoreResult
```

**Scoring rules (implement exactly):**

### Impact (30%)
- Stars across owned (non-fork) repos, log scale, cap any single repo at 40% of impact:
  - 0 stars = 0pts
  - 1-9 = 1pt
  - 10-99 = 3pts
  - 100-499 = 5pts
  - 500-999 = 7pts
  - 1000-4999 = 8pts  
  - 5000+ = 10pts
- Forks: same scale but multiply by 0.6 (forks are noisier)
- If user receives GitHub Sponsors: +2pts bonus (cap at 10)
- Normalize to 0-100

### Contribution Quality (25%)
- External merged PRs (seed repo contributions): THIS IS THE #1 SIGNAL
  - 0 = 0pts
  - 1-5 = 3pts
  - 6-20 = 6pts
  - 21-50 = 8pts
  - 50+ = 10pts
- PR review count: 10+ reviews/year = +2pts
- Total PRs opened: baseline activity indicator
  - >50/year = 2pts, >100/year = 3pts
- Normalize to 0-100

### Consistency (20%)
- Total contributions last 12 months:
  - <50 = 1pt
  - 50-199 = 3pts
  - 200-499 = 6pts
  - 500-999 = 8pts
  - 1000+ = 10pts
- Active weeks (weeks with at least 1 contribution out of 52):
  - <13 (less than quarterly) = 1pt
  - 13-25 = 3pts
  - 26-39 = 6pts
  - 40-52 = 10pts
- Recency bonus: active in last 30 days = +2pts, last 90 days = +1pt
- Normalize to 0-100

### Technical Depth (15%)
- Language match to target search:
  - Primary language exact match = 10pts
  - Top 3 languages include match = 7pts
  - Any repo in that language = 4pts
  - No match = 0pts
- Language diversity:
  - 1 language = 0pts (neutral, not penalized)
  - 2-3 = 2pts
  - 4-6 = 3pts
  - 7+ = 2pts (diminishing, might be unfocused)
- Repo quality indicators:
  - Has repos with 100+ stars = +2pts
  - Average repo has meaningful description = +1pt
- Normalize to 0-100

### Reputation (10%)
- Followers, log scale:
  - <10 = 0pts
  - 10-49 = 2pts
  - 50-199 = 4pts
  - 200-999 = 7pts
  - 1000+ = 10pts
- Follower ratio (followers / max(following, 1)):
  - >5:1 = +2pts
  - >2:1 = +1pt
  - <0.5:1 = -1pt
- Notable org memberships: +1pt per recognized org (cap at 3pts)
  - Recognized orgs: google, facebook, meta, microsoft, apple, amazon, netflix, stripe, vercel, supabase, hashicorp, docker, kubernetes, rust-lang, golang, python, nodejs, and any org with >1000 public members
- Normalize to 0-100

### Confidence Modifier
```
if (publicRepos >= 10 && totalContributions >= 200 && recentlyActive) → 1.0 (high)
else if (publicRepos >= 5 && totalContributions >= 50) → 0.75 (medium)  
else → 0.5 (low)
```

### Final Score
```
total = (impact * 0.30 + quality * 0.25 + consistency * 0.20 + depth * 0.15 + reputation * 0.10) * confidenceModifier
```

### Tier Assignment
- 90-100 → { emoji: "🦄", label: "Unicorn", color: "#AFA9EC" }
- 75-89 → { emoji: "🔥", label: "On Fire", color: "#EF9F27" }
- 60-74 → { emoji: "💎", label: "Gem", color: "#85B7EB" }
- 40-59 → { emoji: "🌱", label: "Seedling", color: "#5DCAA5" }
- 0-39 → { emoji: "🌫️", label: "Mystery", color: "#888780" }

---

## Part 6: Unified Search Orchestrator (`/app/api/search/route.ts`)

The main search endpoint that coordinates quick and deep pipelines.

**Request:**
```typescript
POST /api/search
{
  query?: string,           // free text (parsed for keywords)
  language?: string,
  location?: string,
  roleCategory?: string,    // triggers deep search
  minFollowers?: number,
  minStars?: number,
  hireableOnly?: boolean,
  hasEmailOnly?: boolean,
  activeInDays?: number,
  sortBy?: "score" | "followers" | "stars" | "recent",
  page?: number,
  perPage?: number
}
```

**Logic:**
1. Immediately start the quick pipeline → return results as `quickResults`
2. If `roleCategory` is specified, also start the deep pipeline in parallel
3. Return a streaming response (use ReadableStream / Server-Sent Events) so the frontend can show quick results first, then append deep results as they arrive

**Response format (SSE stream):**
```
event: quick_results
data: { "total": 30, "developers": [...] }

event: deep_progress  
data: { "message": "Scanning React contributors...", "progress": 0.2 }

event: deep_progress
data: { "message": "Enriching profiles...", "progress": 0.6 }

event: deep_results
data: { "total": 45, "developers": [...] }

event: complete
data: { "quickCount": 30, "deepCount": 45, "mergedCount": 52, "unicorns": 3 }
```

---

## Part 7: Pre-Index Cron Job (`/app/api/cron/index-developers/route.ts`)

A Vercel cron job that pre-indexes top developers into Supabase so common searches are instant.

**Setup:** Add to `vercel.json`:
```json
{
  "crons": [{
    "path": "/api/cron/index-developers",
    "schedule": "0 3 * * *"
  }]
}
```

**Logic:**
1. For each role category in seedRepos.ts:
   - Fetch contributors from the top 10 weight-3 repos
   - Enrich top 50 contributors per category with full profile + GraphQL data
   - Score each developer
   - Upsert into `developer_profiles` and `developer_scores` tables in Supabase
2. Rate limit aware: process slowly, respect GitHub's limits
3. Target: ~500 developers per role category × 6 categories = ~3,000 pre-indexed profiles
4. Log progress and any errors to a `cron_logs` table
5. Skip developers already indexed in the last 7 days (only refresh stale profiles)

**Supabase tables needed:**

```sql
-- Make sure these exist (create if not)
CREATE TABLE IF NOT EXISTS developer_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  github_username TEXT UNIQUE NOT NULL,
  github_id BIGINT,
  display_name TEXT,
  bio TEXT,
  location TEXT,
  email TEXT,
  blog TEXT,
  twitter_username TEXT,
  company TEXT,
  hireable BOOLEAN,
  avatar_url TEXT,
  followers INTEGER DEFAULT 0,
  following INTEGER DEFAULT 0,
  public_repos INTEGER DEFAULT 0,
  total_stars INTEGER DEFAULT 0,
  total_forks INTEGER DEFAULT 0,
  top_languages JSONB DEFAULT '{}',
  organizations TEXT[] DEFAULT '{}',
  account_created_at TIMESTAMPTZ,
  last_active_at TIMESTAMPTZ,
  profile_url TEXT,
  raw_api_data JSONB,
  indexed_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS developer_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  developer_id UUID REFERENCES developer_profiles(id) ON DELETE CASCADE,
  github_username TEXT NOT NULL,
  score_total DECIMAL(5,2) DEFAULT 0,
  score_impact DECIMAL(5,2) DEFAULT 0,
  score_contribution DECIMAL(5,2) DEFAULT 0,
  score_consistency DECIMAL(5,2) DEFAULT 0,
  score_technical DECIMAL(5,2) DEFAULT 0,
  score_reputation DECIMAL(5,2) DEFAULT 0,
  confidence TEXT DEFAULT 'low',
  confidence_modifier DECIMAL(3,2) DEFAULT 0.5,
  tier_emoji TEXT,
  tier_label TEXT,
  role_context TEXT,
  language_match JSONB DEFAULT '{}',
  scoring_version TEXT DEFAULT 'v1',
  breakdown JSONB DEFAULT '{}',
  scored_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(github_username, role_context)
);

CREATE TABLE IF NOT EXISTS developer_repos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  developer_id UUID REFERENCES developer_profiles(id) ON DELETE CASCADE,
  github_username TEXT NOT NULL,
  repo_name TEXT NOT NULL,
  full_name TEXT,
  stars INTEGER DEFAULT 0,
  forks INTEGER DEFAULT 0,
  primary_language TEXT,
  is_fork BOOLEAN DEFAULT false,
  description TEXT,
  topics TEXT[] DEFAULT '{}',
  updated_at TIMESTAMPTZ,
  UNIQUE(github_username, repo_name)
);

CREATE TABLE IF NOT EXISTS api_cache (
  cache_key TEXT PRIMARY KEY,
  response JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  ttl_seconds INTEGER DEFAULT 3600
);

CREATE TABLE IF NOT EXISTS search_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT,  -- for future auth
  query JSONB NOT NULL,
  result_count INTEGER DEFAULT 0,
  unicorn_count INTEGER DEFAULT 0,
  searched_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cron_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name TEXT NOT NULL,
  status TEXT NOT NULL,  -- 'started', 'completed', 'failed'
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_profiles_location ON developer_profiles USING gin (to_tsvector('english', coalesce(location, '')));
CREATE INDEX IF NOT EXISTS idx_profiles_languages ON developer_profiles USING gin (top_languages);
CREATE INDEX IF NOT EXISTS idx_profiles_username ON developer_profiles (github_username);
CREATE INDEX IF NOT EXISTS idx_scores_total ON developer_scores (score_total DESC);
CREATE INDEX IF NOT EXISTS idx_scores_username ON developer_scores (github_username);
CREATE INDEX IF NOT EXISTS idx_cache_expiry ON api_cache (created_at);
```

---

## Part 8: Search Frontend Integration (`/app/search/page.tsx` updates)

Wire the new search architecture into the existing search page.

**Search flow:**

1. User selects a role category card OR enters structured search criteria
2. UI immediately shows the SearchRadar animation + rotating loading messages
3. Call `POST /api/search` with an EventSource for SSE streaming
4. On `quick_results` event: render results immediately with the staggered card animation. Each card shows the quick score (followers-based) with a "Quick match" badge
5. On `deep_progress` events: update the loading message ("Scanning React contributors...")
6. On `deep_results` event: merge deep results into the list, re-sort by GitScout score. Deep results get a "Deep match" badge and show the full 5-pillar score + tier emoji
7. On `complete` event: stop the radar animation, show final count. If unicorns > 0, trigger the unicorn celebration + sound

**Also check Supabase first:**
Before hitting the GitHub API at all, query `developer_profiles` + `developer_scores` in Supabase for any pre-indexed developers matching the search criteria. Show these FIRST (they're instant), then supplement with live API results.

```typescript
// Pseudo-code for the search page
async function handleSearch(filters: SearchFilters) {
  setIsSearching(true);
  
  // Step 1: Query local Supabase index (instant)
  const cached = await supabase
    .from('developer_profiles')
    .select('*, developer_scores(*)')
    .ilike('location', `%${filters.location}%`)
    .contains('top_languages', { [filters.language]: true })
    .order('developer_scores.score_total', { ascending: false })
    .limit(50);
  
  if (cached.data?.length > 0) {
    setResults(cached.data);  // Show immediately
  }
  
  // Step 2: Stream from live search API
  const eventSource = new EventSource('/api/search?' + new URLSearchParams(filters));
  
  eventSource.addEventListener('quick_results', (e) => {
    const data = JSON.parse(e.data);
    mergeResults(data.developers);  // Merge with cached, deduplicate by username
  });
  
  eventSource.addEventListener('deep_results', (e) => {
    const data = JSON.parse(e.data);
    mergeResults(data.developers);  // Merge, re-sort by score
    // Cache new profiles to Supabase for future searches
    cacheProfiles(data.developers);
  });
  
  eventSource.addEventListener('complete', (e) => {
    setIsSearching(false);
    const data = JSON.parse(e.data);
    if (data.unicorns > 0) {
      celebrateUnicorn();
      playUnicornSound();
    }
  });
}
```

**Result card updates:**
- Quick results show: avatar, name, location, followers, repos, languages, "Quick match" pill (gray)
- Deep results show: avatar, name, location, GitScout score ring, tier emoji, top repos, languages, contribution count, "Deep match" pill (green)
- All cards show: email indicator (✉️ if available), hireable badge if true, "Save" button, "Copy email" button
- Sort dropdown: "GitScout Score" (default for deep), "Followers", "Most Active", "Newest"

**Empty state improvements:**
- If 0 results: "No developers matched. Try broadening your location or lowering the follower minimum."
- If quick results but 0 deep results: "Found some quick matches. Deep search found no additional results for this criteria."
- If still searching: show the radar + messages, never show an empty state while search is in progress

---

## Part 9: Location Fuzzy Matching (`/lib/search/locationMatch.ts`)

GitHub location data is messy. People write "SF", "San Francisco", "San Francisco, CA", "Bay Area", "San Francisco Bay Area", etc. Build a fuzzy matcher.

```typescript
export function matchesLocation(profileLocation: string | null, searchLocation: string): boolean
```

**Rules:**
- Case insensitive
- Common abbreviations map: SF → San Francisco, NYC → New York, LA → Los Angeles, SEA → Seattle, ATX → Austin, DEN → Denver, CHI → Chicago, BOS → Boston, PDX → Portland, DC → Washington
- Partial match: "San Francisco" should match "San Francisco, CA" and "San Francisco Bay Area"
- State matching: "California" should match any city in California
- Country matching: "Germany" should match "Berlin, Germany" and "Munich"
- If searchLocation is empty/null, match everything
- Use string includes as a fallback after specific rules

Create a `LOCATION_ALIASES` map with common abbreviations and variations for the top 50 tech hubs worldwide.

---

## Environment Variables Needed
```
GITHUB_TOKEN=               # GitHub personal access token (fine-grained, read-only public data)
NEXT_PUBLIC_SUPABASE_URL=   # Already set
NEXT_PUBLIC_SUPABASE_ANON_KEY=  # Already set  
SUPABASE_SERVICE_ROLE_KEY=  # For server-side Supabase operations
ANTHROPIC_API_KEY=          # For scouting reports (from previous feature set)
CRON_SECRET=                # Secret to protect cron endpoint
```

## Testing the Pipeline

After building everything, test with these searches to verify quality:

1. **"Frontend + San Francisco"** — should surface React/Next.js contributors in SF. Expect to find people from Vercel, Meta, Stripe.
2. **"ML + remote"** — should surface PyTorch/HuggingFace contributors. Many ML engineers don't list a location.  
3. **"Rust + anywhere"** — should surface tokio/serde/tauri contributors. Small community, high quality.
4. **"Backend + Austin"** — good test for location fuzzy matching (ATX, Austin TX, Austin, Texas).

For each test, the deep pipeline should return noticeably better results than the quick pipeline. If the quick and deep results are similar quality, the deep pipeline isn't working correctly.

## Priority If Building Incrementally
1. Part 2 (GitHub client) — everything depends on this
2. Part 5 (Scoring engine) — core IP
3. Part 1 (Seed repos) — data for deep search
4. Part 3 (Quick search) — immediate results
5. Part 4 (Deep search) — the quality upgrade
6. Part 6 (Orchestrator) — ties quick + deep together
7. Part 8 (Frontend) — user-facing integration
8. Part 9 (Location matching) — quality of life
9. Part 7 (Cron job) — pre-indexing for speed
