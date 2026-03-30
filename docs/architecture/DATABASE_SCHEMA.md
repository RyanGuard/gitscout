# Database Schema

All tables live in a single Supabase PostgreSQL instance (project: GITSCOUT).

## GitScout App Tables (Prisma-managed)

Schema managed via `prisma/schema.prisma` in the gitscout repo. Run `npx prisma db push` to sync.

- **User/auth tables** — NextAuth.js managed (User, Account, Session)
- **Developer profiles** — GitHub developer data, scores, enrichment
- **Market maps** — market_maps, map_companies, map_candidates
- **Connections** — connection_home_bases, connection_people, connection_repos, connection_lookups, connections
- **Lists** — saved_lists, list_items (candidate collections)
- **Outreach** — outreach_sequences, outreach_messages, outreach_templates
- **Cache** — enrichment_cache (Apollo data with TTLs)

## Eval System Tables (SQL-managed)

Schema managed via SQL migrations in `/opt/scout-eval/migrations/`. Run manually in Supabase SQL Editor.

- **eval_runs** — agent execution results (agent_name, status, overall_score)
- **improvement_tickets** — detected issues (severity, title, status)
- **eval_scores_history** — metric trends over time
- **feature_ideas** — research findings from competitor/community scraping
- **development_queue** — build queue for the autonomous builder
- **deploy_log** — deployment history
- **eval_test_cases** — dynamic QA tests

## LinkedIn Agent Tables (SQL-managed)

Schema managed via `supabase/migration.sql` in the gitscout-agent repo.

- **linkedin_action_queue** — pending LinkedIn actions
- **linkedin_sessions** — per-user session state
- **linkedin_profile_data** — scraped profiles

## Key Rules

- **RLS:** Disabled on eval tables (eval system uses service role key)
- **Prisma tables:** Never edit directly in SQL Editor — use Prisma migrations
- **Eval tables:** Run migrations manually in Supabase SQL Editor
- **Service role key:** VPS only. Never expose client-side.
- **Anon key:** Used by web app and Electron agent (client-side safe)
