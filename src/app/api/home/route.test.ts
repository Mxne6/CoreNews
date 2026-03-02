import { beforeEach, describe, expect, it } from "vitest";
import { GET } from "@/app/api/home/route";
import { defaultPipelineStore } from "@/lib/pipeline/run-daily";

beforeEach(() => {
  defaultPipelineStore.snapshots.length = 0;
  defaultPipelineStore.snapshots.push({
    generatedAt: new Date("2026-03-02T00:00:00.000Z"),
    homePayload: [
      {
        id: "ai:event-1",
        category: "ai",
        canonicalTitle: "OpenAI releases GPT-5",
        hotScore: 88.2,
        articleCount: 4,
        summaryCn: "示例摘要",
      },
    ],
    categoryPayloads: {},
  });
});

describe("GET /api/home", () => {
  it("returns snapshot driven homepage events", async () => {
    const response = await GET();
    const body = (await response.json()) as {
      events: Array<{ id: string; category: string }>;
    };

    expect(response.status).toBe(200);
    expect(body.events[0].category).toBe("ai");
    expect(body.events[0].id).toBe("ai:event-1");
  });
});

