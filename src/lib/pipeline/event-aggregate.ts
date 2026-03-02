import { clusterArticlesBySimilarity } from "@/lib/pipeline/cluster";
import { buildContentHash } from "@/lib/pipeline/normalize";
import { resolveAmbiguousGroups, type AmbiguityResolverClient } from "@/lib/pipeline/resolve-ambiguous";
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
  ambiguityResolver?: AmbiguityResolverClient | null;
};

type EventBundle = {
  articles: AggregationArticle[];
  canonicalTitle: string;
};

function resolvePublishedAt(article: AggregationArticle): Date {
  return new Date(article.publishedAt ?? article.publishedAtFallback);
}

function pickCategory(articles: AggregationArticle[], sourceById: Map<number, AggregationSource>): string {
  const categoryCounts = new Map<string, number>();
  for (const article of articles) {
    const category = sourceById.get(article.sourceId)?.category ?? "other";
    categoryCounts.set(category, (categoryCounts.get(category) ?? 0) + 1);
  }
  return [...categoryCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "other";
}

export async function aggregateEventsRolling(input: AggregateInput): Promise<{
  events: AggregatedEvent[];
  eventMappings: EventArticleMapping[];
}> {
  const windowStart = new Date(input.now.getTime() - input.windowDays * 24 * 3_600_000);
  const sourceById = new Map(input.sources.map((item) => [item.id, item]));

  const candidates = input.articles.filter((article) => resolvePublishedAt(article) >= windowStart);
  const candidateById = new Map(candidates.map((article) => [String(article.id), article]));

  const groups = clusterArticlesBySimilarity(
    candidates.map((article) => ({
      id: String(article.id),
      sourceId: article.sourceId,
      normalizedTitle: article.normalizedTitle,
      publishedAt: resolvePublishedAt(article),
    })),
  );

  const resolvedByGroupId = new Map<string, { canonicalTitle: string; merged: boolean }>();
  if (input.ambiguityResolver) {
    const ambiguous = groups
      .filter((group) => group.ambiguous)
      .map((group) => ({
        groupId: group.groupId,
        ambiguous: true,
        articles: group.articles.map((article) => ({
          id: article.id,
          normalizedTitle: article.normalizedTitle,
        })),
      }));
    if (ambiguous.length > 0) {
      const resolved = await resolveAmbiguousGroups(ambiguous, input.ambiguityResolver);
      for (const item of resolved) {
        resolvedByGroupId.set(item.groupId, {
          canonicalTitle: item.canonicalTitle,
          merged: item.merged,
        });
      }
    }
  }

  const bundles: EventBundle[] = [];
  for (const group of groups) {
    const groupArticles = group.articles
      .map((item) => candidateById.get(item.id))
      .filter((item): item is AggregationArticle => Boolean(item));
    if (groupArticles.length === 0) {
      continue;
    }

    const resolution = resolvedByGroupId.get(group.groupId);
    if (resolution && !resolution.merged) {
      for (const article of groupArticles) {
        bundles.push({
          articles: [article],
          canonicalTitle: article.title,
        });
      }
      continue;
    }

    bundles.push({
      articles: groupArticles,
      canonicalTitle: resolution?.canonicalTitle?.trim() || groupArticles[0].title,
    });
  }

  const events: AggregatedEvent[] = [];
  const eventMappings: EventArticleMapping[] = [];

  for (const bundle of bundles) {
    const category = pickCategory(bundle.articles, sourceById);
    const authorityWeightSum = bundle.articles.reduce(
      (sum, article) => sum + (sourceById.get(article.sourceId)?.authorityWeight ?? 1),
      0,
    );
    const coverageCount = new Set(bundle.articles.map((article) => article.sourceId)).size;

    const publishedTimes = bundle.articles
      .map(resolvePublishedAt)
      .sort((a, b) => a.getTime() - b.getTime());
    const firstPublishedAt = publishedTimes[0];
    const lastPublishedAt = publishedTimes[publishedTimes.length - 1];

    const stableAnchor = bundle.articles[0];
    const eventStableKey = buildContentHash(
      `${category}|${stableAnchor.normalizedTitle}|${firstPublishedAt.toISOString().slice(0, 10)}`,
    );
    const hotScore = computeHotScore({
      category,
      coverageCount,
      authorityWeightSum,
      articleCount: bundle.articles.length,
      lastPublishedAt,
      now: input.now,
    });

    events.push({
      eventStableKey,
      canonicalTitle: bundle.canonicalTitle,
      category,
      hotScore,
      articleCount: bundle.articles.length,
      firstPublishedAt: firstPublishedAt.toISOString(),
      lastPublishedAt: lastPublishedAt.toISOString(),
    });

    eventMappings.push({
      eventStableKey,
      articleIds: bundle.articles.map((article) => article.id),
    });
  }

  return { events, eventMappings };
}
