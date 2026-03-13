import { describe, expect, it } from "vitest";
import { loadNewsDetailFromClient } from "@/lib/pipeline/read-model";

function createClientForDetailBehaviorTest() {
  return {
    from: (table: string) => {
      if (table === "events") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: {
                  id: 2,
                  canonical_title: "Join Event",
                  category: "world",
                  hot_score: 72,
                  tags: ["GLOBAL", "SUMMIT"],
                },
                error: null,
              }),
            }),
          }),
        };
      }

      if (table === "summaries") {
        return {
          select: () => ({
            eq: () => ({
              order: () => ({
                limit: async () => ({
                  data: [{ summary_cn: "joined summary", generated_at: "2026-03-03T00:00:00.000Z" }],
                  error: null,
                }),
              }),
            }),
          }),
        };
      }

      if (table === "event_articles") {
        return {
          select: () => ({
            eq: async () => ({
              data: [{ article_id: 2001 }, { article_id: 2002 }],
              error: null,
            }),
          }),
        };
      }

      if (table === "articles") {
        return {
          select: () => ({
            in: async () => ({
              data: [
                {
                  id: 2001,
                  source_id: 77,
                  url: "https://example.com/a2001",
                  title: "Article 2001",
                  published_at: "2026-03-03T00:00:00.000Z",
                  sources: {
                    id: 77,
                    name: "Joined Source B",
                    authority_weight: 1.1,
                  },
                },
                {
                  id: 2002,
                  source_id: 78,
                  url: "https://example.com/a2002",
                  title: "Article 2002",
                  published_at: "2026-03-03T01:00:00.000Z",
                  sources: {
                    id: 78,
                    name: "Joined Source A",
                    authority_weight: 1.3,
                  },
                },
              ],
              error: null,
            }),
          }),
        };
      }

      throw new Error(`unexpected_table_${table}`);
    },
  };
}

describe("loadNewsDetailFromClient", () => {
  it("maps detail payload from event, summary, and joined article source rows", async () => {
    const client = createClientForDetailBehaviorTest();
    const detail = await loadNewsDetailFromClient(client as never, "2");

    expect(detail).not.toBeNull();
    expect(detail?.id).toBe("2");
    expect(detail?.title).toBe("Join Event");
    expect(detail?.category).toBe("international");
    expect(detail?.summaryCn).toBe("joined summary");
    expect(detail?.tags).toEqual(["GLOBAL", "SUMMIT"]);
    expect(detail?.sources).toHaveLength(2);
    expect(detail?.sources[0]).toMatchObject({
      sourceId: 78,
      sourceName: "Joined Source A",
      authorityWeight: 1.3,
    });
    expect(detail?.sources[1]).toMatchObject({
      sourceId: 77,
      sourceName: "Joined Source B",
      authorityWeight: 1.1,
    });
  });
});
