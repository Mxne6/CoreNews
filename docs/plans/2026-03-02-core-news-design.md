# CoreNews Design (MVP -> v1.0 baseline)

## 1. Product Positioning

CoreNews is a structured multi-domain hotspot dashboard for daily efficient reading.

Goals:
- Aggregate and rank important events from multiple media sources.
- Let users scan daily key updates in 2-3 minutes.
- Keep UI simple: no comments, no community, no user system.

Non-goals:
- No full-text republishing of source articles.
- No social features or recommendation feed loops.

## 2. Final Architecture

- Frontend and API: Next.js (TypeScript), deployed on Vercel.
- Scheduler: Vercel Cron (Hobby), once per day.
- Database: Supabase Postgres.
- LLM: DashScope (Qwen) for event merge disambiguation and Chinese summaries.
- Read model: Snapshot-first rendering for homepage and category pages.

Daily schedule:
- Cron expression: `0 0 * * *` (UTC), intended for 08:00 China Standard Time.
- Note: Hobby trigger window can drift within roughly one hour.

## 3. Page Structure

- `/` homepage: show each domain with top 3-5 events by hotspot score.
- `/ai`, `/tech`, `/world`, `/business`, `/japan`: domain pages with the last 24-72h events, paginated.
- `/news/[eventId]`: internal detail page with title, source list, publish time range, Chinese summary, and "view original" links.

Click flow:
- Homepage -> Domain page (optional) -> Detail page -> Source article.

## 4. Data Model (Supabase Postgres)

### `sources`
- `id` (pk)
- `name`
- `rss_url`
- `authority_weight` (numeric)
- `category` (default category)
- `is_active` (bool, default true)
- `last_fetched_at` (timestamptz)
- `created_at`, `updated_at`

### `articles`
- `id` (pk)
- `source_id` (fk -> sources.id)
- `title`
- `normalized_title`
- `url` (unique)
- `published_at` (timestamptz)
- `fetched_at` (timestamptz)
- `lang`
- `content_snippet`
- `content_hash`
- `created_at`

Indexes:
- `articles(published_at desc)`
- `articles(source_id, published_at desc)`
- optional trigram index for `normalized_title`

### `events`
- `id` (pk)
- `canonical_title`
- `category`
- `hot_score` (numeric)
- `status` (active/archived)
- `article_count` (int)
- `first_published_at` (timestamptz)
- `last_published_at` (timestamptz)
- `window_start` (timestamptz)
- `window_end` (timestamptz)
- `snapshot_run_id` (nullable fk -> pipeline_runs.id)
- `scoring_version`
- `created_at`, `updated_at`

Indexes:
- `events(category, hot_score desc)`
- `events(window_start desc)`

### `event_articles`
- `event_id` (fk -> events.id)
- `article_id` (fk -> articles.id)
- composite primary key `(event_id, article_id)`

### `summaries`
- `id` (pk)
- `event_id` (fk -> events.id)
- `summary_cn`
- `model_name`
- `model_version`
- `generated_at`
- `created_at`

### `snapshots`
- `id` (pk)
- `run_id` (fk -> pipeline_runs.id)
- `generated_at` (timestamptz)
- `home_payload` (jsonb)
- `category_payloads` (jsonb)

### `pipeline_runs`
- `id` (pk)
- `started_at`
- `ended_at`
- `status` (running/success/failed)
- `error` (text, nullable)
- `article_count` (int)
- `event_count` (int)
- `summary_count` (int)
- `created_at`

## 5. Pipeline Design (Once Daily)

1. Pull RSS from active sources.
2. Deduplicate by `url` and `content_hash`, persist unique articles.
3. Rule-based pre-clustering (time window + normalized title similarity).
4. LLM only on ambiguous candidate clusters for merge/split decision.
5. Compute event-level `hot_score` from:
- source coverage count
- source authority weights
- recency decay
6. Generate Chinese event summaries.
7. Build and persist snapshot payloads (`home_payload`, `category_payloads`).
8. Finalize `pipeline_runs` metrics and status.

Key principle:
- LLM is not first-line filter.
- LLM is limited to ambiguity resolution and summary generation.

## 6. Error Handling and Reliability

- One active pipeline run at a time (re-entrancy lock).
- Step-level error handling; failed run does not overwrite latest successful snapshot.
- DashScope retry policy: max 2 retries with exponential backoff.
- LLM degradation fallback: template summary if model calls fail repeatedly.
- Idempotency: re-running same input must not create duplicate articles/events/summaries.

## 7. API and Frontend Read Strategy

- Homepage and domain pages only read latest successful snapshot.
- Detail page reads normalized event data + summary + source mappings.
- Health endpoint `/api/health/pipeline` returns recent run states.

## 8. Testing Strategy

Data and SQL:
- Constraint tests for unique/fk/index behavior.
- Index coverage checks for `articles.published_at` and `events.window_start`.

Pipeline:
- Unit tests for normalization, deduplication, scoring determinism.
- Integration tests for end-to-end run with mocked LLM failure cases (timeout, 429, empty payload).
- Idempotency tests with identical fixture RSS input.

API and UI:
- Snapshot JSON schema contract tests.
- Detail page rendering and missing-resource (404) handling tests.
- E2E smoke: homepage -> category -> detail.

## 9. Acceptance Criteria

- Daily cron run success rate >= 95%.
- Single run duration < 10 minutes under normal source volume.
- Homepage displays 3-5 high-signal events per domain.
- Snapshot-first pages remain available if current run fails.

## 10. Deployment and Operations

- Vercel env vars: Supabase URL/keys, DashScope API key, cron auth token.
- Supabase migrations managed in-repo.
- CI gates: lint + typecheck + tests + smoke checks.

## 11. Evolution Path

Phase 2 candidates:
- Add lightweight editorial override table for manual correction.
- Add trend delta (up/down) between consecutive snapshots.
- Add optional alert channel for failed daily runs.
