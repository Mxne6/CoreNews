import { buildContentHash, normalizeTitle } from "@/lib/pipeline/normalize";
import type { RssFeedItem } from "@/lib/rss/fetch-rss";

export type ActiveSource = {
  id: number;
  rss_url: string;
  category: string;
  authority_weight: number;
};

export type SourceError = {
  sourceId: number | null;
  rssUrl: string;
  error: string;
};

type SupabaseLike = {
  from: (table: string) => {
    upsert?: (
      values: Record<string, unknown>[],
      options: { onConflict: string },
    ) => Promise<{ error: { message: string } | null }>;
    update?: (values: Record<string, unknown>) => {
      eq: (column: string, value: unknown) => Promise<{ error: { message: string } | null }>;
    };
  };
};

function parseIsoDate(value?: string): string | null {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function getDomain(input: string): string {
  try {
    return new URL(input).hostname.toLowerCase();
  } catch {
    return "unknown";
  }
}

function buildDateBucket(iso: string | null, fallback: Date): string {
  if (!iso) {
    return fallback.toISOString().slice(0, 10);
  }
  return iso.slice(0, 10);
}

export function buildDedupeKey(input: {
  guid?: string;
  canonicalLink?: string;
  normalizedTitle: string;
  publishedDateBucket: string;
}): string {
  if (input.guid && input.guid.trim().length > 0) {
    return `guid:${input.guid.trim()}`;
  }
  if (input.canonicalLink && input.canonicalLink.trim().length > 0) {
    return `link:${input.canonicalLink.trim()}`;
  }
  const hashPayload = `${input.normalizedTitle}|${getDomain(input.canonicalLink ?? "")}|${input.publishedDateBucket}`;
  return `hash:${buildContentHash(hashPayload)}`;
}

export function prepareArticleRecord(source: ActiveSource, item: RssFeedItem, now: Date) {
  const canonicalLink = item.link?.trim() ?? "";
  const normalizedTitle = normalizeTitle(item.title ?? "");
  const publishedAtIso = parseIsoDate(item.isoDate ?? item.pubDate);
  const publishedDateBucket = buildDateBucket(publishedAtIso, now);
  const dedupeKey = buildDedupeKey({
    guid: item.guid,
    canonicalLink,
    normalizedTitle,
    publishedDateBucket,
  });
  const snippet = item.contentSnippet?.trim() || item.content?.slice(0, 280) || "";
  const hashPayload = `${normalizedTitle}|${canonicalLink}|${snippet}`;

  return {
    source_id: source.id,
    title: item.title?.trim() ?? "untitled",
    normalized_title: normalizedTitle,
    url: canonicalLink || `urn:rss:${source.id}:${dedupeKey}`,
    canonical_link: canonicalLink || null,
    guid: item.guid?.trim() || null,
    dedupe_key: dedupeKey,
    content_hash: buildContentHash(hashPayload),
    lang: "unknown",
    content_snippet: snippet || null,
    published_at: publishedAtIso,
    published_at_fallback: now.toISOString(),
    fetched_at: now.toISOString(),
  };
}

type IngestInput = {
  client: SupabaseLike;
  sources: ActiveSource[];
  fetchFeed: (rssUrl: string) => Promise<RssFeedItem[]>;
  now: Date;
};

export async function ingestArticlesFromSources(input: IngestInput) {
  const sourceErrors: SourceError[] = [];
  const rows: Record<string, unknown>[] = [];

  for (const source of input.sources) {
    try {
      const items = await input.fetchFeed(source.rss_url);
      for (const item of items) {
        rows.push(prepareArticleRecord(source, item, input.now));
      }
      const updater = input.client.from("sources").update;
      if (updater) {
        await updater({ last_fetched_at: input.now.toISOString() }).eq("id", source.id);
      }
    } catch (error) {
      sourceErrors.push({
        sourceId: source.id,
        rssUrl: source.rss_url,
        error: (error as Error).message,
      });
    }
  }

  if (rows.length > 0) {
    const result = await input.client.from("articles").upsert?.(rows, {
      onConflict: "source_id,dedupe_key",
    });
    if (result?.error) {
      throw new Error(result.error.message);
    }
  }

  return {
    insertedOrUpdatedCount: rows.length,
    sourceErrors,
  };
}
