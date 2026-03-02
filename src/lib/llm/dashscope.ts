import type { AmbiguousGroup, AmbiguityResolverClient } from "@/lib/pipeline/resolve-ambiguous";

type DashScopeMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type DashScopeResponse = {
  output?: {
    text?: string;
  };
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class DashScopeClient implements AmbiguityResolverClient {
  private readonly apiKey: string;
  private readonly model: string;

  constructor(apiKey: string, model = "qwen-max") {
    this.apiKey = apiKey;
    this.model = model;
  }

  async resolveGroup(group: AmbiguousGroup): Promise<{ canonicalTitle: string; merged: boolean }> {
    const titles = group.articles.map((item) => `- ${item.normalizedTitle}`).join("\n");
    const messages: DashScopeMessage[] = [
      {
        role: "system",
        content:
          "You merge same-news candidates. Return compact JSON: {\"canonicalTitle\":\"...\",\"merged\":true|false}.",
      },
      {
        role: "user",
        content: `Resolve if these titles are the same event and output canonical title:\n${titles}`,
      },
    ];

    const text = await this.requestWithRetry(messages, 3);
    try {
      const parsed = JSON.parse(text) as { canonicalTitle?: string; merged?: boolean };
      return {
        canonicalTitle: parsed.canonicalTitle?.trim() ?? "",
        merged: parsed.merged ?? false,
      };
    } catch {
      return { canonicalTitle: "", merged: false };
    }
  }

  private async requestWithRetry(messages: DashScopeMessage[], maxRetries: number): Promise<string> {
    let lastError: Error | null = null;
    for (let attempt = 0; attempt < maxRetries; attempt += 1) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15_000);
        const response = await fetch(
          "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${this.apiKey}`,
            },
            body: JSON.stringify({ model: this.model, messages }),
            signal: controller.signal,
          },
        );
        clearTimeout(timeout);

        if (response.status === 429) {
          throw new Error("429");
        }
        if (!response.ok) {
          throw new Error(`dashscope_${response.status}`);
        }

        const payload = (await response.json()) as DashScopeResponse;
        const text = payload.output?.text?.trim() ?? "";
        if (!text) {
          throw new Error("empty");
        }
        return text;
      } catch (error) {
        lastError = error as Error;
        await sleep(500 * (attempt + 1));
      }
    }
    throw lastError ?? new Error("dashscope_unknown");
  }
}
