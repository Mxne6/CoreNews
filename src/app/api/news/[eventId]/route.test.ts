import { beforeEach, describe, expect, it } from "vitest";
import { GET } from "@/app/api/news/[eventId]/route";
import { defaultPipelineStore } from "@/lib/pipeline/run-daily";

beforeEach(() => {
  defaultPipelineStore.events.length = 0;
  defaultPipelineStore.summaries.length = 0;
  defaultPipelineStore.articles.length = 0;
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
    id: "ai:openai-releases-gpt-5",
    category: "ai",
    canonicalTitle: "OpenAI releases GPT-5",
    hotScore: 88,
    articleIds: ["a1"],
  });

  defaultPipelineStore.summaries.push({
    eventId: "ai:openai-releases-gpt-5",
    summaryCn: "summary-cn",
    modelName: "qwen-max",
    modelVersion: "v1",
  });

  defaultPipelineStore.snapshots.push({
    generatedAt: new Date("2026-03-02T00:00:00.000Z"),
    homePayload: [
      {
        id: "ai:openai-releases-gpt-5",
        category: "ai",
        tags: ["AI", "MODEL"],
        canonicalTitle: "OpenAI releases GPT-5",
        hotScore: 88,
        summaryCn: "summary-cn",
      },
    ],
    categoryPayloads: {
      ai: [
        {
          id: "ai:openai-releases-gpt-5",
          category: "ai",
          tags: ["AI", "MODEL"],
          canonicalTitle: "OpenAI releases GPT-5",
          hotScore: 88,
          summaryCn: "summary-cn",
        },
      ],
    },
  });
});

describe("GET /api/news/[eventId]", () => {
  it("returns detail payload with tags", async () => {
    const request = new Request("http://localhost:3000/api/news/ai:openai-releases-gpt-5");
    const response = await GET(request, {
      params: Promise.resolve({ eventId: "ai:openai-releases-gpt-5" }),
    });
    const body = (await response.json()) as {
      id: string;
      title: string;
      summaryCn: string;
      tags: string[];
      sources: Array<{ url: string; sourceName: string }>;
    };

    expect(response.status).toBe(200);
    expect(body.id).toBe("ai:openai-releases-gpt-5");
    expect(body.title).toBe("OpenAI releases GPT-5");
    expect(body.summaryCn).toBe("summary-cn");
    expect(body.tags).toEqual(["AI", "MODEL"]);
    expect(body.sources[0].url).toBe("https://example.com/a1");
    expect(body.sources[0].sourceName).toBe("source-1");
  });

  it("returns 404 when event is missing", async () => {
    const request = new Request("http://localhost:3000/api/news/missing");
    const response = await GET(request, { params: Promise.resolve({ eventId: "missing" }) });

    expect(response.status).toBe(404);
  });
});
