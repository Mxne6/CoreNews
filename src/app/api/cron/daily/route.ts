import { NextResponse } from "next/server";
import { defaultPipelineStore, runDailyPipeline } from "@/lib/pipeline/run-daily";
import { hasRequiredEnv } from "@/lib/config/env";
import { runDailySupabasePipeline } from "@/lib/pipeline/run-daily-supabase";

export async function GET(request: Request) {
  const authHeader = request.headers.get("x-cron-secret");
  if (!process.env.CRON_SECRET || authHeader !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (hasRequiredEnv()) {
    const result = await runDailySupabasePipeline({ trigger: "vercel-cron" });
    return NextResponse.json(result);
  }

  await runDailyPipeline({
    store: defaultPipelineStore,
    incomingArticles: [],
    now: new Date(),
  });
  const latestRun = defaultPipelineStore.pipelineRuns.at(-1);
  return NextResponse.json({
    status: latestRun?.status ?? "unknown",
    runId: null,
    metrics: {
      articleCount: latestRun?.articleCount ?? 0,
      eventCount: latestRun?.eventCount ?? 0,
      summaryCount: latestRun?.summaryCount ?? 0,
    },
    sourceErrors: [],
  });
}
