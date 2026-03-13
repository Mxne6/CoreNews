import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const hasRequiredEnvMock = vi.hoisted(() => vi.fn(() => true));
const getSupabaseAdminClientMock = vi.hoisted(() => vi.fn());
const defaultPipelineStoreMock = vi.hoisted(() => ({
  snapshots: [
    {
      generatedAt: new Date("2026-03-03T00:00:00.000Z"),
      homePayload: [
        {
          id: "fallback:event-1",
          category: "tech",
          canonicalTitle: "Fallback Event 1",
          hotScore: 66.5,
        },
      ],
      categoryPayloads: {},
    },
  ],
  events: [],
  summaries: [],
  articles: [],
  pipelineRuns: [],
}));

vi.mock("@/lib/config/env", () => ({
  hasRequiredEnv: hasRequiredEnvMock,
}));

vi.mock("@/lib/db/supabase-admin", () => ({
  getSupabaseAdminClient: getSupabaseAdminClientMock,
}));

vi.mock("@/lib/pipeline/run-daily", () => ({
  defaultPipelineStore: defaultPipelineStoreMock,
}));

function createNeverResolvingClient() {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          order: () => ({
            limit: () => ({
              maybeSingle: () => new Promise<never>(() => undefined),
            }),
          }),
        }),
      }),
    }),
  };
}

describe("readHomeSnapshot timeout fallback", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    getSupabaseAdminClientMock.mockReturnValue(createNeverResolvingClient());
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("falls back to in-memory snapshot when supabase query hangs", async () => {
    const { readHomeSnapshot, invalidateReadModelCache } = await import("@/lib/pipeline/read-model");
    invalidateReadModelCache();

    let settled = false;
    const pending = readHomeSnapshot().then((value) => {
      settled = true;
      return value;
    });

    await vi.advanceTimersByTimeAsync(20_000);
    await Promise.resolve();

    expect(settled).toBe(true);
    const result = await pending;
    expect(result.events[0]?.id).toBe("fallback:event-1");
  });
});

