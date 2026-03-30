# Copy this file to /opt/scout-eval/CLAUDE.md on the VPS

# CLAUDE.md — Scout Eval System

## What is this?

The Scout autonomous eval and self-improving system. It runs 24/7 on a Hetzner VPS and does three things:

1. **Evaluate** — Agents test the live Scout app (search quality, map quality, API latency, connection quality) and write improvement tickets to Supabase when they find problems.
2. **Plan** — A planner agent reads tickets and feature ideas, prioritizes them, and writes build specs to a development queue.
3. **Build** — A builder agent picks items off the queue, implements fixes using Claude API, runs the build, and auto-merges small/trivial changes to main (which triggers Vercel auto-deploy).
4. **Verify** — A post-deploy eval agent checks whether deployed changes improved or hurt scores. If scores drop, it auto-reverts.

## Tech Stack

- Node.js + TypeScript
- node-cron (scheduling)
- PM2 (process manager)
- Supabase (reads/writes eval data)
- Anthropic Claude API (analysis + code generation)
- GitHub API (builder creates branches, merges PRs)

## Project Structure

```
/opt/scout-eval/
├── agents/
│   ├── api-latency.ts         — Monitors 5 API routes hourly
│   ├── cache-health.ts        — Cache table health (currently DISABLED)
│   ├── search-quality.ts      — Runs 15 search queries, scores on 4 metrics
│   ├── map-quality.ts         — Generates 5 test maps, scores on 6 metrics
│   ├── connection-quality.ts  — Tests 3 connection lookups, 4 metrics
│   ├── score-dashboard.ts     — Daily trend analysis + summary
│   ├── research.ts            — Scrapes competitors, Reddit, G2 reviews
│   ├── planner.ts             — Prioritizes tickets, writes build specs
│   ├── builder.ts             — Implements changes via Claude API
│   └── post-deploy-eval.ts    — Verifies deploys improved scores
├── lib/
│   ├── supabase.ts            — Supabase client
│   ├── claude.ts              — Claude API client
│   └── tickets.ts             — Ticket creation helpers
├── migrations/                — SQL migrations (run in Supabase SQL Editor)
├── cron.ts                    — Cron schedule for all agents
├── ecosystem.config.js        — PM2 process config
└── .env                       — All credentials (never commit)
```

Builder agent uses a separate repo clone at `/home/scout/gitscout-autofix/` for git operations.

## Agents

### Eval Agents (detect problems)

**api-latency** — Runs every hour. Hits 5 API endpoints on the live Scout app, measures response time. Creates tickets if latency exceeds thresholds or errors occur.

**search-quality** — Runs daily at 06:00 UTC. Executes 15 predefined search queries against the live app. Scores results on 4 metrics: result count, relevance, score distribution, response time. Creates tickets for any metric below threshold.

**map-quality** — Runs daily at 06:30 UTC. Generates 5 test market maps with known role briefs. Scores on 6 metrics: company count, tier distribution, candidate count, fit score quality, enrichment completion rate, response time.

**connection-quality** — Runs daily at 07:00 UTC. Runs 3 connection lookups for known company pairs. Scores on 4 metrics: connection count, connection type diversity, path quality, response time.

**score-dashboard** — Runs daily at 21:00 UTC. Aggregates all scores from the day, computes trends, generates a summary. Writes to eval_scores_history.

### Autonomous Agents (decide + build)

**research** — Runs daily at 10:00 UTC. Scrapes competitor blogs/changelogs (SeekOut, Gem, Loxo, etc.), Reddit recruiting threads, and G2 reviews. Feeds findings to Claude for analysis. Writes feature_ideas to Supabase.

**planner** — Runs daily at 11:00 UTC. Reads all open improvement_tickets and feature_ideas. Uses Claude to prioritize by impact/effort ratio. Writes build specs to development_queue. Never queues more than 5 items. Never queues "large" complexity items.

**builder** — Runs every 4 hours (0/4/8/12/16/20 UTC). Picks top queued item, reads the build spec, sends to Claude API to generate code changes. Applies changes, runs `npm run build`. If build passes and diff is within line limits, pushes and merges (trivial/small) or creates a PR (medium).

**post-deploy-eval** — Runs every 6 hours (2/8/14/20 UTC). Checks recently deployed items. Runs the relevant eval agent to get fresh scores. Compares to pre-deploy scores. If any metric dropped >5 points, auto-reverts the merge commit.

## Cron Schedule

| Time (UTC) | Agent | What it does |
|---|---|---|
| Every hour | api-latency | Monitors 5 API routes |
| 05:00 | cache-health | DISABLED (no cache table yet) |
| 06:00 | search-quality | Scores 15 queries, 4 quality metrics |
| 06:30 | map-quality | Generates 5 maps, 6 quality metrics |
| 07:00 | connection-quality | Tests 3 lookups, 4 quality metrics |
| 10:00 | research | Scrapes competitors + community |
| 11:00 | planner | Prioritizes tickets, writes build specs |
| 0/4/8/12/16/20 | builder | Implements top queued item |
| 2/8/14/20 | post-deploy-eval | Verifies changes helped |
| 21:00 | score-dashboard | Trend analysis + summary |

## Quality Metrics Tracked

### Search Quality (4 metrics)
- Result count per query (threshold: >0 for all 15 queries)
- Relevance score (do results match the search intent?)
- Score distribution (are scores differentiated, not all 50?)
- Response time (threshold: <3s)

### Map Quality (6 metrics)
- Company count per map (threshold: 10-25)
- Tier distribution (roughly balanced A/B/C)
- Candidate count per company (threshold: >0)
- Fit score quality (scores differentiated, reasoning present)
- Enrichment completion rate (threshold: >80%)
- Response time (threshold: <30s for full map)

### API Latency (per route)
- Response time (threshold: <2s for most routes, <5s for generate)
- Error rate (threshold: <5%)

### Connection Quality (4 metrics)
- Connection count per lookup
- Connection type diversity (employment, education, OSS, etc.)
- Path quality score
- Response time

## Supabase Tables

- **eval_runs** — Every agent execution: agent_name, status, overall_score, metrics (jsonb), created_at
- **improvement_tickets** — Issues found: severity (critical/high/medium/low), title, description, category, status
- **eval_scores_history** — Daily metric snapshots for trend analysis
- **feature_ideas** — Research findings: source, title, impact_score, effort_estimate, status
- **development_queue** — Build queue: priority, title, build_spec, complexity, status, branch_name, pre/post deploy scores
- **deploy_log** — Deployment audit trail: action (merge/deploy/evaluate/revert), details

## Key Rules

1. **Builder NEVER touches API routes** unless the build spec explicitly says to. API changes require a PR, not auto-merge.
2. **Builder NEVER modifies schema.prisma** or migrations. Database changes are manual only.
3. **Builder NEVER adds dependencies.** No new packages.
4. **Max diff size by complexity:** trivial <10 lines, small <50 lines, medium <200 lines. Over limit = auto-fail.
5. **"Large" complexity items are NEVER queued.** Those need human planning.
6. **Auto-revert on score drop >5 points** on any metric after deploy.
7. **Planner never queues more than 5 items** at once.
8. **All Claude API calls use claude-sonnet-4-20250514**, max_tokens 4000, JSON output.
9. **Always use `npx pm2`** (not bare `pm2`), and `npx ts-node` (not bare `ts-node`).
10. **RLS must be disabled** on all eval tables. The eval system uses the service role key.

## Environment Variables

```
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
ANTHROPIC_API_KEY=
GITHUB_TOKEN=               # For builder: create branches, merge PRs
GITSCOUT_REPO_PATH=/home/scout/gitscout-autofix
GITSCOUT_BASE_URL=https://gitscout-beta.vercel.app
```

## How to Add a New Agent

1. Create `agents/your-agent.ts`
2. Export a default async function that:
   - Does its work (API calls, Claude analysis, etc.)
   - Writes results to `eval_runs` via `lib/supabase.ts`
   - Creates `improvement_tickets` if issues found
3. Add the schedule to `cron.ts`:
   ```typescript
   cron.schedule("0 8 * * *", () => import("./agents/your-agent"));
   ```
4. Test manually: `npx ts-node agents/your-agent.ts`
5. Restart PM2: `npx pm2 restart scout-eval`

## Common Commands

```bash
# SSH in
ssh root@89.167.106.102
su - scout
cd /opt/scout-eval

# Process management
npx pm2 list                              # see running processes
npx pm2 logs scout-eval --lines 30        # recent logs (--nostream for snapshot)
npx pm2 restart scout-eval                # restart after code changes
npx pm2 stop scout-eval                   # stop
npx pm2 start ecosystem.config.js         # start from config

# Test an agent
npx ts-node agents/search-quality.ts

# Check database
node -e "
require('dotenv').config();
const {createClient}=require('@supabase/supabase-js');
const s=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY);
(async()=>{
  var r=await s.from('eval_runs').select('agent_name,status,overall_score,created_at').order('created_at',{ascending:false}).limit(10);
  console.log('RUNS:');(r.data||[]).forEach(function(x){console.log(x.agent_name,x.status,x.overall_score,x.created_at)});
  var t=await s.from('improvement_tickets').select('severity,title,status').order('created_at',{ascending:false}).limit(5);
  console.log('TICKETS:');(t.data||[]).forEach(function(x){console.log(x.severity,x.status,x.title)});
})();"

# Deploy changes to eval system
# (edit files directly on VPS, then restart PM2)
npx pm2 restart scout-eval
```
