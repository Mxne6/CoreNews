import { describe, expect, it } from "vitest";
import { readPipelineHealth } from "@/lib/pipeline/read-model";

describe("GET /api/health/pipeline", () => {
  it("includes stale and degraded flags", async () => {
    const health = await readPipelineHealth(new Date("2026-03-02T08:00:00.000Z"));
    expect(typeof health.stale).toBe("boolean");
    expect(typeof health.degraded).toBe("boolean");
    expect(health).toHaveProperty("latestRunStatus");
    expect(health).toHaveProperty("latestSuccessAt");
  });
});
