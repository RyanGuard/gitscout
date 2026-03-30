# CLAUDE.md — Scout

## What is this?
Scout is a recruiting intelligence platform. Three core features:
1. Developer search — GitHub-powered, scores developers on code quality
2. Market map — maps the talent landscape for any role using Apollo + Claude
3. Outreach Studio — AI-powered personalized outreach writing

## Tech Stack
- Frontend: Next.js (App Router), React, Tailwind
- Backend: Next.js API routes, Prisma ORM
- Database: Supabase (PostgreSQL)
- AI: Anthropic Claude API (claude-sonnet-4-20250514, max_tokens 4000, JSON output)
- Data: Apollo.io API, GitHub API
- Deployment: Vercel (auto-deploys from main)

## Project Structure
- src/app/ — Next.js pages and API routes
- src/components/ — React components
- src/lib/ — Shared libraries (scoring, connections, Apollo, etc.)
- prisma/ — Database schema
- docs/ — All documentation and specs (see docs/README.md for index)
- COMMAND_CENTER.md — Master reference for all projects and environments

## Key Conventions
- Always check enrichment_cache before external API calls
- Apollo People Search is free; enrichment costs credits
- Never reveal emails/phones without explicit user action
- Tier overrides are sacred — recruiter's manual assignments override AI
- Candidate pipeline status is recruiter-controlled
- Progressive loading — show results as they arrive
- Optimistic UI — update immediately, persist in background
- Rate limit Apollo: max 3-5 concurrent, exponential backoff on 429s

## Related Projects
- gitscout-agent (~/gitscout-agent) — Electron desktop app for LinkedIn automation
- scout-eval (VPS /opt/scout-eval) — Autonomous eval + self-improving system

## Docs
See docs/README.md for a full index of all specs and documentation.

## Environment Variables
```
APOLLO_API_KEY=
ANTHROPIC_API_KEY=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

<!-- VERCEL BEST PRACTICES START -->
## Best practices for developing on Vercel

These defaults are optimized for AI coding agents (and humans) working on apps that deploy to Vercel.

- Treat Vercel Functions as stateless + ephemeral (no durable RAM/FS, no background daemons), use Blob or marketplace integrations for preserving state
- Edge Functions (standalone) are deprecated; prefer Vercel Functions
- Don't start new projects on Vercel KV/Postgres (both discontinued); use Marketplace Redis/Postgres instead
- Store secrets in Vercel Env Variables; not in git or `NEXT_PUBLIC_*`
- Provision Marketplace native integrations with `vercel integration add` (CI/agent-friendly)
- Sync env + project settings with `vercel env pull` / `vercel pull` when you need local/offline parity
- Use `waitUntil` for post-response work; avoid the deprecated Function `context` parameter
- Set Function regions near your primary data source; avoid cross-region DB/service roundtrips
- Tune Fluid Compute knobs (e.g., `maxDuration`, memory/CPU) for long I/O-heavy calls (LLMs, APIs)
- Use Runtime Cache for fast **regional** caching + tag invalidation (don't treat it as global KV)
- Use Cron Jobs for schedules; cron runs in UTC and triggers your production URL via HTTP GET
- Use Vercel Blob for uploads/media; Use Edge Config for small, globally-read config
- If Enable Deployment Protection is enabled, use a bypass secret to directly access them
- Add OpenTelemetry via `@vercel/otel` on Node; don't expect OTEL support on the Edge runtime
- Enable Web Analytics + Speed Insights early
- Use AI Gateway for model routing, set AI_GATEWAY_API_KEY, using a model string (e.g. 'anthropic/claude-sonnet-4.6'), Gateway is already default in AI SDK
  needed. Always curl https://ai-gateway.vercel.sh/v1/models first; never trust model IDs from memory
- For durable agent loops or untrusted code: use Workflow (pause/resume/state) + Sandbox; use Vercel MCP for secure infra access
<!-- VERCEL BEST PRACTICES END -->
