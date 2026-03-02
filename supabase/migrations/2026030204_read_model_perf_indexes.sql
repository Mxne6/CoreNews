create index if not exists idx_pipeline_runs_success_started_at
  on pipeline_runs(started_at desc)
  where status = 'success';

create index if not exists idx_snapshots_key_generated_at
  on snapshots(key, generated_at desc);
