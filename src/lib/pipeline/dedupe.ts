export type IncomingArticle = {
  sourceId: number;
  url: string;
  contentHash: string;
  title: string;
};

export function dedupeIncomingArticles(
  items: IncomingArticle[],
): IncomingArticle[] {
  const byUrl = new Set<string>();
  const bySourceHash = new Set<string>();
  const deduped: IncomingArticle[] = [];

  for (const item of items) {
    const sourceHash = `${item.sourceId}:${item.contentHash}`;
    if (byUrl.has(item.url) || bySourceHash.has(sourceHash)) {
      continue;
    }
    byUrl.add(item.url);
    bySourceHash.add(sourceHash);
    deduped.push(item);
  }

  return deduped;
}
