import { NextResponse } from "next/server";
import { defaultPipelineStore, runDailyPipeline } from "@/lib/pipeline/run-daily";
import { hasRequiredEnv } from "@/lib/config/env";
import { runDailySupabasePipeline } from "@/lib/pipeline/run-daily-supabase";
import { invalidateReadModelCache } from "@/lib/pipeline/read-model";

export const maxDuration = 300;

function readCronSecretFromRequest(request: Request): string | null {
  const authHeader = request.headers.get("authorization");
  if (authHeader) {
    const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/i);
    if (bearerMatch?.[1]) {
      return bearerMatch[1].trim();
    }
  }

  const legacyHeader = request.headers.get("x-cron-secret");
  return legacyHeader?.trim() || null;
}

export async function GET(request: Request) {
  const providedSecret = readCronSecretFromRequest(request);
  if (!process.env.CRON_SECRET || providedSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (hasRequiredEnv()) {
    const result = await runDailySupabasePipeline({ trigger: "vercel-cron" });
    invalidateReadModelCache();
    return NextResponse.json(result);
  }

  await runDailyPipeline({
    store: defaultPipelineStore,
    incomingArticles: [],
    now: new Date(),
  });
  invalidateReadModelCache();
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
