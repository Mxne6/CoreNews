# CoreNews

CoreNews is a snapshot-first news dashboard for daily hotspots across multiple primary categories.

## Stack

- Next.js (App Router, TypeScript)
- Supabase Postgres (schema and seed SQL included)
- DashScope client wrapper for ambiguity resolution
- Vercel Cron (once daily)
- Vitest + Playwright

## Quick Start

```bash
npm install
cp .env.example .env.local
npm run dev
```

## Environment Variables

Set these values in `.env.local` and Vercel project settings:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `DASHSCOPE_API_KEY`
- `CRON_SECRET`

## Daily Pipeline

- Cron endpoint: `GET /api/cron/daily`
- Vercel Cron auth: `Authorization: Bearer <CRON_SECRET>`
- Manual trigger auth (fallback): `x-cron-secret: <CRON_SECRET>`
- Vercel schedule (UTC): `0 0 * * *` (daily)

Pipeline health:

- `GET /api/health/pipeline`

## Development Seed

For local smoke tests only:

- `GET /api/dev/seed`

This primes in-memory demo data for homepage/category/detail navigation.

Category pages use unified routes:

- `/category/[slug]` (for example: `/category/ai`, `/category/world`)

## Tests

```bash
npm run lint
npm run test
npm run build
npx playwright test e2e/daily-smoke.spec.ts
```

## Supabase Schema

- Migration: `supabase/migrations/2026030201_core_news_schema.sql`
- Migration: `supabase/migrations/2026030202_pipeline_stability.sql`
- Seed: `supabase/seed.sql`

## Supabase Bootstrap + Health

Use this helper script to check schema readiness, upsert source seeds, optionally trigger daily cron once, and print latest pipeline status:

```bash
npm run ops:supabase
```

Optional first-run trigger:

```bash
npm run ops:supabase -- --trigger-url=https://<your-vercel-domain>/api/cron/daily
```
