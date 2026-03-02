import { describe, expect, it, vi } from "vitest";
import {
  createPipelineRepository,
  type PipelineRunMetrics,
} from "@/lib/pipeline/repository";

type MockQueryResult = {
  data: Record<string, unknown> | null;
  error: { code?: string; message: string } | null;
};

function createMockClient(config: {
  insertResult?: MockQueryResult;
  updateResult?: MockQueryResult;
}) {
  const insert = vi.fn(() => ({
    select: vi.fn(() => ({
      single: vi.fn(async () => config.insertResult ?? { data: null, error: null }),
    })),
  }));

  const update = vi.fn(() => ({
    eq: vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn(async () => config.updateResult ?? { data: null, error: null }),
      })),
    })),
  }));

  return {
    from: vi.fn(() => ({
      insert,
      update,
    })),
    insert,
    update,
  };
}

describe("pipeline repository", () => {
  it("starts a running pipeline run", async () => {
    const client = createMockClient({
      insertResult: {
        data: { id: 10, status: "running" },
        error: null,
      },
    });
    const repository = createPipelineRepository(client as never);

    const run = await repository.startPipelineRun("vercel-cron");

    expect(run.id).toBe(10);
    expect(client.from).toHaveBeenCalledWith("pipeline_runs");
    expect(client.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "running",
        trigger: "vercel-cron",
      }),
    );
  });

  it("throws pipeline_locked when running lock conflicts", async () => {
    const client = createMockClient({
      insertResult: {
        data: null,
        error: { code: "23505", message: "duplicate key value violates unique constraint" },
      },
    });
    const repository = createPipelineRepository(client as never);

    await expect(repository.startPipelineRun("vercel-cron")).rejects.toThrow("pipeline_locked");
  });

  it("finalizes successful run with metrics and source errors", async () => {
    const client = createMockClient({
      updateResult: {
        data: { id: 10, status: "success" },
        error: null,
      },
    });
    const repository = createPipelineRepository(client as never);
    const metrics: PipelineRunMetrics = {
      articleCount: 3,
      eventCount: 2,
      summaryCount: 2,
    };
    const sourceErrors = [{ sourceId: 1, rssUrl: "https://example.com/rss", error: "timeout" }];

    const run = await repository.finishPipelineRunSuccess(10, metrics, sourceErrors);

    expect(run.status).toBe("success");
    expect(client.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "success",
        article_count: 3,
        event_count: 2,
        summary_count: 2,
        source_errors_json: sourceErrors,
      }),
    );
  });
});
