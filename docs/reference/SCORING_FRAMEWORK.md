# Scout Developer Scoring Framework
## A Recruiter-Built Scoring Engine for Identifying Top Engineering Talent via GitHub

---

## Philosophy

Most GitHub sourcing tools make the same mistake: they treat all signals equally and over-index on vanity metrics. A developer with 10,000 stars on a single viral README template is not a better engineer than someone quietly shipping merged PRs to Kubernetes.

Scout's scoring should answer one question: **"How likely is this person to be a strong hire for a given role?"** That means the score must be contextual — a great ML engineer looks different from a great frontend developer on GitHub.

---

## The Five Pillars of Developer Quality

### Pillar 1: IMPACT (Weight: 30%)
*Does this person's code matter to others?*

| Signal | What It Tells You | API Source | Score Logic |
|--------|-------------------|------------|-------------|
| **Stars received (across owned repos)** | Community validation of their work | REST: `/users/{username}/repos` → `stargazers_count` | Log scale. 0 stars = 0pts, 10+ = 2pts, 100+ = 5pts, 1000+ = 8pts, 10000+ = 10pts |
| **Forks of their repos** | Others building on their work | REST: `/users/{username}/repos` → `forks_count` | Log scale similar to stars, but weighted ~60% of stars (forks are noisier) |
| **Repos used as dependencies** | Real production impact | Not directly available — proxy via forks + stars combined | Composite of stars × forks ratio |
| **Watchers on repos** | Sustained interest (not just a one-time star) | REST: `/repos/{owner}/{repo}` → `subscribers_count` | Watchers > 50 is a strong signal |
| **GitHub Sponsors (receiving)** | People literally pay for their work | GraphQL: `user.isSponsorable`, `user.sponsors` | Binary bonus: +3pts if sponsorable and has sponsors |

**Anti-gaming note:** A single viral repo shouldn't dominate. Cap any single repo's contribution to Impact at 40% of the pillar score. Distribute across repos.

---

### Pillar 2: CONTRIBUTION QUALITY (Weight: 25%)
*How does this person collaborate and ship code?*

| Signal | What It Tells You | API Source | Score Logic |
|--------|-------------------|------------|-------------|
| **Pull requests merged (to repos they don't own)** | Upstream open source contributions — the gold standard | GraphQL: `contributionsCollection.pullRequestContributions` + search `is:pr is:merged author:{user} -user:{user}` | This is the single most valuable metric. 1-5 merged = 3pts, 5-20 = 6pts, 20-50 = 8pts, 50+ = 10pts |
| **PR review activity** | Shows senior-level collaboration | GraphQL: `contributionsCollection.pullRequestReviewContributions` | Active reviewers signal seniority. 10+ reviews = bonus |
| **Issues opened on other repos** | Thoughtful bug reporting shows depth | GraphQL: `contributionsCollection.issueContributions` | Moderate signal. Bonus for issues on high-profile repos |
| **Code review comments** | Depth of engagement, mentorship | Search API: `commenter:{user} type:pr` | Quality over quantity — existence is the signal |
| **PR merge rate** | Do their PRs actually get accepted? | Requires computing: merged PRs / total PRs opened | >70% merge rate = strong, <30% = red flag |

**Key insight from recruiting:** PRs merged to repos the user doesn't own is the #1 signal. It means someone else reviewed their code and decided it was good enough to ship. This is peer validation you can't fake.

---

### Pillar 3: CONSISTENCY & ACTIVITY (Weight: 20%)
*Is this person actively building, or is this a stale profile?*

| Signal | What It Tells You | API Source | Score Logic |
|--------|-------------------|------------|-------------|
| **Contribution calendar (last 12 months)** | Activity pattern and consistency | GraphQL: `contributionsCollection.contributionCalendar` | Total contributions: <50 = low, 50-200 = moderate, 200-500 = active, 500+ = very active |
| **Contribution streak / regularity** | Consistency matters more than bursts | GraphQL: `contributionCalendar.weeks[].contributionDays[]` | Calculate % of weeks with at least 1 contribution. >75% = consistent |
| **Account age** | Context for all other metrics | REST: `/users/{username}` → `created_at` | Normalize other scores by account age. 5yr account with 100 stars > 1yr account with 100 stars... but not always |
| **Recent activity (last 90 days)** | Are they currently active? | GraphQL: `contributionsCollection(from, to)` | Recency bonus: active in last 90 days = +2pts |
| **Commit frequency** | Regular shipping cadence | REST: `/users/{username}/events` (PushEvents) | Look for steady cadence, not just volume |

**Important nuance:** Many excellent senior engineers have sparse GitHub profiles because they work on proprietary code all day. Low activity should reduce the confidence of the score, not necessarily lower it. Flag as "insufficient public data" rather than scoring them poorly.

---

### Pillar 4: TECHNICAL DEPTH (Weight: 15%)
*What do they actually know, and how deep does it go?*

| Signal | What It Tells You | API Source | Score Logic |
|--------|-------------------|------------|-------------|
| **Primary languages** | Tech stack match for your role | REST: `/users/{username}/repos` → `language` + GraphQL for detailed breakdown | Match against search criteria. Exact match = 10pts, adjacent = 5pts |
| **Language diversity** | Polyglot vs specialist | Aggregate across repos | 1 language = specialist (neutral), 3-5 = well-rounded (+bonus), 8+ = curious mind or unfocused |
| **Repo complexity indicators** | Depth of projects | REST: `/repos/{owner}/{repo}` → size, has_wiki, has_pages, topics | Larger repos with docs/wikis/CI suggest production-grade work |
| **Topics/tags on repos** | Self-described expertise areas | REST: `/repos/{owner}/{repo}/topics` | Match against role requirements |
| **README quality** | Communication skills, professionalism | Not directly scorable via API — would need content analysis | Existence of README = baseline. Detailed README with examples = bonus |
| **CI/CD configuration** | Production engineering maturity | Check for `.github/workflows/` in repos | Presence of GitHub Actions = +1pt per repo (capped) |

**Scoring language match:**
For a "Senior React Developer" search, weight JavaScript/TypeScript repos 3x. For "ML Engineer", weight Python/Jupyter repos. This is where Scout becomes contextual rather than generic.

---

### Pillar 5: REPUTATION & SOCIAL PROOF (Weight: 10%)
*How does the community see this person?*

| Signal | What It Tells You | API Source | Score Logic |
|--------|-------------------|------------|-------------|
| **Followers** | Developer community standing | REST: `/users/{username}` → `followers` | Log scale: <10 = 0pts, 10-50 = 2pts, 50-200 = 4pts, 200-1000 = 7pts, 1000+ = 10pts |
| **Follower/following ratio** | Are they a thought leader or just following everyone? | REST: followers vs following | Ratio > 2:1 = positive signal. Ratio < 0.5:1 = weak signal |
| **Organization memberships** | Employer/community affiliations | REST: `/users/{username}/orgs` | Notable orgs (FAANG, top OSS foundations) = major bonus |
| **GitHub Achievements** | Platform recognition | Not fully available via API — visible on profile | Starstruck (Gold) = strong, Pull Shark (Gold) = very strong, Arctic Code Vault = legacy credibility |
| **GitHub Pro/verified** | Profile investment | REST: `/users/{username}` → `plan` | Minor signal — shows they care about their profile |
| **Hireable flag** | Actively looking | REST: `/users/{username}` → `hireable` | Boolean bonus for sourcing — doesn't affect quality score but flags reachability |
| **Bio & contact info** | Reachability | REST: `/users/{username}` → `bio`, `email`, `blog`, `twitter_username` | For sourcing: email present = gold, blog/twitter = bonus outreach channels |

---

## GitHub Achievements Reference

Current earnable achievements and what they signal:

| Achievement | How Earned | Tiers | Recruiting Signal |
|-------------|-----------|-------|-------------------|
| **Pull Shark** | Merged PRs | 2 / 16 / 128 / 1024 | **HIGHEST VALUE** — Gold Pull Shark = elite contributor |
| **Starstruck** | Stars on a repo | 16 / 128 / 512 / 4096 | Community impact, possibly viral project |
| **Pair Extraordinaire** | Co-authored merged PRs | 1 / 10 / 24 / 48 | Collaboration skills |
| **Galaxy Brain** | Accepted discussion answers | 2 / 8 / 16 / 32 | Knowledge sharing, mentorship |
| **YOLO** | Merged PR without review | 1 | Neutral/slightly negative — shipping fast or skipping process? |
| **Quickdraw** | Closed issue/PR within 5 min | 1 | Minor — fast responder |
| **Public Sponsor** | Sponsored OSS work | 1 | Community investment |
| **Arctic Code Vault** | Pre-2020 contributor | N/A (legacy) | Long-term OSS commitment, seniority signal |
| **Mars 2020 Contributor** | Code used in Mars mission | N/A (legacy) | Prestige — code in space |

---

## Composite Score Formula

```
FINAL_SCORE = (
  Impact_Score × 0.30 +
  Contribution_Quality_Score × 0.25 +
  Consistency_Score × 0.20 +
  Technical_Depth_Score × 0.15 +
  Reputation_Score × 0.10
) × Confidence_Modifier
```

### Confidence Modifier (0.5 — 1.0)
This is critical. Not every profile has enough data to score reliably.

- **High confidence (1.0):** 10+ public repos, 200+ contributions last year, active in last 90 days
- **Medium confidence (0.75):** 5-10 repos, 50-200 contributions, some recent activity
- **Low confidence (0.5):** <5 repos, <50 contributions, or no activity in 6+ months

Display this alongside the score: "Score: 82/100 (High Confidence)" vs "Score: 65/100 (Low Confidence)"

---

## Score Tiers for Display

| Score Range | Label | What It Means |
|-------------|-------|---------------|
| 90-100 | Elite | Top-tier OSS contributor, likely already known in their community |
| 75-89 | Strong | Active, impactful developer with proven collaboration skills |
| 60-74 | Solid | Good contributor, worth a closer look |
| 40-59 | Emerging | Newer or less active, but shows promise |
| 0-39 | Limited Data | Not enough public activity to assess — may still be excellent |

---

## API Implementation Strategy

### Data Collection Per User (Ordered by API Efficiency)

**Step 1 — REST API (cheap, fast)**
```
GET /users/{username}           → bio, location, email, followers, following, created_at, hireable
GET /users/{username}/repos     → repos list with stars, forks, language, topics
GET /users/{username}/orgs      → organization memberships
GET /users/{username}/events    → recent activity (last 90 days of public events)
```

**Step 2 — GraphQL API (richer, single query)**
```graphql
query($login: String!) {
  user(login: $login) {
    contributionsCollection {
      totalCommitContributions
      totalIssueContributions
      totalPullRequestContributions
      totalPullRequestReviewContributions
      restrictedContributionsCount
      contributionCalendar {
        totalContributions
        weeks {
          contributionDays {
            contributionCount
            date
          }
        }
      }
    }
    repositories(first: 100, orderBy: {field: STARGAZERS, direction: DESC}) {
      nodes {
        name
        stargazerCount
        forkCount
        primaryLanguage { name }
        isFork
        description
        updatedAt
      }
    }
    followers { totalCount }
    following { totalCount }
    sponsorshipsAsMaintainer(first: 1) { totalCount }
    isSponsorable
  }
}
```

**Step 3 — Search API (for cross-repo contributions)**
```
GET /search/issues?q=author:{username}+is:pr+is:merged+-user:{username}
```
This gives you merged PRs to OTHER people's repos — the most valuable signal.

### Rate Limit Strategy
- REST API: 5,000 requests/hour with token
- GraphQL: 5,000 points/hour (queries cost 1+ points based on complexity)
- Search API: 30 requests/minute

For batch scoring, implement a queue with rate limiting. Cache results in Supabase with a TTL (profiles don't change hourly).

---

## Competitive Landscape

| Tool | Approach | Pricing | What Scout Can Do Better |
|------|----------|---------|----------------------------|
| **SeekOut** | "Coder Score" 1-5 stars, aggregates GH + SO | ~$500/mo | Black box scoring. Scout = transparent, customizable weights |
| **GitRoll** | AI-powered "CURISM" scoring | Free tier + paid | Heavy AI, slow. Scout = fast, recruiter-first UX |
| **GitHunt** | AI ranks by contributions + stack match | $39-299/mo | Good but generic. Scout = contextual scoring per role |
| **AmazingHiring** | Aggregates 50+ platforms | ~$300/mo | Broad but unfocused. Scout = GitHub-deep |

### Scout's Edge
1. **Contextual scoring** — weights shift based on the role you're hiring for
2. **Transparency** — show WHY someone scored high, not just a number
3. **Recruiter-built** — designed for sourcing workflow, not developer vanity metrics
4. **Speed** — score in real-time during search, don't make recruiters wait

---

## Implementation Priority

### Phase 1: MVP Scoring (Ship This First)
- Stars across repos (capped per repo)
- Followers + follower ratio
- Contribution count (last 12 months)
- Primary language match
- Account age
- Hireable flag + email availability
- Basic composite score with tier labels

### Phase 2: Deep Scoring
- Merged PRs to external repos (Search API)
- PR review activity (GraphQL)
- Contribution calendar analysis (consistency)
- Organization membership signals
- Confidence modifier

### Phase 3: Intelligence Layer
- Achievement badge detection
- README quality analysis (could use Claude API for this)
- CI/CD maturity signals
- Role-specific weight presets (Frontend, Backend, ML, DevOps, etc.)
- Similar developer recommendations ("developers like this one")

---

## Data Model (Supabase)

```sql
-- Core developer profile cache
CREATE TABLE developer_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  github_username TEXT UNIQUE NOT NULL,
  github_id BIGINT UNIQUE,
  display_name TEXT,
  bio TEXT,
  location TEXT,
  email TEXT,
  blog TEXT,
  twitter_username TEXT,
  company TEXT,
  hireable BOOLEAN,
  avatar_url TEXT,
  followers INTEGER,
  following INTEGER,
  public_repos INTEGER,
  account_created_at TIMESTAMPTZ,
  last_scored_at TIMESTAMPTZ,
  raw_api_data JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Scoring results
CREATE TABLE developer_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  developer_id UUID REFERENCES developer_profiles(id),
  score_total DECIMAL(5,2),
  score_impact DECIMAL(5,2),
  score_contribution DECIMAL(5,2),
  score_consistency DECIMAL(5,2),
  score_technical DECIMAL(5,2),
  score_reputation DECIMAL(5,2),
  confidence_level TEXT, -- 'high', 'medium', 'low'
  confidence_modifier DECIMAL(3,2),
  role_context TEXT, -- what role this was scored for
  language_match JSONB, -- matched languages
  scoring_version TEXT, -- track algorithm changes
  scored_at TIMESTAMPTZ DEFAULT now()
);

-- Repo-level data for drill-down
CREATE TABLE developer_repos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  developer_id UUID REFERENCES developer_profiles(id),
  repo_name TEXT,
  stars INTEGER,
  forks INTEGER,
  primary_language TEXT,
  is_fork BOOLEAN,
  description TEXT,
  topics TEXT[],
  updated_at TIMESTAMPTZ
);
```

---

## Key Takeaways

1. **PRs merged to repos they don't own is the single most important metric.** Everything else is secondary.
2. **Don't penalize sparse profiles** — flag low confidence instead. Many great engineers don't have public GitHub activity.
3. **Context is everything** — a React developer and an ML engineer look completely different on GitHub.
4. **Cap single-repo influence** — one viral project shouldn't inflate the whole score.
5. **Show your work** — recruiters trust scores they can understand and explain to hiring managers.
6. **Cache aggressively** — GitHub profiles don't change hourly, and API rate limits are real.
7. **The hireable flag + email is sourcing gold** — surface it prominently in the UI.
