import fs from "node:fs";
import path from "node:path";
import { newDb } from "pg-mem";
import { describe, expect, it } from "vitest";

const migrationsDir = path.join(process.cwd(), "supabase", "migrations");

function getMigrationFiles() {
  return fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql"))
    .sort()
    .map((file) => path.join(migrationsDir, file));
}

function applyMigrations() {
  const db = newDb();
  for (const file of getMigrationFiles()) {
    db.public.none(fs.readFileSync(file, "utf8"));
  }
  return db;
}

describe("core news schema migrations", () => {
  it("migration files exist on disk", () => {
    const files = getMigrationFiles().map((file) => path.basename(file));
    expect(files).toEqual(
      expect.arrayContaining([
        "2026030201_core_news_schema.sql",
        "2026030202_pipeline_stability.sql",
        "2026030203_source_authority_weight_range.sql",
        "2026030204_read_model_perf_indexes.sql",
      ]),
    );
  });

  it("creates required tables", () => {
    const db = applyMigrations();
    const tables = [
      "sources",
      "articles",
      "events",
      "event_articles",
      "summaries",
      "snapshots",
      "pipeline_runs",
    ];

    for (const table of tables) {
      expect(() => db.public.many(`select * from ${table};`)).not.toThrow();
    }
  });

  it("enforces source-scoped dedupe key for articles", () => {
    const db = applyMigrations();
    db.public.none(`
      insert into sources (name, rss_url, authority_weight, category)
      values
      ('Reuters', 'https://example.com/reuters-rss', 1.2, 'world'),
      ('BBC', 'https://example.com/bbc-rss', 1.1, 'world');
    `);

    db.public.none(`
      insert into articles (source_id, title, normalized_title, url, lang, content_hash, dedupe_key)
      values (1, 'A', 'a', 'https://example.com/a1', 'en', 'hash-1', 'dedupe-1');
    `);

    expect(() =>
      db.public.none(`
        insert into articles (source_id, title, normalized_title, url, lang, content_hash, dedupe_key)
        values (1, 'A2', 'a2', 'https://example.com/a2', 'en', 'hash-2', 'dedupe-1');
      `),
    ).toThrow();

    expect(() =>
      db.public.none(`
        insert into articles (source_id, title, normalized_title, url, lang, content_hash, dedupe_key)
        values (2, 'B', 'b', 'https://example.com/b1', 'en', 'hash-3', 'dedupe-1');
      `),
    ).not.toThrow();
  });

  it("adds source errors and trigger on pipeline runs", () => {
    const db = applyMigrations();
    db.public.none(`
      insert into pipeline_runs (started_at, status)
      values ('2026-03-02T00:00:00.000Z', 'running');
    `);

    const rows = db.public.many(
      "select trigger, source_errors_json from pipeline_runs;",
    ) as Array<{ trigger: string; source_errors_json: unknown }>;

    expect(rows[0].trigger).toBe("vercel-cron");
    expect(rows[0].source_errors_json).toBeDefined();
  });

  it("contains single-running partial unique index statement", () => {
    const sql = fs.readFileSync(
      path.join(migrationsDir, "2026030202_pipeline_stability.sql"),
      "utf8",
    );
    expect(sql).toContain("uq_pipeline_runs_single_running");
    expect(sql).toContain("where status = 'running'");
  });

  it("contains snapshot key/value schema columns and run-key uniqueness", () => {
    const sql = fs.readFileSync(
      path.join(migrationsDir, "2026030202_pipeline_stability.sql"),
      "utf8",
    );
    expect(sql).toContain("add column if not exists key text");
    expect(sql).toContain("add column if not exists payload_json jsonb");
    expect(sql).toContain("add column if not exists version text");
    expect(sql).toContain("uq_snapshots_run_key");
  });

  it("enforces authority_weight range between 0.80 and 1.30", () => {
    const db = applyMigrations();

    expect(() =>
      db.public.none(`
        insert into sources (name, rss_url, authority_weight, category)
        values ('Valid Source', 'https://example.com/valid-rss', 1.00, 'world');
      `),
    ).not.toThrow();

    expect(() =>
      db.public.none(`
        insert into sources (name, rss_url, authority_weight, category)
        values ('Too Low', 'https://example.com/low-rss', 0.79, 'world');
      `),
    ).toThrow();

    expect(() =>
      db.public.none(`
        insert into sources (name, rss_url, authority_weight, category)
        values ('Too High', 'https://example.com/high-rss', 1.31, 'world');
      `),
    ).toThrow();
  });

  it("adds read-model performance indexes", () => {
    const sql = fs.readFileSync(
      path.join(migrationsDir, "2026030204_read_model_perf_indexes.sql"),
      "utf8",
    );
    expect(sql).toContain("idx_pipeline_runs_success_started_at");
    expect(sql).toContain("on pipeline_runs(started_at desc)");
    expect(sql).toContain("where status = 'success'");
    expect(sql).toContain("idx_snapshots_key_generated_at");
    expect(sql).toContain("on snapshots(key, generated_at desc)");
  });
});
