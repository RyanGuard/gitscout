# Autonomous Development Agent — Full Self-Improving Loop

## Overview

This is not just an auto-fix agent. This is a full autonomous development system that:
1. Researches what users need and competitors have
2. Designs features and improvements
3. Builds them
4. Tests them
5. Deploys them
6. Evaluates the results
7. Iterates

It runs 24/7 on the VPS with no human intervention. You wake up to a better product every day.

## The Loop

```
┌─────────────────────────────────────────────────────────────────┐
│                    CONTINUOUS IMPROVEMENT LOOP                   │
│                                                                 │
│  EVALUATE (existing agents)                                     │
│  └→ Search quality, map quality, connection quality, latency    │
│  └→ Writes improvement_tickets to Supabase                      │
│                                                                 │
│  RESEARCH (new agent)                                           │
│  └→ Scrape competitor changelogs, G2 reviews, Reddit, HN        │
│  └→ Claude analyzes: what are users asking for?                 │
│  └→ Writes feature_ideas to Supabase with priority scores       │
│                                                                 │
│  PLAN (new agent)                                               │
│  └→ Reads improvement_tickets + feature_ideas                   │
│  └→ Claude ranks by impact: what should we build next?          │
│  └→ Claude writes a mini build spec for the top item            │
│  └→ Writes to development_queue table                           │
│                                                                 │
│  BUILD (new agent)                                              │
│  └→ Reads from development_queue                                │
│  └→ Claude Code implements the change on a branch               │
│  └→ Runs build + tests                                          │
│  └→ Auto-merges if safe, or stages for complex changes          │
│                                                                 │
│  DEPLOY (automatic via Vercel)                                  │
│  └→ Push to main triggers Vercel auto-deploy                    │
│                                                                 │
│  EVALUATE (loop restarts)                                       │
│  └→ Eval agents re-score everything                             │
│  └→ Did the change improve scores? Track in eval_scores_history │
│  └→ If scores dropped: auto-revert                              │
│                                                                 │
│  REPEAT FOREVER                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## New Supabase Tables

### `feature_ideas`
```sql
create table if not exists feature_ideas (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  -- "competitor" = found on competitor changelog
  -- "review" = from G2/Capterra reviews of competitors
  -- "community" = from Reddit/HN/Twitter
  -- "eval" = derived from eval agent findings
  -- "internal" = from improvement_tickets
  source_url text,
  title text not null,
  description text not null,
  impact_score integer,
  effort_estimate text,
  competitor_has text[],
  status text not null default 'idea',
  -- idea → planned → building → shipped → evaluated
  created_at timestamptz not null default now()
);
```

### `development_queue`
```sql
create table if not exists development_queue (
  id uuid primary key default gen_random_uuid(),
  source_type text not null,
  -- "ticket" = from improvement_tickets
  -- "feature" = from feature_ideas
  source_id uuid,
  priority integer not null,
  -- 1 = highest (critical fix), 10 = lowest (nice to have)
  title text not null,
  build_spec text not null,
  -- Claude-generated mini spec: what files to change, what the change does
  complexity text not null,
  -- "trivial" = <10 lines, auto-merge ok
  -- "small" = 10-50 lines, auto-merge with post-build check
  -- "medium" = 50-200 lines, auto-merge with post-deploy eval
  -- "large" = >200 lines, stage on branch for batch review
  status text not null default 'queued',
  -- queued → building → testing → deployed → evaluated → completed | reverted
  branch_name text,
  pr_url text,
  pre_deploy_scores jsonb,
  post_deploy_scores jsonb,
  score_delta jsonb,
  deployed_at timestamptz,
  reverted_at timestamptz,
  created_at timestamptz not null default now()
);
```

### `deploy_log`
```sql
create table if not exists deploy_log (
  id uuid primary key default gen_random_uuid(),
  queue_id uuid references development_queue(id),
  action text not null,
  -- "merge", "deploy", "evaluate", "revert"
  details jsonb,
  created_at timestamptz not null default now()
);
```

## Agent Specs

### Agent: Research (agents/research.ts)
**Schedule:** Daily at 10:00 AM UTC

**What it does:**
1. Scrape competitor blogs/changelogs for new features:
   - SeekOut blog
   - Gem blog
   - Loxo blog
   - Juicebox blog
   - Dover blog
   - Hireflow blog

2. Scrape community discussions for unmet needs:
   - Reddit r/recruiting, r/recruitinghell — search "sourcing tool", "recruiting software", "talent mapping"
   - Hacker News — search "recruiting", "sourcing", "hiring tool"

3. Scrape G2/Capterra reviews for competitor pain points:
   - Search for 1-3 star reviews of SeekOut, Gem, Loxo
   - Extract recurring complaints

4. Feed all findings to Claude:
```
You are a product strategist for GitScout, a recruiting intelligence platform with three features: developer search (GitHub-powered), market map (company landscape with Apollo data), and connection mapper (warm path detection).

Here are signals from the market this week:

COMPETITOR UPDATES:
{scraped changelog entries}

COMMUNITY DISCUSSIONS:
{Reddit/HN threads}

COMPETITOR PAIN POINTS (from reviews):
{G2/Capterra complaints}

For each signal, assess:
1. Is this relevant to GitScout? (yes/no)
2. If yes: what feature or improvement would address this?
3. Impact score (1-10): how much would this move the needle for GitScout users?
4. Effort estimate: "trivial" (<1 hour), "small" (1-4 hours), "medium" (1-2 days), "large" (3+ days)
5. Do any competitors already have this? Which ones?

Respond in JSON:
{
  "ideas": [
    {
      "title": "...",
      "description": "...",
      "impact_score": 8,
      "effort_estimate": "small",
      "competitor_has": ["SeekOut", "Gem"],
      "source": "competitor",
      "source_detail": "Gem launched X feature this week"
    }
  ]
}
```

5. Write each idea to `feature_ideas` table if it doesn't already exist (deduplicate by title similarity)

### Agent: Planner (agents/planner.ts)
**Schedule:** Daily at 11:00 AM UTC (after research)

**What it does:**
1. Read all open improvement_tickets (from eval agents)
2. Read all feature_ideas with status = "idea"
3. Read current development_queue to avoid duplicates
4. Feed everything to Claude:

```
You are the technical lead for GitScout. You need to decide what to build next.

OPEN TICKETS (bugs and quality issues):
{tickets with severity and category}

FEATURE IDEAS (from research):
{ideas with impact scores}

CURRENTLY IN QUEUE:
{items already being built}

Rules:
- Critical tickets always go first
- High-severity tickets before features
- Features ranked by impact_score / effort_estimate ratio
- Never queue more than 5 items at once
- Never queue a "large" complexity item — those need human planning

For each item you recommend building, provide:
1. source_type: "ticket" or "feature"
2. source_id: the ticket or feature ID
3. priority: 1-10
4. title: short description
5. complexity: "trivial", "small", or "medium"
6. build_spec: A detailed mini-spec that a code agent can follow. Include:
   - Which files to modify
   - What the change should do
   - What the expected behavior is after the change
   - How to verify it works
   Be specific enough that someone reading only this spec could implement it.

Respond in JSON:
{
  "queue": [
    {
      "source_type": "ticket",
      "source_id": "uuid",
      "priority": 1,
      "title": "Fix search returning 0 results for multi-word queries",
      "complexity": "small",
      "build_spec": "In src/app/api/search/route.ts, the buildGitHubQuery function joins multiple search terms with implicit AND. Change to explicit OR by joining with ' OR '. Test: search for 'kubernetes terraform' should return >0 results."
    }
  ]
}
```

5. Insert new items into development_queue with status = "queued"
6. Update source ticket/feature status to "planned"

### Agent: Builder (agents/builder.ts)
**Schedule:** Every 4 hours starting at 12:00 PM UTC (12, 4PM, 8PM, 12AM, 4AM, 8AM)

**What it does:**
1. Read development_queue WHERE status = "queued" ORDER BY priority ASC LIMIT 1
2. If nothing queued, exit
3. Update status to "building"
4. Snapshot current eval scores as pre_deploy_scores
5. Execute the build:

```
For the GitScout repo at GITSCOUT_REPO_PATH:

a. git checkout main && git pull
b. Create branch: dev/{queue-id-short}
c. Read the build_spec from the queue item
d. Send the build_spec to Claude API along with the contents of files that need changing:

"You are a code agent implementing a change to a Next.js + TypeScript codebase.

BUILD SPEC:
{build_spec from queue item}

CURRENT FILE CONTENTS:
{read each file mentioned in the spec}

Generate the exact changes needed. For each file, provide:
- path: the file path
- search: exact text to find
- replace: exact replacement text

Rules:
- Make minimal changes — only what the spec describes
- Do not modify API routes unless the spec explicitly says to
- Do not modify schema.prisma or migrations
- Do not add dependencies
- Keep the same code style as the existing file

Respond in JSON."

e. Apply the changes
f. Run npm run build
g. If build fails: revert, mark queue item as "failed", exit
h. Check git diff — enforce limits based on complexity:
   - trivial: max 10 lines
   - small: max 50 lines
   - medium: max 200 lines
   If over limit: revert, mark as "failed" with reason "exceeded line limit"
i. Commit, push branch
j. If complexity is "trivial" or "small": auto-merge to main via GitHub API
   If complexity is "medium": create PR but don't merge (wait for post-deploy eval to confirm)
k. Update queue item: status = "deployed" (or "testing" for medium), branch_name, pr_url, deployed_at
```

### Agent: Post-Deploy Evaluator (agents/post-deploy-eval.ts)
**Schedule:** Every 6 hours

**What it does:**
1. Read development_queue WHERE status = "deployed" AND deployed_at < now() - interval '2 hours'
   (Wait 2 hours after deploy to let Vercel finish and caches warm)
2. For each deployed item:
   a. Run the relevant eval agent manually:
      - If the change was search-related: run search-quality
      - If map-related: run map-quality
      - If connection-related: run connection-quality
      - If design-related: run brand-compliance (when it exists)
      - For all changes: run api-latency
   b. Compare new scores to pre_deploy_scores
   c. If scores IMPROVED or stayed the same: mark as "completed"
   d. If scores DROPPED by more than 5 points on any metric:
      - AUTO-REVERT: git revert the merge commit, push to main
      - Mark as "reverted" with score_delta
      - Log to deploy_log
      - Mark the source ticket/feature as "idea" again (back to the pool)

3. For items with status = "testing" (medium complexity PRs):
   - If they've been in testing for >24 hours with no score issues, auto-merge
   - If scores are concerning, close the PR

### Agent: Auto-Fix (existing, updated)
**Remove the standalone auto-fix agent.** Its functionality is now absorbed into the Builder agent. The Planner agent feeds tickets into the development_queue, and the Builder executes them. Same safety rails, but now part of the unified pipeline.

## Updated Cron Schedule

```typescript
// Evaluation (detect problems)
cron.schedule("0 * * * *",    () => import("./agents/api-latency"));      // Hourly
cron.schedule("0 5 * * *",    () => import("./agents/cache-health"));     // Daily 5AM
cron.schedule("0 6 * * *",    () => import("./agents/search-quality"));   // Daily 6AM
cron.schedule("30 6 * * *",   () => import("./agents/map-quality"));      // Daily 6:30AM
cron.schedule("0 7 * * *",    () => import("./agents/connection-quality")); // Daily 7AM
cron.schedule("0 21 * * *",   () => import("./agents/score-dashboard"));  // Daily 9PM

// Research + Planning (decide what to build)
cron.schedule("0 10 * * *",   () => import("./agents/research"));         // Daily 10AM
cron.schedule("0 11 * * *",   () => import("./agents/planner"));          // Daily 11AM

// Building (execute changes)
cron.schedule("0 0,4,8,12,16,20 * * *", () => import("./agents/builder")); // Every 4 hours

// Post-deploy evaluation (verify changes helped)
cron.schedule("0 2,8,14,20 * * *", () => import("./agents/post-deploy-eval")); // Every 6 hours
```

## The Full Daily Cycle

```
5:00 AM  — Cache health check, cleanup expired entries
6:00 AM  — Search quality eval: tests 15 queries, scores results
6:30 AM  — Map quality eval: generates 5 test maps, scores output
7:00 AM  — Connection quality eval: tests lookup algorithms
           → All three write improvement_tickets for any issues found

10:00 AM — Research agent: scrapes competitors, Reddit, G2 reviews
           → Writes feature_ideas to Supabase

11:00 AM — Planner agent: reads tickets + ideas, prioritizes
           → Writes build specs to development_queue

12:00 PM — Builder agent: picks top queued item, implements it
           → Builds, tests, merges to main (trivial/small) or creates PR (medium)
           → Vercel auto-deploys

2:00 PM  — Post-deploy eval: checks if the 12PM deploy improved scores
           → If scores dropped: auto-reverts
           → If scores improved: marks as completed

4:00 PM  — Builder agent: picks next queued item if available
8:00 PM  — Builder agent: another cycle
9:00 PM  — Score dashboard: aggregates all scores, generates trend report

12:00 AM — Builder agent: overnight cycle
2:00 AM  — Post-deploy eval: checks overnight deploys
4:00 AM  — Builder agent: pre-dawn cycle
8:00 AM  — Builder agent + post-deploy eval

→ NEXT DAY: cycle repeats with fresh eval data
```

## Safety Architecture

### What CAN be auto-built and auto-merged:
- CSS/styling changes (colors, fonts, spacing, layout fixes)
- Copy changes (text updates, label changes)
- Claude prompt improvements (when variant testing shows clear wins)
- Cache TTL adjustments
- Error message improvements
- New static pages (placeholders, about pages)
- Filter/sort logic fixes in existing components
- Adding missing null checks or error handling

### What CAN be auto-built but NOT auto-merged (PR only):
- New API route logic
- Database query changes
- New component creation
- Changes to authentication or authorization
- Changes affecting data flow between components

### What CANNOT be auto-built:
- Database schema changes (Prisma migrations)
- Environment variable changes
- Package dependency additions
- Changes to deployment configuration
- Anything requiring new third-party API integrations
- Anything the Planner marks as "large" complexity

### Auto-revert triggers:
- Post-deploy eval shows any metric dropped >5 points
- Build fails on main after merge (shouldn't happen due to pre-merge build check, but just in case)
- API latency agent detects >50% latency increase within 1 hour of deploy
- Any error rate >5% on any route within 1 hour of deploy

## Build Sequence

### Step 1: New Supabase tables
Run the SQL for feature_ideas, development_queue, deploy_log

### Step 2: Research agent
Build agents/research.ts with competitor scraping + Claude analysis

### Step 3: Planner agent
Build agents/planner.ts with prioritization + build spec generation

### Step 4: Builder agent
Build agents/builder.ts with full build/test/merge/PR pipeline
Absorb the existing auto-fix.ts logic

### Step 5: Post-deploy evaluator
Build agents/post-deploy-eval.ts with score comparison + auto-revert

### Step 6: Update cron.ts
Add all new schedules

### Step 7: Update auto-merge logic
The existing auto-fix agent's merge logic moves into the builder
Add post-merge build verification
Add auto-revert capability

### Step 8: Test the full loop manually
- Manually insert a test ticket
- Run planner → verify it creates a queue item
- Run builder → verify it creates a branch and merges
- Run post-deploy-eval → verify it checks scores

## Cost Estimates

Per day:
- Research agent: ~3-5 Claude API calls (scrape analysis) = ~$0.15
- Planner agent: 1 Claude call = ~$0.05
- Builder agent: 1-3 Claude calls per build (generate fix + potentially retry) = ~$0.15-0.45
- Post-deploy eval: reuses existing eval agents = already budgeted
- Total: ~$0.50-1.00/day = ~$15-30/month

This is the cost of a junior developer working 24/7 on product improvement. Worth it.

## Important Notes

### The Planner is the Brain
The quality of the entire system depends on the Planner's build specs. If the spec is vague, the Builder will produce bad code. If the spec is too ambitious, the Builder will exceed line limits. The Planner prompt needs to be tuned carefully to produce specific, actionable, minimal specs.

### Start Conservative
Begin with only trivial and small complexity items auto-merging. Watch the system for 2 weeks. If it's making good changes consistently, enable medium complexity auto-merging. Never enable large.

### The Research Agent is Optional
If you don't want competitor scraping, skip the research agent. The system still works: eval agents create tickets → planner prioritizes → builder implements. The research agent just adds proactive feature development on top of reactive bug fixing.

### Monitor the development_queue
Check this table daily for the first week. See what the Planner is queueing and what the Builder is producing. Adjust the Planner's prompt if it's making bad prioritization decisions.

### Revert is Sacred
The auto-revert mechanism is the most important safety feature. If it ever fails to revert a bad deploy, fix the revert mechanism before anything else. A self-improving system that can't undo its mistakes is dangerous.
