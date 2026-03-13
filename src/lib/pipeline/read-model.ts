import { hasRequiredEnv } from "@/lib/config/env";
import { getSupabaseAdminClient } from "@/lib/db/supabase-admin";
import { defaultPipelineStore } from "@/lib/pipeline/run-daily";
import { normalizeCategory } from "@/lib/ui/categories";

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
  sources?: SourceWeightRow | SourceWeightRow[] | null;
};

type SourceWeightRow = {
  id: number;
  name: string;
  authority_weight: number | null;
};

type DetailSourceItem = {
  sourceId: number;
  sourceName: string;
  url: string;
  title: string;
  publishedAt: string | null;
  authorityWeight: number;
};

type NewsDetailPayload = {
  id: string;
  title: string;
  category: string;
  hotScore: number;
  summaryCn: string;
  tags: string[];
  sources: DetailSourceItem[];
};

type HomeEventPayload = {
  id: string;
  category: string;
  categories?: string[];
  tags?: string[];
  canonicalTitle: string;
  hotScore?: number;
  summaryCn?: string;
  lastPublishedAt?: string;
};

const LEGACY_CATEGORY_KEYS_BY_FLAT: Record<string, string[]> = {
  domestic: ["china"],
  international: ["world", "us", "japan", "europe"],
  "current-affairs": ["policy"],
  society: [],
  finance: ["business", "markets", "energy"],
  tech: ["ai"],
  sports: [],
  entertainment: [],
  "culture-education": [],
  lifestyle: ["health"],
};

type ReadModelClient = ReturnType<typeof getSupabaseAdminClient>;

type ReadCacheValue = {
  expiresAt: number;
  value: unknown;
};

type ReadModelCacheStore = {
  values: Map<string, ReadCacheValue>;
  inFlight: Map<string, Promise<unknown>>;
};

const READ_CACHE_TTL_MS = 30_000;
const RUN_ID_CACHE_TTL_MS = 10_000;
const DEFAULT_READ_MODEL_LOADER_TIMEOUT_MS = 5_000;
const READ_MODEL_LOADER_TIMEOUT_MS = (() => {
  const raw = Number(process.env.READ_MODEL_LOADER_TIMEOUT_MS ?? DEFAULT_READ_MODEL_LOADER_TIMEOUT_MS);
  if (!Number.isFinite(raw)) {
    return DEFAULT_READ_MODEL_LOADER_TIMEOUT_MS;
  }
  return Math.min(20_000, Math.max(1_000, Math.trunc(raw)));
})();

declare global {
  var __coreNewsReadModelCacheStore: ReadModelCacheStore | undefined;
}

function getReadModelCacheStore(): ReadModelCacheStore {
  if (!globalThis.__coreNewsReadModelCacheStore) {
    globalThis.__coreNewsReadModelCacheStore = {
      values: new Map<string, ReadCacheValue>(),
      inFlight: new Map<string, Promise<unknown>>(),
    };
  }
  return globalThis.__coreNewsReadModelCacheStore;
}

async function readThroughCache<T>(
  key: string,
  loader: () => Promise<T>,
  ttlMs: number,
): Promise<T> {
  const store = getReadModelCacheStore();
  const current = store.values.get(key);
  if (current && current.expiresAt > Date.now()) {
    return current.value as T;
  }

  const existingInFlight = store.inFlight.get(key);
  if (existingInFlight) {
    return (await existingInFlight) as T;
  }

  const promise = withTimeout(loader(), READ_MODEL_LOADER_TIMEOUT_MS, key)
    .then((value) => {
      store.values.set(key, {
        value,
        expiresAt: Date.now() + ttlMs,
      });
      store.inFlight.delete(key);
      return value;
    })
    .catch((error) => {
      store.inFlight.delete(key);
      throw error;
    });

  store.inFlight.set(key, promise);
  return (await promise) as T;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`read_model_timeout:${label}`));
    }, timeoutMs);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

export function invalidateReadModelCache() {
  const store = getReadModelCacheStore();
  store.values.clear();
  store.inFlight.clear();
}

function normalizeHomePayload(raw: unknown): HomeEventPayload[] {
  const normalizeEvent = (
    event: unknown,
    fallbackCategory?: string,
  ): HomeEventPayload | null => {
    if (!event || typeof event !== "object") {
      return null;
    }
    const row = event as Record<string, unknown>;
    const category = normalizeCategory(String(row.category ?? fallbackCategory ?? "international"));

    const hotScore =
      typeof row.hotScore === "number"
        ? row.hotScore
        : Number.isFinite(Number(row.hotScore))
          ? Number(row.hotScore)
          : undefined;

    return {
      id: String(row.id ?? ""),
      category,
      categories: [category],
      tags: normalizeTags(row.tags),
      canonicalTitle: String(row.canonicalTitle ?? ""),
      hotScore,
      summaryCn: typeof row.summaryCn === "string" ? row.summaryCn : undefined,
      lastPublishedAt: typeof row.lastPublishedAt === "string" ? row.lastPublishedAt : undefined,
    };
  };

  const normalized: HomeEventPayload[] = [];
  if (Array.isArray(raw)) {
    for (const item of raw) {
      const next = normalizeEvent(item);
      if (next?.id) {
        normalized.push(next);
      }
    }
  } else if (raw && typeof raw === "object") {
    const legacy = raw as Record<string, unknown[]>;
    for (const [category, events] of Object.entries(legacy)) {
      for (const item of events ?? []) {
        const next = normalizeEvent(item, category);
        if (next?.id) {
          normalized.push(next);
        }
      }
    }
  }

  return normalized.sort((a, b) => Number(b.hotScore ?? 0) - Number(a.hotScore ?? 0));
}

function normalizeTags(raw: unknown): string[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return [...new Set(raw.map((item) => String(item).trim()).filter(Boolean))];
}

function extractTagsFromSnapshotPayload(payload: unknown, eventId: string): string[] {
  if (!Array.isArray(payload)) {
    return [];
  }
  const matched = payload.find((item) => {
    if (!item || typeof item !== "object") {
      return false;
    }
    return String((item as { id?: unknown }).id ?? "") === eventId;
  }) as { tags?: unknown } | undefined;
  return normalizeTags(matched?.tags);
}

async function resolveEventTags(input: { eventId: string; category: string }): Promise<string[]> {
  const category = normalizeCategory(input.category);
  const aliases = LEGACY_CATEGORY_KEYS_BY_FLAT[category] ?? [];
  if (hasRequiredEnv()) {
    try {
      for (const key of [category, ...aliases]) {
        const categorySnapshot = await getSnapshotPayloadForKey(`category:${key}`);
        const fromCategory = extractTagsFromSnapshotPayload(categorySnapshot?.payload_json, input.eventId);
        if (fromCategory.length > 0) {
          return fromCategory;
        }
      }

      const homeSnapshot = await getSnapshotPayloadForKey("home");
      const fromHome = extractTagsFromSnapshotPayload(homeSnapshot?.payload_json, input.eventId);
      if (fromHome.length > 0) {
        return fromHome;
      }
    } catch {
      // Ignore snapshot lookup errors and fallback to in-memory state.
    }
  }

  const latest = defaultPipelineStore.snapshots.at(-1);
  const categoryPayloads = (latest?.categoryPayloads as Record<string, unknown[]>) ?? {};
  for (const key of [category, ...aliases]) {
    const fromCategoryPayload = extractTagsFromSnapshotPayload(
      categoryPayloads[key] ?? [],
      input.eventId,
    );
    if (fromCategoryPayload.length > 0) {
      return fromCategoryPayload;
    }
  }

  const fromHomePayload = extractTagsFromSnapshotPayload(latest?.homePayload, input.eventId);
  if (fromHomePayload.length > 0) {
    return fromHomePayload;
  }

  const event = defaultPipelineStore.events.find((item) => item.id === input.eventId) as
    | { categories?: string[] }
    | undefined;
  return normalizeTags(event?.categories);
}

async function getLatestSuccessfulRunId() {
  return readThroughCache(
    "latest-success-run-id",
    async () => {
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
    },
    RUN_ID_CACHE_TTL_MS,
  );
}

async function getSnapshotPayloadForKey(key: string) {
  const runId = await getLatestSuccessfulRunId();
  if (!runId) {
    return null;
  }

  return readThroughCache(
    `snapshot:${runId}:${key}`,
    async () => {
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
    },
    READ_CACHE_TTL_MS,
  );
}

export async function readHomeSnapshot() {
  if (hasRequiredEnv()) {
    try {
      const snapshot = await getSnapshotPayloadForKey("home");
      return {
        generatedAt: snapshot?.generated_at ?? null,
        events: normalizeHomePayload(snapshot?.payload_json),
      };
    } catch {
      // Fallback to in-memory snapshot for local/dev resilience.
    }
  }

  const latest = defaultPipelineStore.snapshots.at(-1);
  return {
    generatedAt: latest?.generatedAt.toISOString() ?? null,
    events: normalizeHomePayload(latest?.homePayload),
  };
}

export async function readCategorySnapshot(slug: string, page: number, pageSize: number) {
  const normalizedSlug = normalizeCategory(slug);
  const aliases = LEGACY_CATEGORY_KEYS_BY_FLAT[normalizedSlug] ?? [];
  let events: HomeEventPayload[] = [];

  if (hasRequiredEnv()) {
    try {
      for (const key of [normalizedSlug, ...aliases]) {
        const snapshot = await getSnapshotPayloadForKey(`category:${key}`);
        const payload = normalizeHomePayload(snapshot?.payload_json).filter(
          (item) => item.category === normalizedSlug,
        );
        if (payload.length > 0) {
          events = payload;
          break;
        }
      }
    } catch {
      // Fallback to in-memory snapshot for local/dev resilience.
    }
  }

  if (events.length === 0) {
    const latest = defaultPipelineStore.snapshots.at(-1);
    const categoryPayloads = (latest?.categoryPayloads as Record<string, unknown[]>) ?? {};
    const merged = new Map<string, HomeEventPayload>();
    for (const key of [normalizedSlug, ...aliases]) {
      const payload = normalizeHomePayload(categoryPayloads[key] ?? []).filter(
        (item) => item.category === normalizedSlug,
      );
      for (const item of payload) {
        if (!merged.has(item.id)) {
          merged.set(item.id, item);
        }
      }
    }
    events = [...merged.values()].sort((a, b) => Number(b.hotScore ?? 0) - Number(a.hotScore ?? 0));
  }

  const start = (page - 1) * pageSize;
  return {
    category: normalizedSlug,
    page,
    pageSize,
    total: events.length,
    events: events.slice(start, start + pageSize),
  };
}

export async function loadNewsDetailFromClient(client: ReadModelClient, eventId: string) {
  const { data: event, error: eventError } = await client
    .from("events")
    .select("id,canonical_title,category,hot_score,tags")
    .eq("id", Number(eventId))
    .maybeSingle();
  if (eventError) {
    throw new Error(`load_event_failed: ${eventError.message}`);
  }
  if (!event) {
    return null;
  }

  const [summaryResult, mappingResult] = await Promise.all([
    client
      .from("summaries")
      .select("summary_cn,generated_at")
      .eq("event_id", event.id)
      .order("generated_at", { ascending: false })
      .limit(1),
    client.from("event_articles").select("article_id").eq("event_id", event.id),
  ]);

  const { data: summaries, error: summaryError } = summaryResult;
  if (summaryError) {
    throw new Error(`load_summary_failed: ${summaryError.message}`);
  }

  const { data: mappings, error: mappingError } = mappingResult;
  if (mappingError) {
    throw new Error(`load_event_articles_failed: ${mappingError.message}`);
  }

  const articleIds = ((mappings ?? []) as EventArticleMappingRow[]).map((item) => item.article_id);
  let sources: Array<{
    sourceId: number;
    sourceName: string;
    url: string;
    title: string;
    publishedAt: string | null;
    authorityWeight: number;
  }> = [];
  if (articleIds.length > 0) {
    const { data: articles, error: articleError } = await client
      .from("articles")
      .select("id,source_id,url,title,published_at,sources(id,name,authority_weight)")
      .in("id", articleIds);
    if (articleError) {
      throw new Error(`load_articles_failed: ${articleError.message}`);
    }

    const articleRows = (articles ?? []) as ArticleSourceRow[];

    sources = articleRows
      .map((item): DetailSourceItem => {
        const source =
          Array.isArray(item.sources) ? item.sources[0] : item.sources;
        return {
          sourceId: item.source_id,
          sourceName: source?.name ?? `source-${item.source_id}`,
          url: String(item.url),
          title: String(item.title),
          publishedAt: item.published_at ?? null,
          authorityWeight: Number(source?.authority_weight ?? 1),
        };
      })
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
    category: normalizeCategory(String(event.category)),
    hotScore: Number(event.hot_score),
    summaryCn: (summaries?.[0]?.summary_cn as string | undefined) ?? "",
    tags: normalizeTags((event as { tags?: unknown }).tags),
    sources,
  } as NewsDetailPayload;
}

export async function readNewsDetail(eventId: string) {
  if (hasRequiredEnv()) {
    try {
      return await readThroughCache(
        `news-detail:${eventId}`,
        async () => {
          const client = getSupabaseAdminClient();
          const detail = await loadNewsDetailFromClient(client, eventId);
          if (!detail) {
            return null;
          }
          const tags =
            detail.tags.length > 0
              ? detail.tags
              : await resolveEventTags({ eventId: detail.id, category: detail.category });
          return {
            ...detail,
            tags,
          } as NewsDetailPayload;
        },
        READ_CACHE_TTL_MS,
      );
    } catch {
      // Fallback to in-memory snapshot for local/dev resilience.
    }
  }

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
      sourceName: `source-${item.sourceId}`,
      url: item.url,
      title: item.title,
      publishedAt: item.publishedAt.toISOString(),
      authorityWeight: 1,
    }))
    .sort((a, b) => b.authorityWeight - a.authorityWeight);

  const detail: NewsDetailPayload = {
    id: event.id,
    title: event.canonicalTitle,
    category: normalizeCategory(event.category),
    hotScore: event.hotScore,
    summaryCn: summary?.summaryCn ?? "",
    tags: normalizeTags((event as { tags?: unknown }).tags),
    sources,
  };
  if (detail.tags.length === 0) {
    detail.tags = await resolveEventTags({ eventId: detail.id, category: detail.category });
  }
  return detail;
}

export async function readPipelineHealth(now = new Date()) {
  if (hasRequiredEnv()) {
    try {
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
    } catch {
      // Fallback to in-memory snapshot for local/dev resilience.
    }
  }

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

