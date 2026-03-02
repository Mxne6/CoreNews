import { describe, expect, it, vi } from "vitest";
import {
  resolveAmbiguousGroups,
  type AmbiguityResolverClient,
} from "@/lib/pipeline/resolve-ambiguous";

const groups = [
  {
    groupId: "g1",
    ambiguous: true,
    articles: [
      { id: "a1", normalizedTitle: "openai releases gpt 5" },
      { id: "a2", normalizedTitle: "openai unveils gpt 5 model" },
    ],
  },
  {
    groupId: "g2",
    ambiguous: false,
    articles: [{ id: "a3", normalizedTitle: "boj updates policy" }],
  },
];

describe("resolveAmbiguousGroups", () => {
  it("only sends ambiguous groups to llm resolver", async () => {
    const client: AmbiguityResolverClient = {
      resolveGroup: vi.fn(async () => ({
        canonicalTitle: "OpenAI releases GPT-5",
        merged: true,
      })),
    };

    const result = await resolveAmbiguousGroups(groups, client);

    expect(client.resolveGroup).toHaveBeenCalledTimes(1);
    expect(result[0].canonicalTitle).toBe("OpenAI releases GPT-5");
    expect(result[1].canonicalTitle).toBe("boj updates policy");
  });

  it("falls back when llm times out, rate limits, or returns empty", async () => {
    const timeoutError = new Error("timeout");
    const rateLimitError = new Error("429");

    const client: AmbiguityResolverClient = {
      resolveGroup: vi
        .fn()
        .mockRejectedValueOnce(timeoutError)
        .mockRejectedValueOnce(rateLimitError)
        .mockResolvedValueOnce({
          canonicalTitle: "",
          merged: false,
        }),
    };

    const [resolved] = await resolveAmbiguousGroups([groups[0]], client);
    expect(resolved.canonicalTitle).toBe("openai releases gpt 5");
    expect(resolved.fallbackReason).toBe("llm_unavailable");
  });
});
