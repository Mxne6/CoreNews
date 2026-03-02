# CoreNews Data Closure Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace in-memory demo flow with real Supabase-backed RSS ingestion, event aggregation, snapshot publishing, and stable read APIs.

**Architecture:** Keep Next.js API as orchestrator. Daily cron runs pipeline steps (RSS fetch -> dedupe -> cluster -> score -> summary fallback -> snapshots) and persists everything to Supabase. Read APIs always resolve snapshot data from the latest successful run only.

**Tech Stack:** Next.js (TypeScript), Supabase Postgres, rss-parser, Vitest, Playwright.

---

### Task 1: Add Runtime Env and Supabase Admin Client

**Files:**
- Create: `src/lib/config/env.ts`
- Create: `src/lib/db/supabase-admin.ts`
- Test: `src/lib/config/env.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { getEnv } from "@/lib/config/env";

describe("getEnv", () => {
  it("throws when required env is missing", () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    expect(() => getEnv()).toThrow(/SUPABASE_SERVICE_ROLE_KEY/);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- src/lib/config/env.test.ts`
Expected: FAIL with missing module/function.

**Step 3: Write minimal implementation**

Implement `getEnv()` with required keys:
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CRON_SECRET`

Add `getSupabaseAdminClient()` using service-role key.

**Step 4: Run test to verify it passes**

Run: `npm run test -- src/lib/config/env.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/lib/config/env.ts src/lib/config/env.test.ts src/lib/db/supabase-admin.ts
git commit -m "feat(config): add env validation and supabase admin client"
```

### Task 2: Add Schema V2 for Stable Pipeline Guarantees

**Files:**
- Create: `supabase/migrations/2026030202_pipeline_stability.sql`
- Modify: `tests/sql/schema.test.ts`

**Step 1: Write failing schema tests**

Add assertions for:
- `sources.rss_url` unique
- `articles` unique on `(source_id, dedupe_key)`
- `pipeline_runs.source_errors_json` exists
- partial unique index for one running run only
- `snapshots.key`, `snapshots.payload_json`, `snapshots.version` exist

**Step 2: Run test to verify it fails**

Run: `npm run test -- tests/sql/schema.test.ts`
Expected: FAIL on missing columns/indexes.

**Step 3: Write minimal migration**

Migration must include:
- `alter table articles add column dedupe_key text;`
- `create unique index uq_articles_source_dedupe_key on articles(source_id, dedupe_key);`
- `alter table pipeline_runs add column source_errors_json jsonb not null default '[]'::jsonb;`
- `create unique index uq_pipeline_runs_single_running on pipeline_runs(status) where status='running';`
- snapshot key/value shape:
  - add `key text not null`
  - add `payload_json jsonb not null default '{}'::jsonb`
  - add `version text not null default 'v1'`
  - add unique `(run_id, key)`

**Step 4: Run test to verify it passes**

Run: `npm run test -- tests/sql/schema.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add supabase/migrations/2026030202_pipeline_stability.sql tests/sql/schema.test.ts
git commit -m "feat(db): add stability constraints and snapshot key schema"
```

### Task 3: Implement Supabase Pipeline Run Repository

**Files:**
- Create: `src/lib/pipeline/repository.ts`
- Test: `src/lib/pipeline/repository.test.ts`

**Step 1: Write failing tests**

Cover:
- create run with `status=running`
- fail to create second running run (partial unique index behavior)
- finalize run with `source_errors_json`

**Step 2: Run test to verify it fails**

Run: `npm run test -- src/lib/pipeline/repository.test.ts`
Expected: FAIL with missing repository.

**Step 3: Write minimal implementation**

Implement repository functions:
- `startPipelineRun(trigger)`
- `finishPipelineRunSuccess(runId, metrics, sourceErrors)`
- `finishPipelineRunFailure(runId, error, sourceErrors)`

Use Supabase `.insert/.update` and return typed payload.

**Step 4: Run test to verify it passes**

Run: `npm run test -- src/lib/pipeline/repository.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/lib/pipeline/repository.ts src/lib/pipeline/repository.test.ts
git commit -m "feat(pipeline): add supabase pipeline run repository"
```

### Task 4: Persist RSS Articles with Source-Scoped Dedupe

**Files:**
- Create: `src/lib/rss/fetch-rss.ts`
- Create: `src/lib/pipeline/article-ingest.ts`
- Test: `src/lib/pipeline/article-ingest.test.ts`

**Step 1: Write failing tests**

Cover:
- dedupe key priority: `guid || canonical_link || hash(...)`
- same dedupe key allowed for different sources
- same source + dedupe key rejected/upserted
- `published_at` nullable with `published_at_fallback` used

**Step 2: Run test to verify it fails**

Run: `npm run test -- src/lib/pipeline/article-ingest.test.ts`
Expected: FAIL.

**Step 3: Write minimal implementation**

Implement ingestion:
- fetch active sources
- parse feed items
- normalize + compute dedupe key
- upsert into `articles`

**Step 4: Run test to verify it passes**

Run: `npm run test -- src/lib/pipeline/article-ingest.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/lib/rss/fetch-rss.ts src/lib/pipeline/article-ingest.ts src/lib/pipeline/article-ingest.test.ts
git commit -m "feat(rss): ingest rss articles with source-scoped dedupe keys"
```

### Task 5: Build Non-Destructive Event Aggregation

**Files:**
- Create: `src/lib/pipeline/event-aggregate.ts`
- Modify: `src/lib/pipeline/run-daily.ts`
- Test: `src/lib/pipeline/event-aggregate.test.ts`

**Step 1: Write failing tests**

Cover:
- process only recent 3-day window
- `event_articles` uses insert/upsert only (no delete)
- existing `events.id` remains stable for old events
- summary rows versioned by `(event_id, model_name, model_version)`

**Step 2: Run test to verify it fails**

Run: `npm run test -- src/lib/pipeline/event-aggregate.test.ts src/lib/pipeline/run-daily.test.ts`
Expected: FAIL.

**Step 3: Write minimal implementation**

Implement:
- derive/resolve event stable key
- upsert `events`
- upsert `event_articles` incrementally
- insert summary rows with version tuple

**Step 4: Run test to verify it passes**

Run: `npm run test -- src/lib/pipeline/event-aggregate.test.ts src/lib/pipeline/run-daily.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/lib/pipeline/event-aggregate.ts src/lib/pipeline/run-daily.ts src/lib/pipeline/event-aggregate.test.ts src/lib/pipeline/run-daily.test.ts
git commit -m "feat(events): add non-destructive rolling aggregation with versioned summaries"
```

### Task 6: Snapshot Writer by Key and Success-Run Reader Contract

**Files:**
- Modify: `src/lib/pipeline/snapshot-builder.ts`
- Modify: `src/app/api/home/route.ts`
- Modify: `src/app/api/category/[slug]/route.ts`
- Modify: `src/app/api/news/[eventId]/route.ts`
- Test: `src/app/api/home/route.test.ts`
- Test: `src/app/api/category/[slug]/route.test.ts`

**Step 1: Write failing tests**

Cover:
- snapshots written as keys: `home`, `category:<slug>`
- API readers resolve latest successful `run_id` first
- category API paginates by slicing full list payload

**Step 2: Run test to verify it fails**

Run: `npm run test -- src/app/api/home/route.test.ts src/app/api/category/[slug]/route.test.ts`
Expected: FAIL.

**Step 3: Write minimal implementation**

Implement snapshot writes:
- include `run_id`, `key`, `payload_json`, `version`

Implement read rule:
1. fetch latest `pipeline_runs` where `status='success'`
2. read snapshots for that run only

**Step 4: Run test to verify it passes**

Run: `npm run test -- src/app/api/home/route.test.ts src/app/api/category/[slug]/route.test.ts src/app/api/news/[eventId]/route.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/lib/pipeline/snapshot-builder.ts src/app/api/home/route.ts src/app/api/category/[slug]/route.ts src/app/api/news/[eventId]/route.ts src/app/api/home/route.test.ts src/app/api/category/[slug]/route.test.ts src/app/api/news/[eventId]/route.test.ts
git commit -m "feat(snapshot): read and write keyed snapshots by latest successful run"
```

### Task 7: Health API with Stale/Degraded Signals

**Files:**
- Modify: `src/app/api/health/pipeline/route.ts`
- Test: `src/app/api/health/pipeline/route.test.ts`

**Step 1: Write failing tests**

Cover:
- `degraded=true` when latest run failed
- `stale=true` when last success older than 36h
- include `latest_success_at` and `latest_run_status`

**Step 2: Run test to verify it fails**

Run: `npm run test -- src/app/api/health/pipeline/route.test.ts`
Expected: FAIL.

**Step 3: Write minimal implementation**

Compute:
- `latestRun`
- `latestSuccess`
- `degraded = latestRun.status === 'failed'`
- `stale = now - latestSuccess > 36h`

**Step 4: Run test to verify it passes**

Run: `npm run test -- src/app/api/health/pipeline/route.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/app/api/health/pipeline/route.ts src/app/api/health/pipeline/route.test.ts
git commit -m "feat(health): add stale and degraded pipeline status flags"
```

### Task 8: Wire Cron Route to Real Pipeline and Add Safe Secrets

**Files:**
- Modify: `src/app/api/cron/daily/route.ts`
- Modify: `.env.example`
- Create: `.env.local` (local only, not committed)
- Modify: `README.md`

**Step 1: Write failing cron integration tests**

Cover:
- unauthorized still returns 401
- successful request starts/finishes run in Supabase path
- failures store `source_errors_json` and do not publish failed snapshots

**Step 2: Run test to verify it fails**

Run: `npm run test -- src/app/api/cron/daily/route.test.ts src/lib/pipeline/run-daily.test.ts`
Expected: FAIL.

**Step 3: Write minimal implementation**

Integrate cron route with real pipeline service and `trigger='vercel-cron'`.
Write local `.env.local` using provided Supabase values (do not commit).

**Step 4: Run tests and smoke checks**

Run:
- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run build`
- `npx playwright test e2e/daily-smoke.spec.ts`

Expected: all pass.

**Step 5: Commit**

```bash
git add src/app/api/cron/daily/route.ts .env.example README.md
git commit -m "feat(cron): wire real supabase pipeline with safe env contract"
```

## Completion Checklist

- [ ] Single-running guarantee enforced by DB partial unique index.
- [ ] `pipeline_runs.source_errors_json` records per-source failures.
- [ ] Snapshot read APIs only read snapshots from latest successful run.
- [ ] Health API reports `stale` and `degraded`.
- [ ] RSS ingestion persists deduped articles with `(source_id, dedupe_key)`.
- [ ] Event/article mapping is incremental and non-destructive.
