import { beforeEach, describe, expect, it } from "vitest";
import { GET } from "@/app/api/cron/daily/route";
import { defaultPipelineStore } from "@/lib/pipeline/run-daily";

beforeEach(() => {
  process.env.CRON_SECRET = "topsecret";
  defaultPipelineStore.pipelineRuns.length = 0;
});

describe("GET /api/cron/daily", () => {
  it("rejects unauthorized requests", async () => {
    const request = new Request("http://localhost:3000/api/cron/daily");
    const response = await GET(request);

    expect(response.status).toBe(401);
  });

  it("accepts bearer token auth", async () => {
    const request = new Request("http://localhost:3000/api/cron/daily", {
      headers: {
        Authorization: "Bearer topsecret",
      },
    });
    const response = await GET(request);

    expect(response.status).toBe(200);
  });

  it("accepts x-cron-secret auth for manual trigger", async () => {
    const request = new Request("http://localhost:3000/api/cron/daily", {
      headers: {
        "x-cron-secret": "topsecret",
      },
    });
    const response = await GET(request);

    expect(response.status).toBe(200);
  });
});
