import { describe, expect, it } from "vitest";
import type { ActiveSource } from "@/lib/pipeline/article-ingest";
import {
  buildReusableSummaryByStableKey,
  isEventUnchangedForReuse,
  pickTopStableKeysByHotScore,
  selectSourcesForIngestion,
  shouldRetryInactiveSource,
} from "@/lib/pipeline/run-daily-supabase";

describe("shouldRetryInactiveSource", () => {
  const now = new Date("2026-03-03T08:00:00.000Z");

  it("retries when last_failed_at is missing or invalid", () => {
    expect(shouldRetryInactiveSource(null, now, 24)).toBe(true);
    expect(shouldRetryInactiveSource("invalid", now, 24)).toBe(true);
  });

  it("does not retry within the retry window", () => {
    expect(shouldRetryInactiveSource("2026-03-03T00:30:00.000Z", now, 24)).toBe(false);
  });

  it("retries when retry window has elapsed", () => {
    expect(shouldRetryInactiveSource("2026-03-02T00:00:00.000Z", now, 24)).toBe(true);
  });
});

describe("selectSourcesForIngestion", () => {
  it("keeps active sources and picks inactive sources only when due", () => {
    const now = new Date("2026-03-03T08:00:00.000Z");
    const sources: ActiveSource[] = [
      {
        id: 1,
        rss_url: "https://example.com/active",
        category: "world",
        authority_weight: 1,
        is_active: true,
        consecutive_failures: 0,
        last_failed_at: null,
      },
      {
        id: 2,
        rss_url: "https://example.com/inactive-due",
        category: "world",
        authority_weight: 1,
        is_active: false,
        consecutive_failures: 3,
        last_failed_at: "2026-03-01T00:00:00.000Z",
      },
      {
        id: 3,
        rss_url: "https://example.com/inactive-not-due",
        category: "tech",
        authority_weight: 1,
        is_active: false,
        consecutive_failures: 3,
        last_failed_at: "2026-03-03T00:30:00.000Z",
      },
    ];

    const selected = selectSourcesForIngestion(sources, now, 24);
    expect(selected.map((item) => item.id)).toEqual([1, 2]);
  });
});

describe("isEventUnchangedForReuse", () => {
  it("returns true when article_count and last_published_at are unchanged", () => {
    expect(
      isEventUnchangedForReuse(
        {
          article_count: 5,
          last_published_at: "2026-03-03T00:00:00.000+00:00",
        },
        {
          articleCount: 5,
          lastPublishedAt: "2026-03-03T00:00:00.000Z",
        },
      ),
    ).toBe(true);
  });

  it("returns false when article_count changed", () => {
    expect(
      isEventUnchangedForReuse(
        {
          article_count: 4,
          last_published_at: "2026-03-03T00:00:00.000Z",
        },
        {
          articleCount: 5,
          lastPublishedAt: "2026-03-03T00:00:00.000Z",
        },
      ),
    ).toBe(false);
  });

  it("returns false when last_published_at changed", () => {
    expect(
      isEventUnchangedForReuse(
        {
          article_count: 5,
          last_published_at: "2026-03-03T00:00:01.000Z",
        },
        {
          articleCount: 5,
          lastPublishedAt: "2026-03-03T00:00:00.000Z",
        },
      ),
    ).toBe(false);
  });
});

describe("buildReusableSummaryByStableKey", () => {
  it("maps unchanged stable keys to latest summary payload", () => {
    const map = buildReusableSummaryByStableKey({
      unchangedStableKeys: new Set(["event-a", "event-b"]),
      existingEventByStableKey: new Map([
        ["event-a", { id: 10 }],
        ["event-b", { id: 20 }],
      ]),
      latestSummaryByEventId: new Map([
        [10, { summaryCn: "summary-a", modelName: "dashscope", modelVersion: "qwen-max" }],
      ]),
    });

    expect(map.get("event-a")).toEqual({
      summaryCn: "summary-a",
      modelName: "dashscope",
      modelVersion: "qwen-max",
    });
    expect(map.has("event-b")).toBe(false);
  });
});

describe("pickTopStableKeysByHotScore", () => {
  it("returns only top N stable keys by hot score", () => {
    const events = Array.from({ length: 45 }, (_, index) => ({
      eventStableKey: `event-${index + 1}`,
      hotScore: 100 - index,
    }));

    const result = pickTopStableKeysByHotScore(events, 40);

    expect(result.size).toBe(40);
    expect(result.has("event-1")).toBe(true);
    expect(result.has("event-40")).toBe(true);
    expect(result.has("event-41")).toBe(false);
  });
});