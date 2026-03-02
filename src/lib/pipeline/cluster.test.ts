import { describe, expect, it } from "vitest";
import { clusterArticlesBySimilarity } from "@/lib/pipeline/cluster";

describe("clusterArticlesBySimilarity", () => {
  it("groups similar events in the same time window", () => {
    const groups = clusterArticlesBySimilarity([
      {
        id: "a1",
        sourceId: 1,
        normalizedTitle: "openai releases gpt 5",
        publishedAt: new Date("2026-03-02T01:00:00.000Z"),
      },
      {
        id: "a2",
        sourceId: 2,
        normalizedTitle: "openai release gpt 5 model",
        publishedAt: new Date("2026-03-02T03:00:00.000Z"),
      },
      {
        id: "a3",
        sourceId: 3,
        normalizedTitle: "boj updates monetary policy",
        publishedAt: new Date("2026-03-02T04:00:00.000Z"),
      },
    ]);

    expect(groups).toHaveLength(2);
    expect(groups[0].articles.length).toBe(2);
    expect(groups[1].articles.length).toBe(1);
  });
});
