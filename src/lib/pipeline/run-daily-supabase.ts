import { getEnv, hasRequiredEnv } from "@/lib/config/env";
import { getSupabaseAdminClient } from "@/lib/db/supabase-admin";
import { DashScopeClient } from "@/lib/llm/dashscope";
import { ingestArticlesFromSources, type ActiveSource } from "@/lib/pipeline/article-ingest";
import { aggregateEventsRolling } from "@/lib/pipeline/event-aggregate";
import {
  createPipelineRepository,
  type PipelineRunMetrics,
  type SourceErrorPayload,
} from "@/lib/pipeline/repository";
import { buildSnapshotRows, type SnapshotEvent } from "@/lib/pipeline/snapshot-builder";
import { fetchRss } from "@/lib/rss/fetch-rss";

type SupabaseClient = ReturnType<typeof getSupabaseAdminClient>;

type RecentArticleRow = {
  id: number;
  source_id: number;
  title: string;
  normalized_title: string;
  published_at: string | null;
  published_at_fallback: string;
};

type UpsertedEventRow = {
  id: number;
  event_stable_key: string;
  canonical_title: string;
  category: string;
  hot_score: number;
  article_count: number;
};

function buildFallbackSummary(articleCount: number): string {
  return `This event has ${articleCount} related reports in the last 24-72 hours.`;
}

function createDashScopeClientOrNull() {
  const key = getEnv().DASHSCOPE_API_KEY?.trim();
  if (!key) {
    return null;
  }
  return new DashScopeClient(key, "qwen-max");
}

async function loadActiveSources(client: SupabaseClient): Promise<ActiveSource[]> {
  const { data, error } = await client
    .from("sources")
    .select("id,rss_url,category,authority_weight")
    .eq("is_active", true);
  if (error) {
    throw new Error(`load_active_sources_failed: ${error.message}`);
  }
  return (data ?? []) as ActiveSource[];
}

async function loadRecentArticles(
  client: SupabaseClient,
  now: Date,
  windowDays: number,
): Promise<RecentArticleRow[]> {
  const since = new Date(now.getTime() - windowDays * 24 * 3_600_000).toISOString();
  const { data, error } = await client
    .from("articles")
    .select("id,source_id,title,normalized_title,published_at,published_at_fallback")
    .gte("fetched_at", since)
    .order("fetched_at", { ascending: false })
    .limit(5000);
  if (error) {
    throw new Error(`load_recent_articles_failed: ${error.message}`);
  }
  return (data ?? []) as RecentArticleRow[];
}

async function upsertEventsAndMappings(
  client: SupabaseClient,
  aggregated: ReturnType<typeof aggregateEventsRolling>,
  runId: number,
  dashScopeClient: DashScopeClient | null,
) {
  if (aggregated.events.length === 0) {
    return { snapshotEvents: [] as SnapshotEvent[] };
  }

  const eventPayload = aggregated.events.map((event) => ({
    event_stable_key: event.eventStableKey,
    canonical_title: event.canonicalTitle,
    category: event.category,
    hot_score: event.hotScore,
    article_count: event.articleCount,
    first_published_at: event.firstPublishedAt,
    last_published_at: event.lastPublishedAt,
    window_start: event.firstPublishedAt,
    window_end: event.lastPublishedAt,
    status: "active",
    scoring_version: "v1",
    snapshot_run_id: runId,
  }));

  const { data: upsertedEvents, error: eventError } = await client
    .from("events")
    .upsert(eventPayload, { onConflict: "event_stable_key" })
    .select("id,event_stable_key,canonical_title,category,hot_score,article_count");
  if (eventError) {
    throw new Error(`upsert_events_failed: ${eventError.message}`);
  }

  const eventIdByStableKey = new Map<string, number>();
  for (const event of upsertedEvents ?? []) {
    eventIdByStableKey.set(event.event_stable_key as string, event.id as number);
  }

  const eventArticleRows = aggregated.eventMappings.flatMap((mapping) => {
    const eventId = eventIdByStableKey.get(mapping.eventStableKey);
    if (!eventId) {
      return [];
    }
    return mapping.articleIds.map((articleId) => ({
      event_id: eventId,
      article_id: articleId,
    }));
  });
  if (eventArticleRows.length > 0) {
    const { error: mappingError } = await client
      .from("event_articles")
      .upsert(eventArticleRows, { onConflict: "event_id,article_id" });
    if (mappingError) {
      throw new Error(`upsert_event_articles_failed: ${mappingError.message}`);
    }
  }

  const aggregatedByStableKey = new Map(
    aggregated.events.map((event) => [event.eventStableKey, event]),
  );
  const summaryRows: Array<{
    event_id: number;
    summary_cn: string;
    model_name: string;
    model_version: string;
    summary_version: string;
  }> = [];
  const summaryByEventId = new Map<number, string>();

  for (const event of upsertedEvents ?? []) {
    const eventId = Number(event.id);
    const stableKey = String(event.event_stable_key);
    const info = aggregatedByStableKey.get(stableKey);
    const fallback = buildFallbackSummary(Number(event.article_count ?? 0));

    let summary = fallback;
    let modelName = "rule-fallback";
    let modelVersion = `rule-fallback-${runId}`;

    if (dashScopeClient && info) {
      try {
        summary = await dashScopeClient.summarizeEvent({
          title: info.canonicalTitle,
          category: info.category,
          articleCount: info.articleCount,
        });
        modelName = "dashscope";
        modelVersion = `qwen-max-run-${runId}`;
      } catch {
        // keep fallback summary
      }
    }

    summaryRows.push({
      event_id: eventId,
      summary_cn: summary,
      model_name: modelName,
      model_version: modelVersion,
      summary_version: `run-${runId}`,
    });
    summaryByEventId.set(eventId, summary);
  }

  if (summaryRows.length > 0) {
    const { error: summaryError } = await client
      .from("summaries")
      .upsert(summaryRows, { onConflict: "event_id,model_name,model_version" });
    if (summaryError) {
      throw new Error(`upsert_summaries_failed: ${summaryError.message}`);
    }
  }

  const snapshotEvents: SnapshotEvent[] = ((upsertedEvents ?? []) as UpsertedEventRow[]).map(
    (event) => ({
      id: String(event.id),
      category: String(event.category),
      canonicalTitle: String(event.canonical_title),
      hotScore: Number(event.hot_score),
      articleCount: Number(event.article_count),
      summaryCn:
        summaryByEventId.get(Number(event.id)) ??
        buildFallbackSummary(Number(event.article_count ?? 0)),
    }),
  );

  return { snapshotEvents };
}

export async function runDailySupabasePipeline(options?: {
  trigger?: string;
  now?: Date;
}) {
  if (!hasRequiredEnv()) {
    throw new Error("missing_required_env");
  }

  const now = options?.now ?? new Date();
  const trigger = options?.trigger ?? "vercel-cron";
  const client = getSupabaseAdminClient();
  const repository = createPipelineRepository(client as never);
  const dashScopeClient = createDashScopeClientOrNull();

  let runId = 0;
  const sourceErrors: SourceErrorPayload[] = [];

  try {
    const run = await repository.startPipelineRun(trigger);
    runId = run.id;

    const sources = await loadActiveSources(client);
    const ingestResult = await ingestArticlesFromSources({
      client: client as never,
      sources,
      fetchFeed: fetchRss,
      now,
    });
    sourceErrors.push(...ingestResult.sourceErrors);

    const recentArticles = await loadRecentArticles(client, now, 3);
    const aggregated = aggregateEventsRolling({
      articles: recentArticles.map((article) => ({
        id: article.id,
        sourceId: article.source_id,
        title: article.title,
        normalizedTitle: article.normalized_title,
        publishedAt: article.published_at,
        publishedAtFallback: article.published_at_fallback ?? now.toISOString(),
      })),
      sources: sources.map((source) => ({
        id: source.id,
        category: source.category,
        authorityWeight: source.authority_weight,
      })),
      now,
      windowDays: 3,
    });

    const { snapshotEvents } = await upsertEventsAndMappings(
      client,
      aggregated,
      runId,
      dashScopeClient,
    );
    const snapshotRows = buildSnapshotRows(runId, snapshotEvents, now.toISOString(), "v1");
    const { error: snapshotError } = await client
      .from("snapshots")
      .upsert(snapshotRows, { onConflict: "run_id,key" });
    if (snapshotError) {
      throw new Error(`upsert_snapshots_failed: ${snapshotError.message}`);
    }

    const metrics: PipelineRunMetrics = {
      articleCount: ingestResult.insertedOrUpdatedCount,
      eventCount: aggregated.events.length,
      summaryCount: aggregated.events.length,
    };
    await repository.finishPipelineRunSuccess(runId, metrics, sourceErrors);

    return {
      status: "success" as const,
      runId,
      metrics,
      sourceErrors,
    };
  } catch (error) {
    if (runId > 0) {
      await repository.finishPipelineRunFailure(
        runId,
        (error as Error).message,
        sourceErrors,
      );
    }
    throw error;
  }
}
