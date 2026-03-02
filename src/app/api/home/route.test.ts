import { beforeEach, describe, expect, it } from "vitest";
import { GET } from "@/app/api/home/route";
import { defaultPipelineStore } from "@/lib/pipeline/run-daily";

beforeEach(() => {
  defaultPipelineStore.snapshots.length = 0;
  defaultPipelineStore.snapshots.push({
    generatedAt: new Date("2026-03-02T00:00:00.000Z"),
    homePayload: {
      ai: [
        {
          id: "ai:event-1",
          canonicalTitle: "OpenAI releases GPT-5",
          hotScore: 88.2,
          articleCount: 4,
          summaryCn: "示例摘要",
        },
      ],
    },
    categoryPayloads: {},
  });
});

describe("GET /api/home", () => {
  it("returns snapshot driven homepage sections", async () => {
    const response = await GET();
    const body = (await response.json()) as {
      sections: Array<{ category: string; events: Array<{ id: string }> }>;
    };

    expect(response.status).toBe(200);
    expect(body.sections[0].category).toBe("ai");
    expect(body.sections[0].events[0].id).toBe("ai:event-1");
  });
});
