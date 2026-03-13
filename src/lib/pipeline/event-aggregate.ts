import { clusterArticlesBySimilarity } from "@/lib/pipeline/cluster";
import { buildContentHash } from "@/lib/pipeline/normalize";
import {
  resolveAmbiguousGroups,
  type AmbiguityResolverClient,
} from "@/lib/pipeline/resolve-ambiguous";
import { computeHotScore } from "@/lib/pipeline/scoring";
import { normalizeCategory, type CategorySlug } from "@/lib/ui/categories";

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
  categories: string[];
  hotScore: number;
  articleCount: number;
  firstPublishedAt: string;
  lastPublishedAt: string;
};

export type EventArticleMapping = {
  eventStableKey: string;
  articleIds: number[];
};

export type CategoryClassifierClient = {
  classifyCategory: (input: {
    canonicalTitle: string;
    candidateCategories: CategorySlug[];
    articleTitles: string[];
    articleCount: number;
    sourceCategories: CategorySlug[];
  }) => Promise<string | null>;
};

type AggregateInput = {
  articles: AggregationArticle[];
  sources: AggregationSource[];
  now: Date;
  windowDays: number;
  ambiguityResolver?: AmbiguityResolverClient | null;
  ambiguityLimit?: number;
  categoryClassifier?: CategoryClassifierClient | null;
  categoryClassifierLimit?: number;
};

type EventBundle = {
  articles: AggregationArticle[];
  canonicalTitle: string;
};

const FLAT_CATEGORY_ORDER: CategorySlug[] = [
  "domestic",
  "international",
  "current-affairs",
  "society",
  "finance",
  "tech",
  "sports",
  "entertainment",
  "culture-education",
  "lifestyle",
];

const FLAT_CATEGORY_KEYWORDS: Record<CategorySlug, string[]> = {
  domestic: [
    "中国",
    "国内",
    "本土",
    "内地",
    "中共中央",
    "国务院",
    "全国",
    "北京",
    "上海",
    "广州",
    "深圳",
  ],
  international: [
    "国际",
    "全球",
    "world",
    "global",
    "international",
    "联合国",
    "欧盟",
    "美国",
    "日本",
    "欧洲",
    "中东",
  ],
  "current-affairs": [
    "时政",
    "政治",
    "外交",
    "政府",
    "选举",
    "法案",
    "议会",
    "总统",
    "总理",
    "制裁",
    "政策",
    "监管",
  ],
  society: [
    "社会",
    "民生",
    "治安",
    "事故",
    "灾害",
    "法院",
    "警方",
    "犯罪",
    "公益",
    "公共服务",
  ],
  finance: [
    "财经",
    "经济",
    "金融",
    "市场",
    "股市",
    "债券",
    "汇率",
    "利率",
    "通胀",
    "就业",
    "ipo",
    "收购",
  ],
  tech: [
    "科技",
    "ai",
    "gpt",
    "llm",
    "openai",
    "芯片",
    "半导体",
    "算力",
    "软件",
    "云计算",
  ],
  sports: [
    "体育",
    "足球",
    "篮球",
    "网球",
    "奥运",
    "世界杯",
    "联赛",
    "比赛",
    "夺冠",
  ],
  entertainment: [
    "娱乐",
    "电影",
    "电视剧",
    "综艺",
    "明星",
    "艺人",
    "票房",
    "演唱会",
  ],
  "culture-education": [
    "文化",
    "教育",
    "高校",
    "学校",
    "考试",
    "大学",
    "艺术",
    "展览",
    "博物馆",
    "出版",
  ],
  lifestyle: [
    "生活",
    "健康",
    "旅游",
    "美食",
    "消费",
    "住房",
    "天气",
    "出行",
    "养老",
    "家庭",
  ],
};

function resolvePublishedAt(article: AggregationArticle): Date {
  return new Date(article.publishedAt ?? article.publishedAtFallback);
}

function normalizeForKeyword(text: string): string {
  return ` ${text.toLowerCase()} `;
}

function detectTitleCategoryBonus(title: string): Map<CategorySlug, number> {
  const normalized = normalizeForKeyword(title);
  const bonus = new Map<CategorySlug, number>();

  for (const category of FLAT_CATEGORY_ORDER) {
    const keywords = FLAT_CATEGORY_KEYWORDS[category];
    let matches = 0;
    for (const keyword of keywords) {
      const needle = normalizeForKeyword(keyword);
      if (normalized.includes(needle)) {
        matches += 1;
      }
    }
    if (matches > 0) {
      bonus.set(category, Math.min(2, matches) * 1.4);
    }
  }

  return bonus;
}

const SOURCE_CATEGORY_PRIOR: Record<string, CategorySlug> = {
  ai: "tech",
  tech: "tech",
  business: "finance",
  markets: "finance",
  policy: "current-affairs",
  china: "domestic",
  us: "international",
  japan: "international",
  europe: "international",
  world: "international",
  energy: "finance",
  health: "lifestyle",
  sports: "sports",
  entertainment: "entertainment",
  "culture-education": "culture-education",
  lifestyle: "lifestyle",
  domestic: "domestic",
  international: "international",
  "current-affairs": "current-affairs",
  society: "society",
  finance: "finance",
};

function resolveSourcePriorCategory(sourceCategory?: string): CategorySlug {
  if (!sourceCategory) {
    return "international";
  }
  const key = sourceCategory.trim().toLowerCase();
  return SOURCE_CATEGORY_PRIOR[key] ?? normalizeCategory(sourceCategory);
}

function isCategorySlug(value: string): value is CategorySlug {
  return FLAT_CATEGORY_ORDER.includes(value as CategorySlug);
}

function pickCategories(
  input: {
    canonicalTitle: string;
    articles: AggregationArticle[];
  },
  sourceById: Map<number, AggregationSource>,
): {
  primary: CategorySlug;
  ranked: Array<[CategorySlug, number]>;
  lowConfidence: boolean;
  sourceCategories: CategorySlug[];
} {
  const scoreByCategory = new Map<CategorySlug, number>(
    FLAT_CATEGORY_ORDER.map((item) => [item, 0]),
  );
  const sourceSets = new Map<CategorySlug, Set<number>>();
  const articleCountByCategory = new Map<CategorySlug, number>();
  const sourceCategories = new Set<CategorySlug>();

  for (const article of input.articles) {
    const source = sourceById.get(article.sourceId);
    const category = resolveSourcePriorCategory(source?.category);
    const authority = source?.authorityWeight ?? 1;
    sourceCategories.add(category);

    if (!sourceSets.has(category)) {
      sourceSets.set(category, new Set<number>());
    }
    sourceSets.get(category)?.add(article.sourceId);
    articleCountByCategory.set(category, (articleCountByCategory.get(category) ?? 0) + 1);
    // Source category is only a weak prior.
    scoreByCategory.set(category, (scoreByCategory.get(category) ?? 0) + authority * 0.18);
  }

  for (const [category, set] of sourceSets.entries()) {
    scoreByCategory.set(category, (scoreByCategory.get(category) ?? 0) + set.size * 0.25);
  }
  for (const [category, count] of articleCountByCategory.entries()) {
    scoreByCategory.set(category, (scoreByCategory.get(category) ?? 0) + Math.log1p(count) * 0.12);
  }

  const semanticText = [
    input.canonicalTitle,
    ...input.articles.map((article) => article.title),
    ...input.articles.map((article) => article.normalizedTitle),
  ].join(" ");
  const keywordBonus = detectTitleCategoryBonus(semanticText);
  for (const [category, bonus] of keywordBonus.entries()) {
    scoreByCategory.set(category, (scoreByCategory.get(category) ?? 0) + bonus * 2.3);
  }

  const ranked = [...scoreByCategory.entries()].sort((a, b) => {
    if (b[1] !== a[1]) {
      return b[1] - a[1];
    }
    return FLAT_CATEGORY_ORDER.indexOf(a[0]) - FLAT_CATEGORY_ORDER.indexOf(b[0]);
  });

  const primary = ranked[0]?.[0];
  if (!primary) {
    return {
      primary: "international",
      ranked: [["international", 0]],
      lowConfidence: true,
      sourceCategories: [...sourceCategories.values()],
    };
  }
  const topScore = ranked[0]?.[1] ?? 0;
  const secondScore = ranked[1]?.[1] ?? 0;
  const lowConfidence = topScore < 1.2 || topScore - secondScore < 0.75;
  return {
    primary,
    ranked,
    lowConfidence,
    sourceCategories: [...sourceCategories.values()],
  };
}

function resolveArticleCategory(
  article: Pick<AggregationArticle, "sourceId" | "title" | "normalizedTitle">,
  sourceById: Map<number, AggregationSource>,
): string {
  const sourceCategory = sourceById.get(article.sourceId)?.category;
  const prior = resolveSourcePriorCategory(sourceCategory);
  const mergedText = `${article.title} ${article.normalizedTitle}`.trim();
  const bonus = detectTitleCategoryBonus(mergedText);
  if (bonus.size === 0) {
    return prior;
  }
  let best: CategorySlug = prior;
  let bestScore = (bonus.get(prior) ?? 0) + 1.2;
  for (const category of FLAT_CATEGORY_ORDER) {
    const candidateScore = (bonus.get(category) ?? 0) + (category === prior ? 1.2 : 0);
    if (candidateScore > bestScore) {
      best = category;
      bestScore = candidateScore;
    }
  }
  return best;
}

function buildCategoryScopedGroups(
  articles: AggregationArticle[],
  sourceById: Map<number, AggregationSource>,
) {
  const buckets = new Map<string, AggregationArticle[]>();
  for (const article of articles) {
    const category = resolveArticleCategory(article, sourceById);
    const bucket = buckets.get(category);
    if (bucket) {
      bucket.push(article);
    } else {
      buckets.set(category, [article]);
    }
  }

  const categoryGroups: Array<{
    groupId: string;
    ambiguous: boolean;
    articles: Array<{
      id: string;
      sourceId: number;
      normalizedTitle: string;
      publishedAt: Date;
    }>;
  }> = [];

  for (const [category, bucket] of [...buckets.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const groups = clusterArticlesBySimilarity(
      bucket.map((article) => ({
        id: String(article.id),
        sourceId: article.sourceId,
        normalizedTitle: article.normalizedTitle,
        publishedAt: resolvePublishedAt(article),
      })),
    );
    for (const group of groups) {
      categoryGroups.push({
        ...group,
        groupId: `${category}:${group.groupId}`,
      });
    }
  }

  return categoryGroups;
}

export async function aggregateEventsRolling(input: AggregateInput): Promise<{
  events: AggregatedEvent[];
  eventMappings: EventArticleMapping[];
}> {
  const windowStart = new Date(input.now.getTime() - input.windowDays * 24 * 3_600_000);
  const sourceById = new Map(input.sources.map((item) => [item.id, item]));

  const candidates = input.articles.filter((article) => resolvePublishedAt(article) >= windowStart);
  const candidateById = new Map(candidates.map((article) => [String(article.id), article]));

  const groups = buildCategoryScopedGroups(candidates, sourceById);

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

    const resolverLimit = Math.max(
      0,
      Math.min(input.ambiguityLimit ?? ambiguous.length, ambiguous.length),
    );
    const toResolve = ambiguous.slice(0, resolverLimit);
    const overflow = ambiguous.slice(resolverLimit);

    if (toResolve.length > 0) {
      const resolved = await resolveAmbiguousGroups(toResolve, input.ambiguityResolver);
      for (const item of resolved) {
        resolvedByGroupId.set(item.groupId, {
          canonicalTitle: item.canonicalTitle,
          merged: item.merged,
        });
      }
    }

    for (const group of overflow) {
      resolvedByGroupId.set(group.groupId, {
        canonicalTitle: "",
        merged: false,
      });
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
  let categoryClassifierCalls = 0;
  const categoryClassifierLimit = Math.max(
    0,
    Math.min(input.categoryClassifierLimit ?? bundles.length, bundles.length),
  );

  for (const bundle of bundles) {
    const decision = pickCategories(
      {
        canonicalTitle: bundle.canonicalTitle,
        articles: bundle.articles,
      },
      sourceById,
    );
    let category = decision.primary;
    if (
      input.categoryClassifier &&
      decision.lowConfidence &&
      categoryClassifierCalls < categoryClassifierLimit
    ) {
      categoryClassifierCalls += 1;
      try {
        const resolved = await input.categoryClassifier.classifyCategory({
          canonicalTitle: bundle.canonicalTitle,
          candidateCategories: decision.ranked.slice(0, 3).map(([item]) => item),
          articleTitles: bundle.articles.map((article) => article.title),
          articleCount: bundle.articles.length,
          sourceCategories: decision.sourceCategories,
        });
        const raw = resolved?.trim().toLowerCase() ?? "";
        if (raw && (isCategorySlug(raw) || raw in SOURCE_CATEGORY_PRIOR)) {
          category = normalizeCategory(raw);
        }
      } catch {
        // Keep rule-based category on classifier failures.
      }
    }
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
      categories: [category],
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
