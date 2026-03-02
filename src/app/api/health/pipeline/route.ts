import { NextResponse } from "next/server";
import { defaultPipelineStore } from "@/lib/pipeline/run-daily";

export async function GET() {
  const runs = defaultPipelineStore.pipelineRuns.slice(-10).map((run) => ({
    startedAt: run.startedAt.toISOString(),
    endedAt: run.endedAt?.toISOString() ?? null,
    status: run.status,
    error: run.error ?? null,
    articleCount: run.articleCount,
    eventCount: run.eventCount,
    summaryCount: run.summaryCount,
  }));

  return NextResponse.json({
    total: runs.length,
    runs,
  });
}
