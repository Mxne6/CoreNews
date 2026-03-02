import Parser from "rss-parser";

export type RssFeedItem = {
  title?: string;
  link?: string;
  guid?: string;
  isoDate?: string;
  pubDate?: string;
  contentSnippet?: string;
  content?: string;
};

const parser = new Parser<Record<string, never>, RssFeedItem>();

export async function fetchRss(url: string): Promise<RssFeedItem[]> {
  const feed = await parser.parseURL(url);
  return feed.items ?? [];
}
