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

  it("caps ambiguity resolver calls by configured limit", async () => {
    const callLog: string[] = [];
    const resolver = {
      resolveGroup: async (group: { groupId: string }) => {
        callLog.push(group.groupId);
        return { canonicalTitle: "merged", merged: true };
      },
    };
    const ambiguousArticles: AggregationArticle[] = [
      {
        id: 41,
        sourceId: 1,
        title: "OpenAI releases GPT-5",
        normalizedTitle: "openai releases gpt 5",
        publishedAt: "2026-03-02T07:00:00.000Z",
        publishedAtFallback: "2026-03-02T07:00:00.000Z",
      },
      {
        id: 42,
        sourceId: 2,
        title: "OpenAI unveils GPT-5 model",
        normalizedTitle: "openai unveils gpt 5 model",
        publishedAt: "2026-03-02T06:50:00.000Z",
        publishedAtFallback: "2026-03-02T06:50:00.000Z",
      },
      {
        id: 43,
        sourceId: 1,
        title: "Nvidia launches new ai chip",
        normalizedTitle: "nvidia launches new ai chip",
        publishedAt: "2026-03-02T07:10:00.000Z",
        publishedAtFallback: "2026-03-02T07:10:00.000Z",
      },
      {
        id: 44,
        sourceId: 2,
        title: "Nvidia unveils ai semiconductor chip",
        normalizedTitle: "nvidia unveils ai semiconductor chip",
        publishedAt: "2026-03-02T07:05:00.000Z",
        publishedAtFallback: "2026-03-02T07:05:00.000Z",
      },
    ];

    const result = await aggregateEventsRolling({
      articles: ambiguousArticles,
      sources,
      now,
      windowDays: 3,
      ambiguityResolver: resolver,
      ambiguityLimit: 1,
    });

    expect(callLog).toHaveLength(1);
    expect(result.events).toHaveLength(3);
  });

  it("does not merge same headline across different categories", async () => {
    const crossCategoryArticles: AggregationArticle[] = [
      {
        id: 21,
        sourceId: 1,
        title: "Summit opens in Tokyo",
        normalizedTitle: "summit opens in tokyo",
        publishedAt: "2026-03-02T07:20:00.000Z",
        publishedAtFallback: "2026-03-02T07:20:00.000Z",
      },
      {
        id: 22,
        sourceId: 3,
        title: "Summit opens in Tokyo",
        normalizedTitle: "summit opens in tokyo",
        publishedAt: "2026-03-02T07:10:00.000Z",
        publishedAtFallback: "2026-03-02T07:10:00.000Z",
      },
    ];

    const result = await aggregateEventsRolling({
      articles: crossCategoryArticles,
      sources,
      now,
      windowDays: 3,
    });

    expect(result.events).toHaveLength(2);
    expect(new Set(result.events.map((event) => event.category)).size).toBe(2);
  });

  it("uses strict flat category assignment for each event", async () => {
    const mixedSources: AggregationSource[] = [{ id: 1, category: "tech", authorityWeight: 0.8 }];
    const mixedArticles: AggregationArticle[] = [
      {
        id: 31,
        sourceId: 1,
        title: "OpenAI GPT model update",
        normalizedTitle: "openai gpt model update",
        publishedAt: "2026-03-02T07:40:00.000Z",
        publishedAtFallback: "2026-03-02T07:40:00.000Z",
      },
    ];

    const result = await aggregateEventsRolling({
      articles: mixedArticles,
      sources: mixedSources,
      now,
      windowDays: 3,
    });

    expect(result.events).toHaveLength(1);
    expect(result.events[0].categories).toEqual(["tech"]);
    expect(result.events[0].category).toBe("tech");
  });

  it("maps legacy policy source category to flat current-affairs", async () => {
    const policySources: AggregationSource[] = [
      { id: 99, category: "policy", authorityWeight: 1.1 },
    ];
    const policyArticles: AggregationArticle[] = [
      {
        id: 199,
        sourceId: 99,
        title: "Cabinet approves new election bill",
        normalizedTitle: "cabinet approves new election bill",
        publishedAt: "2026-03-02T07:00:00.000Z",
        publishedAtFallback: "2026-03-02T07:00:00.000Z",
      },
    ];

    const result = await aggregateEventsRolling({
      articles: policyArticles,
      sources: policySources,
      now,
      windowDays: 3,
    });

    expect(result.events).toHaveLength(1);
    expect(result.events[0].category).toBe("current-affairs");
  });

  it("uses category classifier fallback when semantic confidence is low", async () => {
    const classifierCalls: Array<{ title: string; candidates: string[] }> = [];
    const lowConfidenceArticles: AggregationArticle[] = [
      {
        id: 301,
        sourceId: 1,
        title: "Platform update rollout expands",
        normalizedTitle: "platform update rollout expands",
        publishedAt: "2026-03-02T07:20:00.000Z",
        publishedAtFallback: "2026-03-02T07:20:00.000Z",
      },
    ];

    const result = await aggregateEventsRolling({
      articles: lowConfidenceArticles,
      sources,
      now,
      windowDays: 3,
      categoryClassifier: {
        classifyCategory: async (input) => {
          classifierCalls.push({
            title: input.canonicalTitle,
            candidates: input.candidateCategories,
          });
          return "finance";
        },
      },
      categoryClassifierLimit: 1,
    });

    expect(classifierCalls).toHaveLength(1);
    expect(result.events).toHaveLength(1);
    expect(result.events[0].category).toBe("finance");
  });

});
