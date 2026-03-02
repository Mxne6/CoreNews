import { describe, expect, it } from "vitest";
import { DashScopeClient } from "@/lib/llm/dashscope";
import {
  aggregateEventsRolling,
  type AggregationArticle,
  type AggregationSource,
} from "@/lib/pipeline/event-aggregate";

const now = new Date("2026-03-02T08:00:00.000Z");

const sources: AggregationSource[] = [
  { id: 1, category: "ai", authorityWeight: 1.2 },
  { id: 2, category: "ai", authorityWeight: 1.0 },
  { id: 3, category: "world", authorityWeight: 1.1 },
];

const articles: AggregationArticle[] = [
  {
    id: 11,
    sourceId: 1,
    title: "OpenAI releases GPT-5",
    normalizedTitle: "openai releases gpt 5",
    publishedAt: "2026-03-02T07:00:00.000Z",
    publishedAtFallback: "2026-03-02T07:00:00.000Z",
  },
  {
    id: 12,
    sourceId: 2,
    title: "OpenAI unveils GPT-5 model",
    normalizedTitle: "openai unveils gpt 5 model",
    publishedAt: "2026-03-02T06:30:00.000Z",
    publishedAtFallback: "2026-03-02T06:30:00.000Z",
  },
  {
    id: 13,
    sourceId: 3,
    title: "Legacy article",
    normalizedTitle: "legacy article",
    publishedAt: "2026-02-20T06:30:00.000Z",
    publishedAtFallback: "2026-02-20T06:30:00.000Z",
  },
];

describe("aggregateEventsRolling", () => {
  it("processes only rolling 3-day window", async () => {
    const result = await aggregateEventsRolling({ articles, sources, now, windowDays: 3 });
    const allMappedArticleIds = result.eventMappings.flatMap((item) => item.articleIds);

    expect(allMappedArticleIds).toContain(11);
    expect(allMappedArticleIds).toContain(12);
    expect(allMappedArticleIds).not.toContain(13);
  });

  it("generates stable event keys for reruns", async () => {
    const first = await aggregateEventsRolling({ articles, sources, now, windowDays: 3 });
    const second = await aggregateEventsRolling({ articles, sources, now, windowDays: 3 });

    expect(first.events[0].eventStableKey).toBe(second.events[0].eventStableKey);
  });

  it("splits ambiguous group when resolver decides not to merge", async () => {
    const resolver = new DashScopeClient("fake");
    resolver.resolveGroup = async () => ({ canonicalTitle: "", merged: false });

    const result = await aggregateEventsRolling({
      articles,
      sources,
      now,
      windowDays: 3,
      ambiguityResolver: resolver,
    });

    expect(result.events).toHaveLength(2);
    expect(result.eventMappings.every((item) => item.articleIds.length === 1)).toBe(true);
  });
});
