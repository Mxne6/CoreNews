import { describe, expect, test, vi } from "vitest";
import {
  buildAuthHeaders,
  buildEndpointUrl,
  didRunSucceedAfterRequestedAt,
  normalizeBaseUrl,
  parseArgs,
  runDailyNow,
} from "../../scripts/ops/run-daily-now-lib.mjs";

describe("run-daily-now-lib", () => {
  test("parseArgs uses defaults when no flags", () => {
    const parsed = parseArgs([]);
    expect(parsed.baseUrl).toBe("http://localhost:3000");
    expect(parsed.secret).toBeUndefined();
    expect(parsed.help).toBe(false);
  });

  test("parseArgs supports url and secret flags", () => {
    const parsed = parseArgs([
      "--url=https://core-news.example.com/",
      "--secret=my-secret",
    ]);
    expect(parsed.baseUrl).toBe("https://core-news.example.com/");
    expect(parsed.secret).toBe("my-secret");
  });

  test("normalizeBaseUrl trims trailing slash", () => {
    expect(normalizeBaseUrl("https://core-news.example.com/")).toBe(
      "https://core-news.example.com",
    );
  });

  test("buildEndpointUrl appends api path correctly", () => {
    expect(buildEndpointUrl("https://core-news.example.com/", "/api/cron/daily")).toBe(
      "https://core-news.example.com/api/cron/daily",
    );
  });

  test("buildAuthHeaders sets both bearer and legacy headers", () => {
    expect(buildAuthHeaders("abc123")).toEqual({
      Authorization: "Bearer abc123",
      "x-cron-secret": "abc123",
    });
  });

  test("didRunSucceedAfterRequestedAt returns true for fresh success", () => {
    const nowIso = "2026-03-02T11:34:34.399Z";
    const latestRun = {
      status: "success",
      startedAt: "2026-03-02T11:34:40.000Z",
    };
    expect(didRunSucceedAfterRequestedAt(latestRun, nowIso)).toBe(true);
  });

  test("didRunSucceedAfterRequestedAt returns false for stale or failed runs", () => {
    const nowIso = "2026-03-02T11:34:34.399Z";
    expect(
      didRunSucceedAfterRequestedAt(
        { status: "failed", startedAt: "2026-03-02T11:35:00.000Z" },
        nowIso,
      ),
    ).toBe(false);
    expect(
      didRunSucceedAfterRequestedAt(
        { status: "success", startedAt: "2026-03-02T11:00:00.000Z" },
        nowIso,
      ),
    ).toBe(false);
  });

  test("runDailyNow continues health checks when trigger request times out", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("fetch failed"))
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            runs: [{ status: "success", startedAt: "2099-01-01T00:00:00.000Z" }],
          }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ generatedAt: "2099-01-01T00:00:00.000Z", events: [] }),
      });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await runDailyNow({
      baseUrl: "http://localhost:3000",
      secret: "secret",
    });

    expect(result.trigger.ok).toBe(false);
    expect(result.trigger.status).toBe(0);
    expect(result.health.ok).toBe(true);
    expect(result.effectiveSuccess).toBe(true);
  });
});
