export type ClusterArticle = {
  id: string;
  sourceId: number;
  normalizedTitle: string;
  publishedAt: Date;
};

export type CandidateGroup = {
  groupId: string;
  ambiguous: boolean;
  articles: ClusterArticle[];
};

function jaccardSimilarity(a: string, b: string): number {
  const aTokens = new Set(a.split(" ").filter(Boolean));
  const bTokens = new Set(b.split(" ").filter(Boolean));
  const intersection = [...aTokens].filter((token) => bTokens.has(token)).length;
  const union = new Set([...aTokens, ...bTokens]).size;
  return union === 0 ? 0 : intersection / union;
}

function withinHours(a: Date, b: Date, hours: number): boolean {
  return Math.abs(a.getTime() - b.getTime()) <= hours * 3_600_000;
}

export function clusterArticlesBySimilarity(
  articles: ClusterArticle[],
  maxHoursGap = 8,
  minSimilarity = 0.4,
): CandidateGroup[] {
  const groups: CandidateGroup[] = [];

  for (const article of articles) {
    let matched = false;

    for (const group of groups) {
      const anchor = group.articles[0];
      const similarity = jaccardSimilarity(anchor.normalizedTitle, article.normalizedTitle);
      if (
        withinHours(anchor.publishedAt, article.publishedAt, maxHoursGap) &&
        similarity >= minSimilarity
      ) {
        group.articles.push(article);
        matched = true;
        break;
      }
    }

    if (!matched) {
      groups.push({
        groupId: `group-${groups.length + 1}`,
        ambiguous: false,
        articles: [article],
      });
    }
  }

  return groups.map((group) => {
    if (group.articles.length <= 1) {
      return group;
    }

    const anchor = group.articles[0];
    const hasMultiSource = new Set(group.articles.map((item) => item.sourceId)).size > 1;
    const minPairSimilarity = Math.min(
      ...group.articles.map((item) =>
        jaccardSimilarity(anchor.normalizedTitle, item.normalizedTitle),
      ),
    );
    return { ...group, ambiguous: hasMultiSource && minPairSimilarity < 0.85 };
  });
}
