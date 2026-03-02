import { describe, expect, it } from "vitest";
import {
  createInMemoryPipelineStore,
  runDailyPipeline,
  type PipelineArticle,
} from "@/lib/pipeline/run-daily";

const now = new Date("2026-03-02T00:00:00.000Z");

const articles: PipelineArticle[] = [
  {
    id: "a1",
    sourceId: 1,
    url: "https://example.com/a1",
    title: "OpenAI releases GPT-5",
    normalizedTitle: "openai releases gpt 5",
    contentHash: "h1",
    publishedAt: new Date("2026-03-01T22:00:00.000Z"),
    category: "ai",
  },
  {
    id: "a2",
    sourceId: 2,
    url: "https://example.com/a2",
    title: "OpenAI unveils GPT-5 model",
    normalizedTitle: "openai unveils gpt 5 model",
    contentHash: "h2",
    publishedAt: new Date("2026-03-01T23:00:00.000Z"),
    category: "ai",
  },
];

describe("runDailyPipeline", () => {
  it("records a successful run with metrics", async () => {
    const store = createInMemoryPipelineStore();
    await runDailyPipeline({ store, incomingArticles: articles, now });

    expect(store.pipelineRuns).toHaveLength(1);
    expect(store.pipelineRuns[0].status).toBe("success");
    expect(store.pipelineRuns[0].articleCount).toBe(2);
    expect(store.pipelineRuns[0].eventCount).toBe(1);
    expect(store.snapshots).toHaveLength(1);
  });

  it("writes detailed fallback summaries instead of title-like short text", async () => {
    const store = createInMemoryPipelineStore();
    await runDailyPipeline({ store, incomingArticles: articles, now });

    const summary = store.summaries[0]?.summaryCn ?? "";
    expect(summary.length).toBeGreaterThanOrEqual(30);
    expect(summary).toContain("关键进展");
    expect(summary).toContain("后续影响");
  });

  it("is idempotent on same input", async () => {
    const store = createInMemoryPipelineStore();
    await runDailyPipeline({ store, incomingArticles: articles, now });
    await runDailyPipeline({ store, incomingArticles: articles, now });

    expect(store.articles).toHaveLength(2);
    expect(store.events).toHaveLength(1);
    expect(store.summaries).toHaveLength(1);
  });

  it("keeps previous snapshot if current run fails", async () => {
    const store = createInMemoryPipelineStore();
    await runDailyPipeline({ store, incomingArticles: articles, now });

    await runDailyPipeline({
      store,
      incomingArticles: articles,
      now,
      resolver: async () => {
        throw new Error("llm down");
      },
    });

    expect(store.pipelineRuns.at(-1)?.status).toBe("failed");
    expect(store.snapshots).toHaveLength(1);
  });
});
