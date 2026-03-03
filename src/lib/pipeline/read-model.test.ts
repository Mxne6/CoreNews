import { describe, expect, it } from "vitest";
import { loadNewsDetailFromClient } from "@/lib/pipeline/read-model";

type QueryResult<T> = Promise<{ data: T; error: { message: string } | null }>;

function createClientForParallelQueryTest(input: {
  summaryPromise: QueryResult<Array<{ summary_cn: string; generated_at: string }>>;
  onEventArticlesQuery: () => void;
}) {
  return {
    from: (table: string) => {
      if (table === "events") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: {
                  id: 1,
                  canonical_title: "Test Event",
                  category: "tech",
                  hot_score: 80,
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
                limit: () => input.summaryPromise,
              }),
            }),
          }),
        };
      }

      if (table === "event_articles") {
        return {
          select: () => ({
            eq: async () => {
              input.onEventArticlesQuery();
              return { data: [], error: null };
            },
          }),
        };
      }

      if (table === "articles") {
        return {
          select: () => ({
            in: async () => ({ data: [], error: null }),
          }),
        };
      }

      if (table === "sources") {
        return {
          select: () => ({
            in: async () => ({ data: [], error: null }),
          }),
        };
      }

      throw new Error(`unexpected_table_${table}`);
    },
  };
}

function createClientForSourceJoinTest(input: {
  onArticleSelectColumns: (columns: string) => void;
  onSourcesTableQuery: () => void;
}) {
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
              data: [{ article_id: 2001 }],
              error: null,
            }),
          }),
        };
      }

      if (table === "articles") {
        return {
          select: (columns: string) => {
            input.onArticleSelectColumns(columns);
            return {
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
                      name: "Joined Source",
                      authority_weight: 1.23,
                    },
                  },
                ],
                error: null,
              }),
            };
          },
        };
      }

      if (table === "sources") {
        input.onSourcesTableQuery();
        return {
          select: () => ({
            in: async () => ({ data: [], error: null }),
          }),
        };
      }

      throw new Error(`unexpected_table_${table}`);
    },
  };
}

describe("loadNewsDetailFromClient", () => {
  it("queries summaries and event mappings in parallel after event row is loaded", async () => {
    let eventArticlesQueried = false;
    const deferredSummary: {
      resolve: (value: { data: Array<{ summary_cn: string; generated_at: string }>; error: null }) => void;
    } = {
      resolve: () => undefined,
    };
    const summaryPromise: QueryResult<Array<{ summary_cn: string; generated_at: string }>> = new Promise(
      (resolve) => {
        deferredSummary.resolve = resolve;
      },
    );

    const client = createClientForParallelQueryTest({
      summaryPromise,
      onEventArticlesQuery: () => {
        eventArticlesQueried = true;
      },
    });

    const pending = loadNewsDetailFromClient(client as never, "1");
    await Promise.resolve();

    expect(eventArticlesQueried).toBe(true);

    deferredSummary.resolve({
      data: [{ summary_cn: "summary text", generated_at: "2026-03-03T00:00:00.000Z" }],
      error: null,
    });

    const detail = await pending;
    expect(detail?.summaryCn).toBe("summary text");
    expect(detail?.sources).toEqual([]);
  });

  it("loads source metadata via article join without querying sources table", async () => {
    let articleSelectColumns = "";
    let sourcesTableQueried = false;

    const client = createClientForSourceJoinTest({
      onArticleSelectColumns: (columns) => {
        articleSelectColumns = columns;
      },
      onSourcesTableQuery: () => {
        sourcesTableQueried = true;
      },
    });

    const detail = await loadNewsDetailFromClient(client as never, "2");

    expect(articleSelectColumns).toContain("sources(");
    expect(sourcesTableQueried).toBe(false);
    expect(detail?.sources[0]).toMatchObject({
      sourceId: 77,
      sourceName: "Joined Source",
      authorityWeight: 1.23,
    });
  });
});
