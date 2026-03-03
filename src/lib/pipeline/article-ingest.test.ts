import { describe, expect, it, vi } from "vitest";
import {
  buildDedupeKey,
  ingestArticlesFromSources,
  prepareArticleRecord,
  type ActiveSource,
} from "@/lib/pipeline/article-ingest";

describe("buildDedupeKey", () => {
  it("uses guid first, then canonical link, then hash fallback", () => {
    const guidKey = buildDedupeKey({
      guid: "g-1",
      canonicalLink: "https://example.com/a",
      normalizedTitle: "openai releases gpt 5",
      publishedDateBucket: "2026-03-02",
    });
    const linkKey = buildDedupeKey({
      guid: "",
      canonicalLink: "https://example.com/a",
      normalizedTitle: "openai releases gpt 5",
      publishedDateBucket: "2026-03-02",
    });
    const hashKey = buildDedupeKey({
      guid: "",
      canonicalLink: "",
      normalizedTitle: "openai releases gpt 5",
      publishedDateBucket: "2026-03-02",
    });

    expect(guidKey).toBe("guid:g-1");
    expect(linkKey).toBe("link:https://example.com/a");
    expect(hashKey.startsWith("hash:")).toBe(true);
  });
});

describe("prepareArticleRecord", () => {
  it("keeps published_at nullable and fills fallback", () => {
    const now = new Date("2026-03-02T08:00:00.000Z");
    const record = prepareArticleRecord(
      {
        id: 1,
        category: "tech",
        rss_url: "https://example.com/rss",
        authority_weight: 1.1,
      },
      {
        title: "OpenAI releases GPT-5",
        link: "https://example.com/openai-gpt5",
        guid: "g-2",
        isoDate: "not-a-date",
        contentSnippet: "snippet",
      },
      now,
    );

    expect(record.published_at).toBeNull();
    expect(record.published_at_fallback).toBe(now.toISOString());
  });
});

describe("ingestArticlesFromSources", () => {
  it("captures per-source errors and uses source scoped conflict key", async () => {
    const sources: ActiveSource[] = [
      {
        id: 1,
        category: "tech",
        rss_url: "https://example.com/rss-1",
        authority_weight: 1,
        is_active: true,
        consecutive_failures: 0,
        last_failed_at: null,
      },
      {
        id: 2,
        category: "world",
        rss_url: "https://example.com/rss-2",
        authority_weight: 1,
        is_active: true,
        consecutive_failures: 0,
        last_failed_at: null,
      },
    ];

    const upsert = vi.fn(async () => ({ error: null }));
    const eq = vi.fn(async () => ({ error: null }));
    const client = {
      from: vi.fn((table: string) => {
        if (table === "articles") {
          return { upsert };
        }
        return {
          update: vi.fn(() => ({ eq })),
        };
      }),
    };

    const fetchFeed = vi
      .fn()
      .mockResolvedValueOnce([
        {
          title: "A",
          link: "https://example.com/a",
          guid: "same-guid",
          isoDate: "2026-03-02T00:00:00.000Z",
          contentSnippet: "a",
        },
      ])
      .mockRejectedValueOnce(new Error("rss timeout"));

    const result = await ingestArticlesFromSources({
      client: client as never,
      sources,
      fetchFeed,
      now: new Date("2026-03-02T08:00:00.000Z"),
    });

    expect(result.sourceErrors).toHaveLength(1);
    expect(result.sourceErrors[0].sourceId).toBe(2);
    expect(upsert).toHaveBeenCalledWith(expect.any(Array), {
      onConflict: "source_id,dedupe_key",
    });
  });

  it("keeps source status update call bound to table context", async () => {
    const now = new Date("2026-03-03T08:00:00.000Z");
    const sources: ActiveSource[] = [
      {
        id: 7,
        category: "world",
        rss_url: "https://example.com/rss-7",
        authority_weight: 1,
        is_active: true,
        consecutive_failures: 0,
        last_failed_at: null,
      },
    ];

    const sourceTable = {
      cloneRequestState: { ok: true },
      update(this: { cloneRequestState?: unknown }, _values: Record<string, unknown>) {
        if (!this?.cloneRequestState) {
          throw new TypeError("Cannot read properties of undefined (reading 'cloneRequestState')");
        }
        return {
          eq: async () => ({ error: null }),
        };
      },
    };

    const client = {
      from: vi.fn((table: string) => {
        if (table === "sources") {
          return sourceTable;
        }
        return { upsert: vi.fn(async () => ({ error: null })) };
      }),
    };

    const fetchFeed = vi.fn().mockRejectedValueOnce(new Error("rss timeout"));

    await expect(
      ingestArticlesFromSources({
        client: client as never,
        sources,
        fetchFeed,
        now,
      }),
    ).resolves.toMatchObject({
      sourceErrors: [{ sourceId: 7, error: "rss timeout" }],
    });
  });

  it("deactivates a source after reaching failure threshold", async () => {
    const now = new Date("2026-03-03T08:00:00.000Z");
    const sources: ActiveSource[] = [
      {
        id: 9,
        category: "world",
        rss_url: "https://example.com/rss-9",
        authority_weight: 1,
        is_active: true,
        consecutive_failures: 2,
        last_failed_at: "2026-03-02T08:00:00.000Z",
      },
    ];

    const eq = vi.fn(async () => ({ error: null }));
    const update = vi.fn(() => ({ eq }));
    const client = {
      from: vi.fn((table: string) => {
        if (table === "sources") {
          return { update };
        }
        return { upsert: vi.fn(async () => ({ error: null })) };
      }),
    };

    const fetchFeed = vi.fn().mockRejectedValueOnce(new Error("rss timeout"));

    await ingestArticlesFromSources({
      client: client as never,
      sources,
      fetchFeed,
      now,
      failureDeactivateThreshold: 3,
    });

    expect(update).toHaveBeenCalledWith({
      consecutive_failures: 3,
      is_active: false,
      last_error: "rss timeout",
      last_failed_at: now.toISOString(),
    });
  });

  it("reactivates a source and clears failure state after success", async () => {
    const now = new Date("2026-03-03T08:00:00.000Z");
    const sources: ActiveSource[] = [
      {
        id: 3,
        category: "tech",
        rss_url: "https://example.com/rss-3",
        authority_weight: 1,
        is_active: false,
        consecutive_failures: 5,
        last_failed_at: "2026-03-02T08:00:00.000Z",
      },
    ];

    const eq = vi.fn(async () => ({ error: null }));
    const update = vi.fn(() => ({ eq }));
    const client = {
      from: vi.fn((table: string) => {
        if (table === "sources") {
          return { update };
        }
        return { upsert: vi.fn(async () => ({ error: null })) };
      }),
    };
    const fetchFeed = vi.fn().mockResolvedValueOnce([
      {
        title: "A",
        link: "https://example.com/a",
        guid: "g-1",
        isoDate: "2026-03-03T00:00:00.000Z",
      },
    ]);

    await ingestArticlesFromSources({
      client: client as never,
      sources,
      fetchFeed,
      now,
    });

    expect(update).toHaveBeenCalledWith({
      consecutive_failures: 0,
      is_active: true,
      last_error: null,
      last_failed_at: null,
      last_fetched_at: now.toISOString(),
    });
  });
});
