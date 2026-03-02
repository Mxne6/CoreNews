create table if not exists sources (
  id bigint generated always as identity primary key,
  name text not null,
  rss_url text not null unique,
  authority_weight numeric(5,2) not null default 1.0,
  category text not null,
  is_active boolean not null default true,
  last_fetched_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists pipeline_runs (
  id bigint generated always as identity primary key,
  started_at timestamptz not null,
  ended_at timestamptz,
  status text not null check (status in ('running', 'success', 'failed')),
  error text,
  article_count integer not null default 0,
  event_count integer not null default 0,
  summary_count integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists articles (
  id bigint generated always as identity primary key,
  source_id bigint not null references sources(id) on delete cascade,
  title text not null,
  normalized_title text not null,
  url text not null,
  published_at timestamptz not null,
  fetched_at timestamptz not null default now(),
  lang text not null default 'unknown',
  content_snippet text,
  content_hash text not null,
  created_at timestamptz not null default now(),
  constraint uq_articles_url unique (url),
  constraint uq_articles_source_hash unique (source_id, content_hash)
);

create table if not exists events (
  id bigint generated always as identity primary key,
  canonical_title text not null,
  category text not null,
  hot_score numeric(10,4) not null default 0,
  status text not null default 'active' check (status in ('active', 'archived')),
  article_count integer not null default 0,
  first_published_at timestamptz,
  last_published_at timestamptz,
  window_start timestamptz not null,
  window_end timestamptz not null,
  snapshot_run_id bigint references pipeline_runs(id),
  scoring_version text not null default 'v1',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists event_articles (
  event_id bigint not null references events(id) on delete cascade,
  article_id bigint not null references articles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (event_id, article_id)
);

create table if not exists summaries (
  id bigint generated always as identity primary key,
  event_id bigint not null references events(id) on delete cascade,
  summary_cn text not null,
  model_name text not null,
  model_version text not null,
  generated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists snapshots (
  id bigint generated always as identity primary key,
  run_id bigint not null references pipeline_runs(id) on delete cascade,
  generated_at timestamptz not null default now(),
  home_payload jsonb not null default '{}'::jsonb,
  category_payloads jsonb not null default '{}'::jsonb
);

create index if not exists idx_sources_active on sources(is_active);
create index if not exists idx_articles_published_at on articles(published_at desc);
create index if not exists idx_articles_source_published_at on articles(source_id, published_at desc);
create index if not exists idx_articles_normalized_title on articles(normalized_title);
create index if not exists idx_events_category_hot_score on events(category, hot_score desc);
create index if not exists idx_events_window_start on events(window_start desc);
create index if not exists idx_event_articles_article_id on event_articles(article_id);
create index if not exists idx_summaries_event_id on summaries(event_id);
create index if not exists idx_snapshots_generated_at on snapshots(generated_at desc);
