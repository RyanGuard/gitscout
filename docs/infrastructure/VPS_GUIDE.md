# VPS Guide — Hetzner Server

## Quick Access
Server: 89.167.106.102
SSH: `ssh root@89.167.106.102`
Password: Reset via Hetzner Console → Rescue tab → Reset Root Password
Non-root user: scout (run `su - scout` after SSH)

## What's Running
The eval system runs 24/7 via PM2 under the scout user.

### Common Commands
```bash
su - scout                                    # switch to scout user
cd /opt/scout-eval                            # go to eval project
npx pm2 list                                  # see running processes
npx pm2 logs scout-eval --lines 30 --nostream # recent logs
npx pm2 restart scout-eval                    # restart after changes
npx pm2 stop scout-eval                       # stop everything
npx pm2 start ecosystem.config.js             # start from scratch
```

### Test Agents Manually
```bash
cd /opt/scout-eval
npx ts-node agents/search-quality.ts
npx ts-node agents/api-latency.ts
npx ts-node agents/map-quality.ts
npx ts-node agents/planner.ts
npx ts-node agents/builder.ts
```

### Check Database Results
```bash
cd /opt/scout-eval && node -e "
require('dotenv').config();
const {createClient}=require('@supabase/supabase-js');
const s=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY);
(async()=>{
  var r=await s.from('eval_runs').select('agent_name,status,overall_score,created_at').order('created_at',{ascending:false}).limit(10);
  console.log('RUNS:');(r.data||[]).forEach(function(x){console.log(x.agent_name,x.status,x.overall_score,x.created_at)});
  var t=await s.from('improvement_tickets').select('severity,title,status').order('created_at',{ascending:false}).limit(5);
  console.log('TICKETS:');(t.data||[]).forEach(function(x){console.log(x.severity,x.status,x.title)});
})();"
```

### Schedule

| Time (UTC) | Agent | What it does |
|---|---|---|
| Every hour | api-latency | Monitors 5 API routes |
| 05:00 | cache-health | DISABLED (no cache table) |
| 06:00 | search-quality | Scores 15 queries, 4 quality metrics |
| 06:30 | map-quality | Generates 5 maps, 6 quality metrics |
| 07:00 | connection-quality | Tests 3 lookups, 4 quality metrics |
| 10:00 | research | Scrapes competitors + community |
| 11:00 | planner | Prioritizes tickets, writes build specs |
| 0/4/8/12/16/20 | builder | Implements top queued item |
| 2/8/14/20 | post-deploy-eval | Verifies changes helped |
| 21:00 | score-dashboard | Trend analysis + summary |

### File Layout
```
/opt/scout-eval/
├── agents/           — All eval + autonomous agents
├── lib/              — Shared libraries (supabase, claude, tickets)
├── migrations/       — SQL migrations (run manually in Supabase)
├── cron.ts           — Cron schedule
├── ecosystem.config.js — PM2 config
└── .env              — Credentials (never commit)

/home/scout/gitscout-autofix/ — Repo clone used by builder agent
```

### Troubleshooting
- **Agents running but no data in Supabase?** Check RLS is disabled on eval tables.
- **Builder failing with JSON error?** Check agents/builder.ts has extractJSON fallback.
- **PM2 not running after reboot?** Run: `npx pm2 start ecosystem.config.js && npx pm2 save`
- **Can't SSH?** Reset password in Hetzner Console → Rescue tab.
- **PM2 command not found?** Use `npx pm2` (not just `pm2`).

### Running Claude Code on VPS
```bash
ssh root@89.167.106.102
su - scout
cd /opt/scout-eval
claude --dangerously-skip-permissions
```
