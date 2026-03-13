import { clusterArticlesBySimilarity } from "@/lib/pipeline/cluster";
import { dedupeIncomingArticles } from "@/lib/pipeline/dedupe";
import { computeHotScore } from "@/lib/pipeline/scoring";
import { buildSnapshotPayload } from "@/lib/pipeline/snapshot-builder";
import { normalizeCategory } from "@/lib/ui/categories";

export type PipelineArticle = {
  id: string;
  sourceId: number;
  url: string;
  title: string;
  normalizedTitle: string;
  contentHash: string;
  publishedAt: Date;
  category: string;
};

type PipelineEvent = {
  id: string;
  category: string;
  categories?: string[];
  canonicalTitle: string;
  hotScore: number;
  lastPublishedAt?: string;
  articleIds: string[];
};

type PipelineSummary = {
  eventId: string;
  summaryCn: string;
  modelName: string;
  modelVersion: string;
};

type PipelineRun = {
  startedAt: Date;
  endedAt?: Date;
  status: "running" | "success" | "failed";
  error?: string;
  articleCount: number;
  eventCount: number;
  summaryCount: number;
};

type Snapshot = {
  generatedAt: Date;
  homePayload: unknown[];
  categoryPayloads: Record<string, unknown>;
};

export type PipelineStore = {
  locked: boolean;
  articles: PipelineArticle[];
  events: PipelineEvent[];
  summaries: PipelineSummary[];
  snapshots: Snapshot[];
  pipelineRuns: PipelineRun[];
};

export function createInMemoryPipelineStore(): PipelineStore {
  return {
    locked: false,
    articles: [],
    events: [],
    summaries: [],
    snapshots: [],
    pipelineRuns: [],
  };
}

declare global {
  var __coreNewsPipelineStore: PipelineStore | undefined;
}

export const defaultPipelineStore =
  globalThis.__coreNewsPipelineStore ?? createInMemoryPipelineStore();

if (!globalThis.__coreNewsPipelineStore) {
  globalThis.__coreNewsPipelineStore = defaultPipelineStore;
}

type RunDailyInput = {
  store: PipelineStore;
  incomingArticles: PipelineArticle[];
  now: Date;
  resolver?: (group: {
    groupId: string;
    articles: Array<{ id: string; normalizedTitle: string }>;
  }) => Promise<{ canonicalTitle: string; merged: boolean }>;
};

function eventIdFromTitle(category: string, canonicalTitle: string): string {
  const slug = canonicalTitle.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "");
  return `${category}:${slug}`;
}

function pickEventCategories(articleRefs: PipelineArticle[]): string[] {
  const countByCategory = new Map<string, number>();
  for (const article of articleRefs) {
    const category = normalizeCategory(article.category);
    countByCategory.set(category, (countByCategory.get(category) ?? 0) + 1);
  }
  const ranked = [...countByCategory.entries()].sort((a, b) => {
    if (b[1] !== a[1]) {
      return b[1] - a[1];
    }
    return a[0].localeCompare(b[0]);
  });
  return ranked.map(([category]) => category).slice(0, 3);
}

export async function runDailyPipeline(input: RunDailyInput): Promise<void> {
  const run: PipelineRun = {
    startedAt: input.now,
    status: "running",
    articleCount: 0,
    eventCount: 0,
    summaryCount: 0,
  };
  input.store.pipelineRuns.push(run);

  if (input.store.locked) {
    run.status = "failed";
    run.error = "pipeline_locked";
    run.endedAt = new Date();
    return;
  }

  input.store.locked = true;

  try {
    const existing = input.store.articles.map((item) => ({
      sourceId: item.sourceId,
      url: item.url,
      contentHash: item.contentHash,
      title: item.title,
    }));
    const incoming = input.incomingArticles.map((item) => ({
      sourceId: item.sourceId,
      url: item.url,
      contentHash: item.contentHash,
      title: item.title,
    }));

    const totalDeduped = dedupeIncomingArticles([...existing, ...incoming]);
    const seen = new Set(input.store.articles.map((item) => item.url));
    const newArticles = input.incomingArticles.filter(
      (item) => totalDeduped.some((deduped) => deduped.url === item.url) && !seen.has(item.url),
    );
    input.store.articles.push(...newArticles);

    const groups = clusterArticlesBySimilarity(
      input.store.articles.map((item) => ({
        id: item.id,
        sourceId: item.sourceId,
        normalizedTitle: item.normalizedTitle,
        publishedAt: item.publishedAt,
      })),
    );

    const nextEvents: PipelineEvent[] = [];
    const nextSummaries: PipelineSummary[] = [];

    for (const group of groups) {
      const first = group.articles[0];
      const articleRefs = group.articles
        .map((article) => input.store.articles.find((item) => item.id === article.id))
        .filter((item): item is PipelineArticle => Boolean(item));
      const rawCategory = normalizeCategory(articleRefs[0]?.category ?? "international");

      let canonicalTitle = first?.normalizedTitle ?? "untitled event";
      if (group.ambiguous && input.resolver) {
        const result = await input.resolver({
          groupId: group.groupId,
          articles: group.articles.map((item) => ({
            id: item.id,
            normalizedTitle: item.normalizedTitle,
          })),
        });
        if (!result.canonicalTitle.trim()) {
          throw new Error("empty_llm_result");
        }
        canonicalTitle = result.canonicalTitle;
      }

      const categories = pickEventCategories(articleRefs);
      const category = normalizeCategory(categories[0] ?? rawCategory);
      const id = eventIdFromTitle(category, canonicalTitle);
      const coverageCount = new Set(articleRefs.map((item) => item.sourceId)).size;
      const lastPublishedAt = articleRefs.reduce(
        (latest, current) => (current.publishedAt > latest ? current.publishedAt : latest),
        articleRefs[0]?.publishedAt ?? input.now,
      );
      const hotScore = computeHotScore({
        category,
        coverageCount,
        authorityWeightSum: coverageCount,
        articleCount: articleRefs.length,
        lastPublishedAt,
        now: input.now,
      });

      nextEvents.push({
        id,
        category,
        categories: [category],
        canonicalTitle,
        hotScore,
        lastPublishedAt: lastPublishedAt.toISOString(),
        articleIds: articleRefs.map((item) => item.id),
      });
      nextSummaries.push({
        eventId: id,
        summaryCn:
          `${canonicalTitle} 在多源报道中持续发酵，当前已汇聚 ${coverageCount} 家媒体跟进。` +
          "摘要聚焦关键进展与后续影响，建议结合原文交叉核对细节。",
        modelName: "qwen-max",
        modelVersion: "fallback-v1",
      });
    }

    for (const event of nextEvents) {
      const idx = input.store.events.findIndex((item) => item.id === event.id);
      if (idx >= 0) {
        input.store.events[idx] = event;
      } else {
        input.store.events.push(event);
      }
    }

    for (const summary of nextSummaries) {
      const idx = input.store.summaries.findIndex((item) => item.eventId === summary.eventId);
      if (idx >= 0) {
        input.store.summaries[idx] = summary;
      } else {
        input.store.summaries.push(summary);
      }
    }

    const snapshotEvents = input.store.events.map((event) => ({
      id: event.id,
      category: normalizeCategory(event.category),
      categories: [normalizeCategory(event.category)],
      tags: [normalizeCategory(event.category)],
      canonicalTitle: event.canonicalTitle,
      hotScore: event.hotScore,
      articleCount: event.articleIds.length,
      lastPublishedAt: event.lastPublishedAt ?? input.now.toISOString(),
      summaryCn: input.store.summaries.find((summary) => summary.eventId === event.id)?.summaryCn ?? "",
    }));
    const { homePayload, categoryPayloads } = buildSnapshotPayload(snapshotEvents);
    input.store.snapshots.push({
      generatedAt: input.now,
      homePayload,
      categoryPayloads,
    });

    run.status = "success";
    run.articleCount = input.store.articles.length;
    run.eventCount = input.store.events.length;
    run.summaryCount = input.store.summaries.length;
    run.endedAt = new Date();
  } catch (error) {
    run.status = "failed";
    run.error = (error as Error).message;
    run.endedAt = new Date();
  } finally {
    input.store.locked = false;
  }
}
