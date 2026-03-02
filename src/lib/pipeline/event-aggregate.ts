import { clusterArticlesBySimilarity } from "@/lib/pipeline/cluster";
import { buildContentHash } from "@/lib/pipeline/normalize";
import { computeHotScore } from "@/lib/pipeline/scoring";

export type AggregationSource = {
  id: number;
  category: string;
  authorityWeight: number;
};

export type AggregationArticle = {
  id: number;
  sourceId: number;
  title: string;
  normalizedTitle: string;
  publishedAt: string | null;
  publishedAtFallback: string;
};

export type AggregatedEvent = {
  eventStableKey: string;
  canonicalTitle: string;
  category: string;
  hotScore: number;
  articleCount: number;
  firstPublishedAt: string;
  lastPublishedAt: string;
};

export type EventArticleMapping = {
  eventStableKey: string;
  articleIds: number[];
};

type AggregateInput = {
  articles: AggregationArticle[];
  sources: AggregationSource[];
  now: Date;
  windowDays: number;
};

function resolvePublishedAt(article: AggregationArticle): Date {
  return new Date(article.publishedAt ?? article.publishedAtFallback);
}

export function aggregateEventsRolling(input: AggregateInput): {
  events: AggregatedEvent[];
  eventMappings: EventArticleMapping[];
} {
  const windowStart = new Date(input.now.getTime() - input.windowDays * 24 * 3_600_000);
  const sourceById = new Map(input.sources.map((item) => [item.id, item]));

  const candidates = input.articles.filter((article) => resolvePublishedAt(article) >= windowStart);
  const groups = clusterArticlesBySimilarity(
    candidates.map((article) => ({
      id: String(article.id),
      sourceId: article.sourceId,
      normalizedTitle: article.normalizedTitle,
      publishedAt: resolvePublishedAt(article),
    })),
  );

  const events: AggregatedEvent[] = [];
  const eventMappings: EventArticleMapping[] = [];

  for (const group of groups) {
    const groupArticles = group.articles
      .map((item) => candidates.find((candidate) => String(candidate.id) === item.id))
      .filter((item): item is AggregationArticle => Boolean(item));
    if (groupArticles.length === 0) {
      continue;
    }

    const categoryCounts = new Map<string, number>();
    let authorityWeightSum = 0;
    for (const article of groupArticles) {
      const source = sourceById.get(article.sourceId);
      const category = source?.category ?? "other";
      categoryCounts.set(category, (categoryCounts.get(category) ?? 0) + 1);
      authorityWeightSum += source?.authorityWeight ?? 1;
    }
    const sortedCategories = [...categoryCounts.entries()].sort((a, b) => b[1] - a[1]);
    const category = sortedCategories[0]?.[0] ?? "other";

    const publishedTimes = groupArticles
      .map(resolvePublishedAt)
      .sort((a, b) => a.getTime() - b.getTime());
    const firstPublishedAt = publishedTimes[0];
    const lastPublishedAt = publishedTimes[publishedTimes.length - 1];

    const canonicalTitle = groupArticles[0].title;
    const eventStableKey = buildContentHash(
      `${category}|${groupArticles[0].normalizedTitle}|${firstPublishedAt.toISOString().slice(0, 10)}`,
    );
    const coverageCount = new Set(groupArticles.map((item) => item.sourceId)).size;
    const hotScore = computeHotScore({
      category,
      coverageCount,
      authorityWeightSum,
      articleCount: groupArticles.length,
      lastPublishedAt,
      now: input.now,
    });

    events.push({
      eventStableKey,
      canonicalTitle,
      category,
      hotScore,
      articleCount: groupArticles.length,
      firstPublishedAt: firstPublishedAt.toISOString(),
      lastPublishedAt: lastPublishedAt.toISOString(),
    });
    eventMappings.push({
      eventStableKey,
      articleIds: groupArticles.map((item) => item.id),
    });
  }

  return { events, eventMappings };
}
