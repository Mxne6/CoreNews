import { hasRequiredEnv } from "@/lib/config/env";
import { getSupabaseAdminClient } from "@/lib/db/supabase-admin";
import { defaultPipelineStore } from "@/lib/pipeline/run-daily";

type RunRow = {
  id: number;
  status: "running" | "success" | "failed";
  started_at: string;
  ended_at: string | null;
  error: string | null;
  article_count: number;
  event_count: number;
  summary_count: number;
  source_errors_json: unknown;
};

type EventArticleMappingRow = {
  article_id: number;
};

type ArticleSourceRow = {
  id: number;
  source_id: number;
  url: string;
  title: string;
  published_at: string | null;
};

type SourceWeightRow = {
  id: number;
  authority_weight: number | null;
};

type DetailSourceItem = {
  sourceId: number;
  url: string;
  title: string;
  publishedAt: string | null;
  authorityWeight: number;
};

async function getLatestSuccessfulRunId() {
  const client = getSupabaseAdminClient();
  const { data, error } = await client
    .from("pipeline_runs")
    .select("id")
    .eq("status", "success")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    throw new Error(`load_latest_success_run_failed: ${error.message}`);
  }
  return data?.id as number | undefined;
}

async function getSnapshotPayloadForKey(key: string) {
  const runId = await getLatestSuccessfulRunId();
  if (!runId) {
    return null;
  }

  const client = getSupabaseAdminClient();
  const { data, error } = await client
    .from("snapshots")
    .select("payload_json,generated_at")
    .eq("run_id", runId)
    .eq("key", key)
    .maybeSingle();
  if (error) {
    throw new Error(`load_snapshot_failed: ${error.message}`);
  }
  return data;
}

export async function readHomeSnapshot() {
  if (hasRequiredEnv()) {
    const snapshot = await getSnapshotPayloadForKey("home");
    return {
      generatedAt: snapshot?.generated_at ?? null,
      sections: Object.entries((snapshot?.payload_json as Record<string, unknown[]>) ?? {}).map(
        ([category, events]) => ({
          category,
          events,
        }),
      ),
    };
  }

  const latest = defaultPipelineStore.snapshots.at(-1);
  const payload = (latest?.homePayload as Record<string, unknown[]>) ?? {};
  return {
    generatedAt: latest?.generatedAt.toISOString() ?? null,
    sections: Object.entries(payload).map(([category, events]) => ({ category, events })),
  };
}

export async function readCategorySnapshot(slug: string, page: number, pageSize: number) {
  let events: unknown[] = [];
  if (hasRequiredEnv()) {
    const snapshot = await getSnapshotPayloadForKey(`category:${slug}`);
    events = (snapshot?.payload_json as unknown[]) ?? [];
  } else {
    const latest = defaultPipelineStore.snapshots.at(-1);
    events = ((latest?.categoryPayloads as Record<string, unknown[]>) ?? {})[slug] ?? [];
  }

  const start = (page - 1) * pageSize;
  return {
    category: slug,
    page,
    pageSize,
    total: events.length,
    events: events.slice(start, start + pageSize),
  };
}

export async function readNewsDetail(eventId: string) {
  if (!hasRequiredEnv()) {
    const event = defaultPipelineStore.events.find((item) => item.id === eventId);
    if (!event) {
      return null;
    }
    const summary = defaultPipelineStore.summaries.find((item) => item.eventId === eventId);
    const sources = event.articleIds
      .map((articleId) => defaultPipelineStore.articles.find((item) => item.id === articleId))
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
      .map((item) => ({
        sourceId: item.sourceId,
        url: item.url,
        title: item.title,
        publishedAt: item.publishedAt.toISOString(),
        authorityWeight: 1,
      }))
      .sort((a, b) => b.authorityWeight - a.authorityWeight);
    return {
      id: event.id,
      title: event.canonicalTitle,
      category: event.category,
      hotScore: event.hotScore,
      summaryCn: summary?.summaryCn ?? "",
      sources,
    };
  }

  const client = getSupabaseAdminClient();
  const { data: event, error: eventError } = await client
    .from("events")
    .select("id,canonical_title,category,hot_score")
    .eq("id", Number(eventId))
    .maybeSingle();
  if (eventError) {
    throw new Error(`load_event_failed: ${eventError.message}`);
  }
  if (!event) {
    return null;
  }

  const { data: summaries, error: summaryError } = await client
    .from("summaries")
    .select("summary_cn,generated_at")
    .eq("event_id", event.id)
    .order("generated_at", { ascending: false })
    .limit(1);
  if (summaryError) {
    throw new Error(`load_summary_failed: ${summaryError.message}`);
  }

  const { data: mappings, error: mappingError } = await client
    .from("event_articles")
    .select("article_id")
    .eq("event_id", event.id);
  if (mappingError) {
    throw new Error(`load_event_articles_failed: ${mappingError.message}`);
  }

  const articleIds = ((mappings ?? []) as EventArticleMappingRow[]).map((item) => item.article_id);
  let sources: Array<{
    sourceId: number;
    url: string;
    title: string;
    publishedAt: string | null;
    authorityWeight: number;
  }> = [];
  if (articleIds.length > 0) {
    const { data: articles, error: articleError } = await client
      .from("articles")
      .select("id,source_id,url,title,published_at")
      .in("id", articleIds);
    if (articleError) {
      throw new Error(`load_articles_failed: ${articleError.message}`);
    }

    const articleRows = (articles ?? []) as ArticleSourceRow[];
    const sourceIds = [...new Set(articleRows.map((item) => item.source_id))];
    const { data: sourceRows } = await client
      .from("sources")
      .select("id,authority_weight")
      .in("id", sourceIds);
    const weightBySource = new Map<number, number>(
      ((sourceRows ?? []) as SourceWeightRow[]).map((item) => [
        item.id,
        Number(item.authority_weight ?? 1),
      ]),
    );

    sources = articleRows
      .map((item): DetailSourceItem => ({
        sourceId: item.source_id,
        url: String(item.url),
        title: String(item.title),
        publishedAt: item.published_at ?? null,
        authorityWeight: weightBySource.get(item.source_id) ?? 1,
      }))
      .sort((a, b) => {
        if (b.authorityWeight !== a.authorityWeight) {
          return b.authorityWeight - a.authorityWeight;
        }
        return (b.publishedAt ?? "").localeCompare(a.publishedAt ?? "");
      });
  }

  return {
    id: String(event.id),
    title: String(event.canonical_title),
    category: String(event.category),
    hotScore: Number(event.hot_score),
    summaryCn: (summaries?.[0]?.summary_cn as string | undefined) ?? "",
    sources,
  };
}

export async function readPipelineHealth(now = new Date()) {
  if (!hasRequiredEnv()) {
    const runs = defaultPipelineStore.pipelineRuns.slice(-10).map((run) => ({
      startedAt: run.startedAt.toISOString(),
      endedAt: run.endedAt?.toISOString() ?? null,
      status: run.status,
      error: run.error ?? null,
      articleCount: run.articleCount,
      eventCount: run.eventCount,
      summaryCount: run.summaryCount,
      sourceErrors: [],
    }));
    return {
      total: runs.length,
      runs,
      stale: false,
      degraded: runs.at(-1)?.status === "failed",
      latestRunStatus: runs.at(-1)?.status ?? null,
      latestSuccessAt: runs.findLast((run) => run.status === "success")?.endedAt ?? null,
    };
  }

  const client = getSupabaseAdminClient();
  const { data, error } = await client
    .from("pipeline_runs")
    .select(
      "id,status,started_at,ended_at,error,article_count,event_count,summary_count,source_errors_json",
    )
    .order("started_at", { ascending: false })
    .limit(10);
  if (error) {
    throw new Error(`load_pipeline_health_failed: ${error.message}`);
  }

  const runs = ((data ?? []) as RunRow[]).map((run) => ({
    startedAt: run.started_at,
    endedAt: run.ended_at,
    status: run.status,
    error: run.error,
    articleCount: run.article_count,
    eventCount: run.event_count,
    summaryCount: run.summary_count,
    sourceErrors: run.source_errors_json ?? [],
  }));
  const latestRun = runs[0];
  const latestSuccess = runs.find((run) => run.status === "success");
  const latestSuccessAt = latestSuccess?.endedAt ?? latestSuccess?.startedAt ?? null;

  let stale = true;
  if (latestSuccessAt) {
    stale = now.getTime() - new Date(latestSuccessAt).getTime() > 36 * 3_600_000;
  }

  return {
    total: runs.length,
    runs,
    stale,
    degraded: latestRun?.status === "failed",
    latestRunStatus: latestRun?.status ?? null,
    latestSuccessAt,
  };
}
