alter table sources
  add column if not exists consecutive_failures integer not null default 0;

alter table sources
  add column if not exists last_failed_at timestamptz;

alter table sources
  add column if not exists last_error text;

alter table sources
  drop constraint if exists sources_consecutive_failures_non_negative;

alter table sources
  add constraint sources_consecutive_failures_non_negative
  check (consecutive_failures >= 0);

create index if not exists idx_sources_retry_scan
  on sources(is_active, last_failed_at desc);
