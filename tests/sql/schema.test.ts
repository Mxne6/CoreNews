import fs from "node:fs";
import path from "node:path";
import { newDb } from "pg-mem";
import { describe, expect, it } from "vitest";

const migrationPath = path.join(
  process.cwd(),
  "supabase",
  "migrations",
  "2026030201_core_news_schema.sql",
);

function applyMigration() {
  const db = newDb();
  const sql = fs.readFileSync(migrationPath, "utf8");
  db.public.none(sql);
  return db;
}

describe("core news schema migration", () => {
  it("exists on disk", () => {
    expect(fs.existsSync(migrationPath)).toBe(true);
  });

  it("creates required tables", () => {
    const db = applyMigration();
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

  it("adds articles.url unique constraint", () => {
    const db = applyMigration();

    db.public.none(`
      insert into sources (name, rss_url, authority_weight, category)
      values ('Reuters', 'https://example.com/rss', 1.2, 'world');
    `);

    db.public.none(`
      insert into articles (source_id, title, normalized_title, url, published_at, lang, content_hash)
      values (1, 'A', 'a', 'https://example.com/a', now(), 'en', 'hash-1');
    `);

    expect(() =>
      db.public.none(`
        insert into articles (source_id, title, normalized_title, url, published_at, lang, content_hash)
        values (1, 'B', 'b', 'https://example.com/a', now(), 'en', 'hash-2');
      `),
    ).toThrow();
  });

  it("adds required indexes for feed queries", () => {
    const sql = fs.readFileSync(migrationPath, "utf8");
    expect(sql).toContain("create index if not exists idx_articles_published_at");
    expect(sql).toContain("create index if not exists idx_events_window_start");
  });
});
