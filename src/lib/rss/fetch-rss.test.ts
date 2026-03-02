import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchRss } from "@/lib/rss/fetch-rss";

const sampleRss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Sample Feed</title>
    <item>
      <title>First item</title>
      <link>https://example.com/1</link>
      <guid>1</guid>
      <pubDate>Mon, 02 Mar 2026 08:00:00 GMT</pubDate>
    </item>
  </channel>
</rss>`;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchRss", () => {
  it("fetches and parses rss via fetch + parseString", async () => {
    const fetchMock = vi.fn(async () => new Response(sampleRss, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const items = await fetchRss("https://example.com/feed.xml");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(items).toHaveLength(1);
    expect(items[0]?.title).toBe("First item");
  });

  it("retries with https when http candidate fails", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("network_error"))
      .mockResolvedValueOnce(new Response(sampleRss, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const items = await fetchRss("http://example.com/feed.xml");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("http://example.com/feed.xml");
    expect(fetchMock.mock.calls[1]?.[0]).toBe("https://example.com/feed.xml");
    expect(items).toHaveLength(1);
  });
});
