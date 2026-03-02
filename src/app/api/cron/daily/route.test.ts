import { describe, expect, it } from "vitest";
import { GET } from "@/app/api/cron/daily/route";

describe("GET /api/cron/daily", () => {
  it("rejects unauthorized requests", async () => {
    process.env.CRON_SECRET = "topsecret";
    const request = new Request("http://localhost:3000/api/cron/daily");
    const response = await GET(request);

    expect(response.status).toBe(401);
  });
});
