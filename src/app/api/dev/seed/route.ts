import { NextResponse } from "next/server";
import { defaultPipelineStore } from "@/lib/pipeline/run-daily";

export async function GET() {
  defaultPipelineStore.articles.length = 0;
  defaultPipelineStore.events.length = 0;
  defaultPipelineStore.summaries.length = 0;
  defaultPipelineStore.snapshots.length = 0;

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
    id: "ai-openai-releases-gpt-5",
    category: "ai",
    canonicalTitle: "OpenAI releases GPT-5",
    hotScore: 88.2,
    articleIds: ["a1"],
  });

  defaultPipelineStore.summaries.push({
    eventId: "ai-openai-releases-gpt-5",
    summaryCn: "OpenAI released GPT-5 according to multiple sources.",
    modelName: "qwen-max",
    modelVersion: "seed",
  });

  defaultPipelineStore.snapshots.push({
    generatedAt: new Date("2026-03-02T00:00:00.000Z"),
    homePayload: {
      ai: [
        {
          id: "ai-openai-releases-gpt-5",
          canonicalTitle: "OpenAI releases GPT-5",
          hotScore: 88.2,
          summaryCn: "OpenAI released GPT-5 according to multiple sources.",
        },
      ],
    },
    categoryPayloads: {
      ai: [
        {
          id: "ai-openai-releases-gpt-5",
          canonicalTitle: "OpenAI releases GPT-5",
          hotScore: 88.2,
          summaryCn: "OpenAI released GPT-5 according to multiple sources.",
        },
      ],
    },
  });

  return NextResponse.json({ ok: true });
}
