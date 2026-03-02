import { beforeEach, describe, expect, it } from "vitest";
import { GET } from "@/app/api/category/[slug]/route";
import { defaultPipelineStore } from "@/lib/pipeline/run-daily";

beforeEach(() => {
  defaultPipelineStore.snapshots.length = 0;
  defaultPipelineStore.snapshots.push({
    generatedAt: new Date("2026-03-02T00:00:00.000Z"),
    homePayload: {},
    categoryPayloads: {
      ai: Array.from({ length: 12 }).map((_, index) => ({
        id: `ai:event-${index + 1}`,
        canonicalTitle: `AI Event ${index + 1}`,
        hotScore: 90 - index,
      })),
    },
  });
});

describe("GET /api/category/[slug]", () => {
  it("supports pagination from snapshot payload", async () => {
    const request = new Request("http://localhost:3000/api/category/ai?page=2&pageSize=5");
    const response = await GET(request, { params: Promise.resolve({ slug: "ai" }) });
    const body = (await response.json()) as {
      page: number;
      pageSize: number;
      total: number;
      events: Array<{ id: string }>;
    };

    expect(response.status).toBe(200);
    expect(body.page).toBe(2);
    expect(body.pageSize).toBe(5);
    expect(body.total).toBe(12);
    expect(body.events).toHaveLength(5);
    expect(body.events[0].id).toBe("ai:event-6");
  });
});
