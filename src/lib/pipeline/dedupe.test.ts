import { describe, expect, it } from "vitest";
import { dedupeIncomingArticles } from "@/lib/pipeline/dedupe";

describe("dedupeIncomingArticles", () => {
  it("deduplicates by url", () => {
    const deduped = dedupeIncomingArticles([
      { sourceId: 1, url: "https://a.com/1", contentHash: "h1", title: "a" },
      { sourceId: 1, url: "https://a.com/1", contentHash: "h2", title: "b" },
    ]);
    expect(deduped).toHaveLength(1);
  });

  it("deduplicates by source + content hash", () => {
    const deduped = dedupeIncomingArticles([
      { sourceId: 1, url: "https://a.com/1", contentHash: "h1", title: "a" },
      { sourceId: 1, url: "https://a.com/2", contentHash: "h1", title: "a2" },
    ]);
    expect(deduped).toHaveLength(1);
  });

  it("keeps records when hashes match across different sources", () => {
    const deduped = dedupeIncomingArticles([
      { sourceId: 1, url: "https://a.com/1", contentHash: "h1", title: "a" },
      { sourceId: 2, url: "https://b.com/2", contentHash: "h1", title: "b" },
    ]);
    expect(deduped).toHaveLength(2);
  });
});
