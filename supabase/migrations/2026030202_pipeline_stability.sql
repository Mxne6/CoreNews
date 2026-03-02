alter table articles
  add column if not exists dedupe_key text;

alter table articles
  add column if not exists canonical_link text;

alter table articles
  add column if not exists guid text;

alter table articles
  add column if not exists published_at_fallback timestamptz;

alter table articles
  alter column published_at drop not null;

create unique index if not exists uq_articles_source_dedupe_key
  on articles(source_id, dedupe_key);

alter table events
  add column if not exists event_stable_key text;

create unique index if not exists uq_events_event_stable_key
  on events(event_stable_key);

alter table summaries
  add column if not exists summary_version text not null default 'v1';

drop index if exists idx_summaries_event_id;

create unique index if not exists uq_summaries_event_model_version
  on summaries(event_id, model_name, model_version);

alter table pipeline_runs
  add column if not exists trigger text not null default 'vercel-cron';

alter table pipeline_runs
  add column if not exists source_errors_json jsonb not null default '[]'::jsonb;

create unique index if not exists uq_pipeline_runs_single_running
  on pipeline_runs(status)
  where status = 'running';

alter table snapshots
  add column if not exists key text not null default 'home';

alter table snapshots
  add column if not exists payload_json jsonb not null default '{}'::jsonb;

alter table snapshots
  add column if not exists version text not null default 'v1';

create unique index if not exists uq_snapshots_run_key
  on snapshots(run_id, key);
