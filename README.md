# CoreNews

CoreNews is a snapshot-first news dashboard for daily hotspots across categories.

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
- Auth header: `x-cron-secret: <CRON_SECRET>`
- Vercel schedule (UTC): `0 0 * * *` (daily)

Pipeline health:

- `GET /api/health/pipeline`

## Development Seed

For local smoke tests only:

- `GET /api/dev/seed`

This primes in-memory demo data for homepage/category/detail navigation.

## Tests

```bash
npm run lint
npm run test
npm run build
npx playwright test e2e/daily-smoke.spec.ts
```

## Supabase Schema

- Migration: `supabase/migrations/2026030201_core_news_schema.sql`
- Seed: `supabase/seed.sql`
