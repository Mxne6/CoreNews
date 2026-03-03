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
import { SCORING_VERSION } from "@/lib/pipeline/scoring";
import { buildSnapshotRows, type SnapshotEvent } from "@/lib/pipeline/snapshot-builder";
import { fetchRss } from "@/lib/rss/fetch-rss";
import { getCategoryLabel as getUiCategoryLabel, normalizeCategory } from "@/lib/ui/categories";

type SupabaseClient = ReturnType<typeof getSupabaseAdminClient>;
type AggregationResult = Awaited<ReturnType<typeof aggregateEventsRolling>>;

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
  last_published_at: string | null;
};

type ExistingEventRow = {
  id: number;
  event_stable_key: string;
  canonical_title: string;
  article_count: number;
  last_published_at: string | null;
  tags: string[] | null;
};

type ExistingSummaryRow = {
  event_id: number;
  summary_cn: string;
  model_name: string;
  model_version: string;
  generated_at: string;
};

type ReusableSummaryPayload = {
  summaryCn: string;
  modelName: string;
  modelVersion: string;
};

const CATEGORY_LABELS: Record<string, string> = {
  ai: "AI",
  tech: "科技",
  business: "商业",
  markets: "市场",
  policy: "政策",
  china: "中国",
  us: "美国",
  japan: "日本",
  europe: "欧洲",
  world: "国际",
  international: "国际",
  energy: "能源",
  health: "医疗",
};

function getCategoryLabel(category: string): string {
  return getUiCategoryLabel(normalizeCategory(category));
}

const WEAK_TAGS = new Set([
  "热点",
  "焦点",
  "进展",
  "影响",
  "更新",
  "快讯",
  "关注",
  "动态",
  "事件",
  "要闻",
  "最新",
  "突发",
  "消息",
  "新闻",
  "followup",
  "update",
  "news",
  "topic",
]);

const CATEGORY_TAG_FALLBACKS: Record<string, string[]> = {
  ai: ["大模型", "算力芯片", "应用落地"],
  tech: ["技术升级", "芯片产业", "产品发布"],
  business: ["财报表现", "融资并购", "企业经营"],
  markets: ["股债波动", "汇率变化", "商品价格"],
  policy: ["政策发布", "监管调整", "执行细则"],
  china: ["宏观经济", "地方政策", "产业动向"],
  us: ["美联储", "美国政策", "美股市场"],
  japan: ["日元汇率", "日本政策", "产业动态"],
  europe: ["欧盟政策", "欧洲市场", "地缘局势"],
  world: ["地缘冲突", "国际关系", "全球市场"],
  international: ["地缘冲突", "国际关系", "全球市场"],
  energy: ["原油价格", "电力市场", "新能源"],
  health: ["公共卫生", "医疗监管", "药械审批"],
};

const FLAT_CATEGORY_TAG_FALLBACKS: Record<string, string[]> = {
  domestic: ["国内", "民生", "地方动态"],
  international: ["国际", "全球", "外交"],
  "current-affairs": ["时政", "政策", "监管"],
  society: ["社会", "公共事件", "民生"],
  finance: ["财经", "市场", "宏观经济"],
  tech: ["科技", "产业", "产品发布"],
  sports: ["体育", "赛事", "冠军"],
  entertainment: ["娱乐", "影视", "明星"],
  "culture-education": ["文化教育", "学校", "艺术"],
  lifestyle: ["生活", "健康", "消费"],
};

function normalizeTagValue(raw: string): string {
  return raw
    .replace(/[【】\[\]（）()]/g, "")
    .replace(/[“”"'`]/g, "")
    .replace(/\s+/g, "")
    .trim();
}

function isMeaningfulTag(tag: string): boolean {
  if (WEAK_TAGS.has(tag) || WEAK_TAGS.has(tag.toLowerCase())) {
    return false;
  }
  if (/^[\u4e00-\u9fa5]{2,8}$/.test(tag)) {
    return true;
  }
  if (/^[A-Za-z0-9][A-Za-z0-9\-+]{1,15}$/.test(tag)) {
    return true;
  }
  return false;
}

function sanitizeTag(raw: string): string | null {
  const normalized = normalizeTagValue(raw);
  if (!normalized) {
    return null;
  }
  if (!isMeaningfulTag(normalized)) {
    return null;
  }
  return normalized;
}

function extractTagCandidatesFromText(text: string): string[] {
  if (!text.trim()) {
    return [];
  }

  const bracketMatches = [...text.matchAll(/[【\[]([^【\]】]{2,14})[】\]]/g)].map((match) =>
    match[1].trim(),
  );
  const normalized = text
    .replace(/[【】\[\]（）()]/g, " ")
    .replace(/[·|/,:;，。！？、]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const chunks = normalized.split(" ").filter(Boolean);
  return [...bracketMatches, ...chunks];
}

function collectCandidateTags(input: { title: string; summary?: string }): string[] {
  return [
    ...extractTagCandidatesFromText(input.title),
    ...extractTagCandidatesFromText(input.summary ?? ""),
  ];
}

function ensureDisplayTags(raw: string[], category: string): string[] {
  const normalizedCategory = normalizeCategory(category);
  const categoryLabel = getCategoryLabel(normalizedCategory);
  const categoryDefaults =
    FLAT_CATEGORY_TAG_FALLBACKS[normalizedCategory] ??
    CATEGORY_TAG_FALLBACKS[normalizedCategory] ??
    [categoryLabel];
  const seen = new Set<string>();
  const tags: string[] = [];

  for (const rawTag of raw) {
    const cleaned = sanitizeTag(rawTag);
    if (!cleaned || cleaned === categoryLabel || seen.has(cleaned)) {
      continue;
    }
    seen.add(cleaned);
    tags.push(cleaned);
    if (tags.length >= 3) {
      return tags;
    }
  }

  const categoryTag = sanitizeTag(categoryLabel);
  if (categoryTag && !seen.has(categoryTag)) {
    seen.add(categoryTag);
    tags.push(categoryTag);
  }

  for (const fallback of categoryDefaults) {
    if (tags.length >= 3) {
      break;
    }
    const cleaned = sanitizeTag(fallback);
    if (!cleaned || seen.has(cleaned)) {
      continue;
    }
    seen.add(cleaned);
    tags.push(cleaned);
  }

  if (tags.length < 2 && categoryTag && !tags.includes(categoryTag)) {
    tags.unshift(categoryTag);
  }

  return tags.slice(0, 3);
}

export function buildFallbackTags(input: {
  title: string;
  category: string;
  summary?: string;
}): string[] {
  return ensureDisplayTags(collectCandidateTags(input), input.category);
}

function normalizeStoredTags(raw: unknown): string[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.map((item) => String(item).trim()).filter(Boolean);
}

const MAX_DASHSCOPE_SUMMARIES_PER_RUN = 40;
const MAX_DASHSCOPE_TITLE_TRANSLATIONS_PER_RUN = 40;
const MAX_AMBIGUITY_RESOLVER_CALLS_PER_RUN = 40;
const SOURCE_FAILURE_DEACTIVATE_THRESHOLD = 3;
const INACTIVE_SOURCE_RETRY_INTERVAL_HOURS = 24;

function buildFallbackSummary(input: {
  title: string;
  category: string;
  articleCount: number;
}): string {
  return `${input.title} 在过去 24-72 小时内持续发酵，已汇聚 ${input.articleCount} 条相关报道。当前焦点集中在关键进展与潜在影响，建议继续关注后续官方披露与跨来源交叉验证。`;
}

function createDashScopeClientOrNull() {
  const key = getEnv().DASHSCOPE_API_KEY?.trim();
  if (!key) {
    return null;
  }
  return new DashScopeClient(key, "qwen-max");
}

async function loadSources(client: SupabaseClient): Promise<ActiveSource[]> {
  const { data, error } = await client
    .from("sources")
    .select("id,rss_url,category,authority_weight,is_active,consecutive_failures,last_failed_at");
  if (error) {
    throw new Error(`load_sources_failed: ${error.message}`);
  }
  return (data ?? []) as ActiveSource[];
}

export function shouldRetryInactiveSource(
  lastFailedAt: string | null | undefined,
  now: Date,
  retryIntervalHours: number,
) {
  if (!lastFailedAt) {
    return true;
  }
  const parsed = new Date(lastFailedAt);
  if (Number.isNaN(parsed.getTime())) {
    return true;
  }
  return now.getTime() - parsed.getTime() >= retryIntervalHours * 3_600_000;
}

export function selectSourcesForIngestion(
  sources: ActiveSource[],
  now: Date,
  retryIntervalHours: number,
) {
  return sources.filter((source) => {
    if (source.is_active ?? true) {
      return true;
    }
    return shouldRetryInactiveSource(source.last_failed_at, now, retryIntervalHours);
  });
}

export function pickTopStableKeysByHotScore(
  events: Array<{ eventStableKey: string; hotScore: number }>,
  limit: number,
) {
  return new Set(
    events
      .slice()
      .sort((a, b) => Number(b.hotScore) - Number(a.hotScore))
      .slice(0, Math.max(0, limit))
      .map((item) => item.eventStableKey),
  );
}

function toEpochMs(value: string | null | undefined): number | null {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed.getTime();
}

export function isEventUnchangedForReuse(
  existing: Pick<ExistingEventRow, "article_count" | "last_published_at"> | undefined,
  incoming: Pick<AggregationResult["events"][number], "articleCount" | "lastPublishedAt">,
) {
  if (!existing) {
    return false;
  }
  const sameArticleCount = Number(existing.article_count ?? 0) === incoming.articleCount;
  const existingLastPublishedAt = toEpochMs(existing.last_published_at);
  const incomingLastPublishedAt = toEpochMs(incoming.lastPublishedAt);
  const sameLastPublishedAt =
    existingLastPublishedAt !== null &&
    incomingLastPublishedAt !== null &&
    existingLastPublishedAt === incomingLastPublishedAt;
  return sameArticleCount && sameLastPublishedAt;
}

export function buildReusableSummaryByStableKey(input: {
  unchangedStableKeys: Set<string>;
  existingEventByStableKey: ReadonlyMap<string, { id: number }>;
  latestSummaryByEventId: ReadonlyMap<number, ReusableSummaryPayload>;
}) {
  const reusableSummaryByStableKey = new Map<string, ReusableSummaryPayload>();
  for (const stableKey of input.unchangedStableKeys) {
    const eventId = input.existingEventByStableKey.get(stableKey)?.id;
    if (!eventId) {
      continue;
    }
    const summary = input.latestSummaryByEventId.get(eventId);
    if (!summary) {
      continue;
    }
    reusableSummaryByStableKey.set(stableKey, summary);
  }
  return reusableSummaryByStableKey;
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
  aggregated: AggregationResult,
  runId: number,
  dashScopeClient: DashScopeClient | null,
) {
  if (aggregated.events.length === 0) {
    return { snapshotEvents: [] as SnapshotEvent[] };
  }

  const stableKeys = aggregated.events.map((event) => event.eventStableKey);
  const existingEventByStableKey = new Map<string, ExistingEventRow>();
  if (stableKeys.length > 0) {
    const { data: existingEvents, error: existingEventError } = await client
      .from("events")
      .select("id,event_stable_key,canonical_title,article_count,last_published_at,tags")
      .in("event_stable_key", stableKeys);
    if (existingEventError) {
      throw new Error(`load_existing_events_failed: ${existingEventError.message}`);
    }
    for (const item of (existingEvents ?? []) as ExistingEventRow[]) {
      existingEventByStableKey.set(item.event_stable_key, item);
    }
  }

  const unchangedStableKeys = new Set<string>();
  const localizedTitleByStableKey = new Map<string, string>();
  const llmTitleEligibleStableKeys = pickTopStableKeysByHotScore(
    aggregated.events,
    MAX_DASHSCOPE_TITLE_TRANSLATIONS_PER_RUN,
  );

  for (const event of aggregated.events) {
    const existing = existingEventByStableKey.get(event.eventStableKey);
    if (isEventUnchangedForReuse(existing, event)) {
      unchangedStableKeys.add(event.eventStableKey);
      localizedTitleByStableKey.set(
        event.eventStableKey,
        existing?.canonical_title?.trim() || event.canonicalTitle,
      );
      continue;
    }

    let localizedTitle = event.canonicalTitle;
    if (dashScopeClient && llmTitleEligibleStableKeys.has(event.eventStableKey)) {
      try {
        localizedTitle = await dashScopeClient.translateTitleToChinese({
          title: event.canonicalTitle,
          category: event.category,
        });
      } catch {
        localizedTitle = event.canonicalTitle;
      }
    }
    localizedTitleByStableKey.set(event.eventStableKey, localizedTitle.trim() || event.canonicalTitle);
  }

  const unchangedEventIds = [...unchangedStableKeys]
    .map((stableKey) => existingEventByStableKey.get(stableKey)?.id)
    .filter((item): item is number => typeof item === "number");
  const latestSummaryByEventId = new Map<number, ReusableSummaryPayload>();
  if (unchangedEventIds.length > 0) {
    const { data: existingSummaries, error: existingSummariesError } = await client
      .from("summaries")
      .select("event_id,summary_cn,model_name,model_version,generated_at")
      .in("event_id", unchangedEventIds)
      .order("event_id", { ascending: true })
      .order("generated_at", { ascending: false });
    if (existingSummariesError) {
      throw new Error(`load_existing_summaries_failed: ${existingSummariesError.message}`);
    }
    for (const item of (existingSummaries ?? []) as ExistingSummaryRow[]) {
      if (latestSummaryByEventId.has(item.event_id)) {
        continue;
      }
      latestSummaryByEventId.set(item.event_id, {
        summaryCn: item.summary_cn,
        modelName: item.model_name,
        modelVersion: item.model_version,
      });
    }
  }

  const reusableSummaryByStableKey = buildReusableSummaryByStableKey({
    unchangedStableKeys,
    existingEventByStableKey,
    latestSummaryByEventId,
  });

  const eventPayload = aggregated.events.map((event) => ({
    event_stable_key: event.eventStableKey,
    canonical_title: localizedTitleByStableKey.get(event.eventStableKey) ?? event.canonicalTitle,
    category: event.category,
    hot_score: event.hotScore,
    article_count: event.articleCount,
    first_published_at: event.firstPublishedAt,
    last_published_at: event.lastPublishedAt,
    window_start: event.firstPublishedAt,
    window_end: event.lastPublishedAt,
    status: "active",
    scoring_version: SCORING_VERSION,
    snapshot_run_id: runId,
  }));

  const { data: upsertedEvents, error: eventError } = await client
    .from("events")
    .upsert(eventPayload, { onConflict: "event_stable_key" })
    .select("id,event_stable_key,canonical_title,category,hot_score,article_count,last_published_at");
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

  const aggregatedByStableKey = new Map(aggregated.events.map((event) => [event.eventStableKey, event]));
  const summaryRows: Array<{
    event_id: number;
    summary_cn: string;
    model_name: string;
    model_version: string;
    summary_version: string;
  }> = [];
  const summaryByEventId = new Map<number, string>();
  const tagsByEventId = new Map<number, string[]>();
  const llmSummaryEligibleStableKeys = pickTopStableKeysByHotScore(
    aggregated.events,
    MAX_DASHSCOPE_SUMMARIES_PER_RUN,
  );

  for (const event of upsertedEvents ?? []) {
    const eventId = Number(event.id);
    const stableKey = String(event.event_stable_key);
    const info = aggregatedByStableKey.get(stableKey);
    const titleForSummary =
      localizedTitleByStableKey.get(stableKey) ?? info?.canonicalTitle ?? String(event.canonical_title);

    const reusableSummary = reusableSummaryByStableKey.get(stableKey);
    if (reusableSummary) {
      summaryByEventId.set(eventId, reusableSummary.summaryCn);
      const existingTags = normalizeStoredTags(existingEventByStableKey.get(stableKey)?.tags);
      if (existingTags.length > 0) {
        tagsByEventId.set(eventId, ensureDisplayTags(existingTags, info?.category ?? String(event.category)));
      } else {
        tagsByEventId.set(
          eventId,
          buildFallbackTags({
            title: titleForSummary,
            category: info?.category ?? String(event.category),
            summary: reusableSummary.summaryCn,
          }),
        );
      }
      continue;
    }

    const fallback = buildFallbackSummary({
      title: titleForSummary,
      category: info?.category ?? String(event.category),
      articleCount: Number(event.article_count ?? 0),
    });

    let summary = fallback;
    let modelName = "rule-fallback";
    let modelVersion = `rule-fallback-${runId}`;

    if (dashScopeClient && info && llmSummaryEligibleStableKeys.has(stableKey)) {
      try {
        const llmResult = await dashScopeClient.summarizeEventWithTags({
          title: titleForSummary,
          category: info.category,
          articleCount: info.articleCount,
        });
        summary = llmResult.summary;
        if (llmResult.tags.length > 0) {
          tagsByEventId.set(
            eventId,
            ensureDisplayTags(
              [
                ...llmResult.tags,
                ...collectCandidateTags({
                  title: titleForSummary,
                  summary,
                }),
              ],
              info.category,
            ),
          );
        }
        modelName = "dashscope";
        modelVersion = `qwen-max-run-${runId}`;
      } catch {
        // Keep fallback summary.
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

    if (!tagsByEventId.has(eventId)) {
      tagsByEventId.set(
        eventId,
        buildFallbackTags({
          title: titleForSummary,
          category: info?.category ?? String(event.category),
          summary,
        }),
      );
    }
  }

  if (summaryRows.length > 0) {
    const { error: summaryError } = await client
      .from("summaries")
      .upsert(summaryRows, { onConflict: "event_id,model_name,model_version" });
    if (summaryError) {
      throw new Error(`upsert_summaries_failed: ${summaryError.message}`);
    }
  }

  const eventTagRows = ((upsertedEvents ?? []) as UpsertedEventRow[]).map((event) => ({
    id: Number(event.id),
    tags: tagsByEventId.get(Number(event.id)) ?? [],
  }));
  if (eventTagRows.length > 0) {
    const { error: eventTagError } = await client
      .from("events")
      .upsert(eventTagRows, { onConflict: "id" });
    if (eventTagError) {
      throw new Error(`upsert_event_tags_failed: ${eventTagError.message}`);
    }
  }

  const snapshotEvents: SnapshotEvent[] = ((upsertedEvents ?? []) as UpsertedEventRow[]).map((event) => {
    const stableKey = String(event.event_stable_key);
    const info = aggregatedByStableKey.get(stableKey);
    const normalizedCategory = normalizeCategory(String(event.category));
    return {
      id: String(event.id),
      category: normalizedCategory,
      categories: [normalizedCategory],
      canonicalTitle: String(event.canonical_title),
      hotScore: Number(event.hot_score),
      articleCount: Number(event.article_count),
      lastPublishedAt: event.last_published_at ?? undefined,
      tags: tagsByEventId.get(Number(event.id)) ?? [],
      summaryCn:
        summaryByEventId.get(Number(event.id)) ??
        buildFallbackSummary({
          title: String(event.canonical_title),
          category: String(event.category),
          articleCount: Number(event.article_count ?? 0),
        }),
    };
  });

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

    const sources = await loadSources(client);
    const ingestionSources = selectSourcesForIngestion(
      sources,
      now,
      INACTIVE_SOURCE_RETRY_INTERVAL_HOURS,
    );

    const ingestResult = await ingestArticlesFromSources({
      client: client as never,
      sources: ingestionSources,
      fetchFeed: fetchRss,
      now,
      failureDeactivateThreshold: SOURCE_FAILURE_DEACTIVATE_THRESHOLD,
    });
    sourceErrors.push(...ingestResult.sourceErrors);

    const recentArticles = await loadRecentArticles(client, now, 3);
    const aggregated = await aggregateEventsRolling({
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
      ambiguityResolver: dashScopeClient,
      ambiguityLimit: MAX_AMBIGUITY_RESOLVER_CALLS_PER_RUN,
    });

    const { snapshotEvents } = await upsertEventsAndMappings(client, aggregated, runId, dashScopeClient);
    const snapshotRows = buildSnapshotRows(runId, snapshotEvents, now.toISOString(), SCORING_VERSION);
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
      await repository.finishPipelineRunFailure(runId, (error as Error).message, sourceErrors);
    }
    throw error;
  }
}
