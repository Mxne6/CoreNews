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

function normalizeCandidateUrls(url: string): string[] {
  const candidates = [url];
  if (url.startsWith("http://")) {
    candidates.push(`https://${url.slice("http://".length)}`);
  }
  return [...new Set(candidates)];
}

function buildAbsoluteUrl(baseUrl: string, location: string): string {
  try {
    return new URL(location, baseUrl).toString();
  } catch {
    return location;
  }
}

function withTimeoutSignal(ms: number): AbortSignal {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), ms);
  return controller.signal;
}

export async function fetchRss(url: string): Promise<RssFeedItem[]> {
  let lastError: Error | null = null;
  const candidates = normalizeCandidateUrls(url);

  for (const candidateUrl of candidates) {
    try {
      const response = await fetch(candidateUrl, {
        method: "GET",
        headers: {
          "User-Agent": "CoreNewsBot/1.0 (+https://core-news.vercel.app)",
          Accept: "application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.1",
        },
        redirect: "manual",
        signal: withTimeoutSignal(20_000),
      });

      let finalResponse = response;
      if (
        (response.status === 301 || response.status === 302 || response.status === 307 || response.status === 308) &&
        response.headers.get("location")
      ) {
        const redirectUrl = buildAbsoluteUrl(candidateUrl, response.headers.get("location") as string);
        finalResponse = await fetch(redirectUrl, {
          method: "GET",
          headers: {
            "User-Agent": "CoreNewsBot/1.0 (+https://core-news.vercel.app)",
            Accept: "application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.1",
          },
          redirect: "manual",
          signal: withTimeoutSignal(20_000),
        });
      }

      if (!finalResponse.ok) {
        throw new Error(`http_${finalResponse.status}`);
      }

      const xml = await finalResponse.text();
      const feed = await parser.parseString(xml);
      return feed.items ?? [];
    } catch (error) {
      lastError = error as Error;
    }
  }

  throw lastError ?? new Error("rss_fetch_failed");
}
