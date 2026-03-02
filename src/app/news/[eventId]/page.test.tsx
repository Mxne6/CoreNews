import { beforeEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import NewsDetailPage from "@/app/news/[eventId]/page";
import { defaultPipelineStore } from "@/lib/pipeline/run-daily";

beforeEach(() => {
  defaultPipelineStore.events.length = 0;
  defaultPipelineStore.articles.length = 0;
  defaultPipelineStore.summaries.length = 0;

  defaultPipelineStore.articles.push({
    id: "a1",
    sourceId: 1,
    url: "https://example.com/a1",
    title: "OpenAI releases GPT-5",
    normalizedTitle: "openai releases gpt 5",
    contentHash: "h1",
    publishedAt: new Date("2026-03-02T00:00:00.000Z"),
    category: "ai",
  });

  defaultPipelineStore.events.push({
    id: "ai:openai-releases-gpt-5",
    category: "ai",
    canonicalTitle: "OpenAI releases GPT-5",
    hotScore: 88,
    articleIds: ["a1"],
  });

  defaultPipelineStore.summaries.push({
    eventId: "ai:openai-releases-gpt-5",
    summaryCn: "摘要内容",
    modelName: "qwen-max",
    modelVersion: "v1",
  });
});

describe("NewsDetailPage", () => {
  it("renders source link with new tab target", async () => {
    const ui = await NewsDetailPage({
      params: Promise.resolve({ eventId: "ai:openai-releases-gpt-5" }),
    });
    render(ui);

    const link = screen.getByRole("link", { name: "查看原文 1" });
    expect(link).toHaveAttribute("href", "https://example.com/a1");
    expect(link).toHaveAttribute("target", "_blank");
  });
});
