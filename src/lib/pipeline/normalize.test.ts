import { describe, expect, it } from "vitest";
import { buildContentHash, normalizeTitle } from "@/lib/pipeline/normalize";

describe("normalizeTitle", () => {
  it("normalizes case and punctuation", () => {
    expect(normalizeTitle("AI Breakthrough: GPT-5, Released!")).toBe(
      "ai breakthrough gpt 5 released",
    );
  });

  it("collapses duplicate spaces", () => {
    expect(normalizeTitle("  Japan   policy   update  ")).toBe(
      "japan policy update",
    );
  });
});

describe("buildContentHash", () => {
  it("returns deterministic hash for same payload", () => {
    const payload = "same-news-content";
    expect(buildContentHash(payload)).toBe(buildContentHash(payload));
  });

  it("returns different hashes for different payloads", () => {
    expect(buildContentHash("alpha")).not.toBe(buildContentHash("beta"));
  });
});
