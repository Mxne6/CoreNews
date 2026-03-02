# CoreNews Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a deployable daily hotspot news site using Next.js + Supabase + DashScope, with snapshot-first reads and one daily Vercel cron run.

**Architecture:** Use a batch pipeline that ingests RSS, deduplicates and clusters with rule-first logic, applies LLM only to ambiguous merges and summary generation, computes deterministic hotspot scores, and persists read snapshots for homepage/category rendering.

**Tech Stack:** Next.js (App Router, TypeScript), Tailwind CSS, Supabase Postgres, DashScope API, Vitest, Playwright, Zod.

---

Skills to apply during execution:
- `@superpowers/test-driven-development`
- `@superpowers/verification-before-completion`
- `@superpowers/requesting-code-review`

### Task 1: Bootstrap Project and Tooling

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `next.config.ts`
- Create: `tailwind.config.ts`
- Create: `postcss.config.mjs`
- Create: `vitest.config.ts`
- Create: `playwright.config.ts`
- Create: `src/app/layout.tsx`
- Create: `src/app/page.tsx`

**Step 1: Initialize Next.js app shell**

Run:
```bash
npx create-next-app@latest . --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm
```
Expected: project scaffold created.

**Step 2: Install runtime and test dependencies**

Run:
```bash
npm install @supabase/supabase-js zod rss-parser
npm install -D vitest @vitest/coverage-v8 @testing-library/react @testing-library/jest-dom @playwright/test
```
Expected: install completes without audit blockers.

**Step 3: Verify baseline commands**

Run:
```bash
npm run lint
npm run build
```
Expected: lint and build succeed.

**Step 4: Commit**

```bash
git add .
git commit -m "chore: bootstrap nextjs app with testing stack"
```

### Task 2: Add Database Schema and Migrations

**Files:**
- Create: `supabase/migrations/2026030201_core_news_schema.sql`
- Create: `supabase/seed.sql`
- Test: `tests/sql/schema.test.sql`

**Step 1: Write failing schema validation test**

Create `tests/sql/schema.test.sql` assertions for:
- missing unique on `articles.url`
- missing index on `articles.published_at`
- missing index on `events.window_start`

Run:
```bash
supabase test db
```
Expected: FAIL due missing tables/constraints.

**Step 2: Write minimal migration**

Implement tables:
- `sources`, `articles`, `events`, `event_articles`, `summaries`, `snapshots`, `pipeline_runs`

Add constraints and indexes required by design.

**Step 3: Re-run test**

Run:
```bash
supabase db reset
supabase test db
```
Expected: PASS with all assertions green.

**Step 4: Commit**

```bash
git add supabase/migrations/2026030201_core_news_schema.sql tests/sql/schema.test.sql supabase/seed.sql
git commit -m "feat(db): add core news schema with constraints and indexes"
```

### Task 3: Implement Normalization and Dedup Logic

**Files:**
- Create: `src/lib/pipeline/normalize.ts`
- Create: `src/lib/pipeline/dedupe.ts`
- Test: `src/lib/pipeline/normalize.test.ts`
- Test: `src/lib/pipeline/dedupe.test.ts`

**Step 1: Write failing tests**

Add tests for:
- punctuation/case normalization in `normalized_title`
- stable hash generation
- dedup by `url` and `content_hash`

Run:
```bash
npm run test -- src/lib/pipeline/normalize.test.ts src/lib/pipeline/dedupe.test.ts
```
Expected: FAIL with missing modules/functions.

**Step 2: Write minimal implementation**

Implement:
- title normalization util
- deterministic hash function
- dedupe filter helpers

**Step 3: Re-run tests**

Run:
```bash
npm run test -- src/lib/pipeline/normalize.test.ts src/lib/pipeline/dedupe.test.ts
```
Expected: PASS.

**Step 4: Commit**

```bash
git add src/lib/pipeline/normalize.ts src/lib/pipeline/dedupe.ts src/lib/pipeline/normalize.test.ts src/lib/pipeline/dedupe.test.ts
git commit -m "feat(pipeline): add normalization and dedup primitives"
```

### Task 4: Implement Deterministic Hot Score

**Files:**
- Create: `src/lib/pipeline/scoring.ts`
- Test: `src/lib/pipeline/scoring.test.ts`
- Create: `tests/fixtures/scoring-fixture.json`

**Step 1: Write failing tests**

Add tests for:
- deterministic score from identical fixture input
- higher source coverage yields higher score
- recency decay lowers stale events

Run:
```bash
npm run test -- src/lib/pipeline/scoring.test.ts
```
Expected: FAIL due missing scorer.

**Step 2: Write minimal implementation**

Implement `computeHotScore` and versioned score metadata.

**Step 3: Re-run tests**

Run:
```bash
npm run test -- src/lib/pipeline/scoring.test.ts
```
Expected: PASS.

**Step 4: Commit**

```bash
git add src/lib/pipeline/scoring.ts src/lib/pipeline/scoring.test.ts tests/fixtures/scoring-fixture.json
git commit -m "feat(pipeline): add deterministic hotspot scoring"
```

### Task 5: Implement Clusterer and LLM Ambiguity Resolver

**Files:**
- Create: `src/lib/pipeline/cluster.ts`
- Create: `src/lib/llm/dashscope.ts`
- Create: `src/lib/pipeline/resolve-ambiguous.ts`
- Test: `src/lib/pipeline/cluster.test.ts`
- Test: `src/lib/pipeline/resolve-ambiguous.test.ts`

**Step 1: Write failing tests**

Cover:
- rule-based candidate grouping from time+title similarity
- only ambiguous groups are sent to LLM
- timeout, 429, and empty LLM response fallback path

Run:
```bash
npm run test -- src/lib/pipeline/cluster.test.ts src/lib/pipeline/resolve-ambiguous.test.ts
```
Expected: FAIL with missing implementations.

**Step 2: Write minimal implementation**

Implement:
- candidate grouping
- DashScope client wrapper with retries
- fallback behavior for repeated failures

**Step 3: Re-run tests**

Run:
```bash
npm run test -- src/lib/pipeline/cluster.test.ts src/lib/pipeline/resolve-ambiguous.test.ts
```
Expected: PASS.

**Step 4: Commit**

```bash
git add src/lib/pipeline/cluster.ts src/lib/llm/dashscope.ts src/lib/pipeline/resolve-ambiguous.ts src/lib/pipeline/cluster.test.ts src/lib/pipeline/resolve-ambiguous.test.ts
git commit -m "feat(pipeline): add candidate clustering and llm ambiguity resolution"
```

### Task 6: Build Daily Pipeline Runner and Cron Endpoint

**Files:**
- Create: `src/lib/pipeline/run-daily.ts`
- Create: `src/lib/pipeline/snapshot-builder.ts`
- Create: `src/app/api/cron/daily/route.ts`
- Test: `src/lib/pipeline/run-daily.test.ts`
- Test: `src/app/api/cron/daily/route.test.ts`

**Step 1: Write failing tests**

Cover:
- full run updates `pipeline_runs` metrics
- idempotent re-run does not duplicate records
- failed run keeps previous snapshot untouched
- unauthorized cron requests are rejected

Run:
```bash
npm run test -- src/lib/pipeline/run-daily.test.ts src/app/api/cron/daily/route.test.ts
```
Expected: FAIL.

**Step 2: Write minimal implementation**

Implement:
- re-entrancy lock
- ordered execution of pipeline steps
- snapshot persistence
- token-protected cron route

**Step 3: Re-run tests**

Run:
```bash
npm run test -- src/lib/pipeline/run-daily.test.ts src/app/api/cron/daily/route.test.ts
```
Expected: PASS.

**Step 4: Commit**

```bash
git add src/lib/pipeline/run-daily.ts src/lib/pipeline/snapshot-builder.ts src/app/api/cron/daily/route.ts src/lib/pipeline/run-daily.test.ts src/app/api/cron/daily/route.test.ts
git commit -m "feat(cron): add daily pipeline runner and protected cron endpoint"
```

### Task 7: Build Snapshot-Driven Read APIs

**Files:**
- Create: `src/app/api/home/route.ts`
- Create: `src/app/api/category/[slug]/route.ts`
- Create: `src/app/api/news/[eventId]/route.ts`
- Test: `src/app/api/home/route.test.ts`
- Test: `src/app/api/category/[slug]/route.test.ts`
- Test: `src/app/api/news/[eventId]/route.test.ts`

**Step 1: Write failing API contract tests**

Cover:
- homepage shape from `home_payload`
- category pagination from `category_payloads`
- detail API includes title/source/time/summary and 404 for missing event

Run:
```bash
npm run test -- src/app/api/home/route.test.ts src/app/api/category/[slug]/route.test.ts src/app/api/news/[eventId]/route.test.ts
```
Expected: FAIL.

**Step 2: Write minimal implementation**

Implement route handlers with Zod response validation.

**Step 3: Re-run tests**

Run:
```bash
npm run test -- src/app/api/home/route.test.ts src/app/api/category/[slug]/route.test.ts src/app/api/news/[eventId]/route.test.ts
```
Expected: PASS.

**Step 4: Commit**

```bash
git add src/app/api/home/route.ts src/app/api/category/[slug]/route.ts src/app/api/news/[eventId]/route.ts src/app/api/home/route.test.ts src/app/api/category/[slug]/route.test.ts src/app/api/news/[eventId]/route.test.ts
git commit -m "feat(api): add snapshot-driven read endpoints"
```

### Task 8: Build Pages (Home, Category, Detail)

**Files:**
- Create: `src/app/page.tsx`
- Create: `src/app/[category]/page.tsx`
- Create: `src/app/news/[eventId]/page.tsx`
- Create: `src/components/news-card.tsx`
- Create: `src/components/category-section.tsx`
- Test: `src/app/page.test.tsx`
- Test: `src/app/[category]/page.test.tsx`
- Test: `src/app/news/[eventId]/page.test.tsx`

**Step 1: Write failing component/page tests**

Cover:
- homepage renders 3-5 events per category
- category page pagination works
- detail page opens source links in new tab

Run:
```bash
npm run test -- src/app/page.test.tsx src/app/[category]/page.test.tsx src/app/news/[eventId]/page.test.tsx
```
Expected: FAIL.

**Step 2: Write minimal implementation**

Implement pages and reusable cards using snapshot APIs.

**Step 3: Re-run tests**

Run:
```bash
npm run test -- src/app/page.test.tsx src/app/[category]/page.test.tsx src/app/news/[eventId]/page.test.tsx
```
Expected: PASS.

**Step 4: Commit**

```bash
git add src/app/page.tsx src/app/[category]/page.tsx src/app/news/[eventId]/page.tsx src/components/news-card.tsx src/components/category-section.tsx src/app/page.test.tsx src/app/[category]/page.test.tsx src/app/news/[eventId]/page.test.tsx
git commit -m "feat(ui): add homepage category page and news detail page"
```

### Task 9: Add E2E Smoke and Health Endpoint

**Files:**
- Create: `src/app/api/health/pipeline/route.ts`
- Create: `e2e/daily-smoke.spec.ts`
- Modify: `playwright.config.ts`

**Step 1: Write failing e2e test**

Scenario:
- load homepage
- open category page
- open detail page
- assert source link target is `_blank`

Run:
```bash
npx playwright test e2e/daily-smoke.spec.ts
```
Expected: FAIL before implementation/seed.

**Step 2: Implement minimal health endpoint and seed-aware e2e flow**

Add `/api/health/pipeline` and deterministic seed data path for CI.

**Step 3: Re-run e2e test**

Run:
```bash
npx playwright test e2e/daily-smoke.spec.ts
```
Expected: PASS.

**Step 4: Commit**

```bash
git add src/app/api/health/pipeline/route.ts e2e/daily-smoke.spec.ts playwright.config.ts
git commit -m "test(e2e): add daily navigation smoke and pipeline health endpoint"
```

### Task 10: Deployment Config and Final Verification

**Files:**
- Create: `vercel.json`
- Create: `.env.example`
- Create: `README.md`
- Modify: `package.json`

**Step 1: Add Vercel cron config**

Set cron:
```json
{
  "crons": [
    { "path": "/api/cron/daily", "schedule": "0 0 * * *" }
  ]
}
```

**Step 2: Add environment contract docs**

Document:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `DASHSCOPE_API_KEY`
- `CRON_SECRET`

**Step 3: Run full verification**

Run:
```bash
npm run lint
npm run test
npm run build
npx playwright test e2e/daily-smoke.spec.ts
```
Expected: all pass with no regressions.

**Step 4: Commit**

```bash
git add vercel.json .env.example README.md package.json
git commit -m "chore: configure vercel cron and deployment docs"
```

## Completion Checklist

- [ ] All tests were written first and failed before implementation.
- [ ] All unit/integration/e2e checks pass.
- [ ] Cron endpoint is protected by secret token.
- [ ] Snapshot payloads power homepage and category pages.
- [ ] Detail page includes source metadata and original links.
- [ ] Daily pipeline is idempotent and failure-safe.
