import { NextResponse } from "next/server";
import { defaultPipelineStore, runDailyPipeline } from "@/lib/pipeline/run-daily";

export async function GET(request: Request) {
  const authHeader = request.headers.get("x-cron-secret");
  if (!process.env.CRON_SECRET || authHeader !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  await runDailyPipeline({
    store: defaultPipelineStore,
    incomingArticles: [],
    now: new Date(),
  });

  const latestRun = defaultPipelineStore.pipelineRuns.at(-1);
  return NextResponse.json({
    status: latestRun?.status ?? "unknown",
    metrics: {
      articleCount: latestRun?.articleCount ?? 0,
      eventCount: latestRun?.eventCount ?? 0,
      summaryCount: latestRun?.summaryCount ?? 0,
    },
  });
}
