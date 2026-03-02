import type { AmbiguousGroup, AmbiguityResolverClient } from "@/lib/pipeline/resolve-ambiguous";

type DashScopeMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type DashScopeResponse = {
  output?: { text?: string } | Array<{ content?: Array<{ type?: string; text?: string }> }>;
  choices?: Array<{ message?: { content?: string } }>;
};

export function extractDashScopeText(payload: DashScopeResponse): string {
  const directText = (payload.output as { text?: string } | undefined)?.text;
  if (typeof directText === "string" && directText.trim().length > 0) {
    return directText.trim();
  }

  const choiceText = payload.choices?.[0]?.message?.content;
  if (typeof choiceText === "string" && choiceText.trim().length > 0) {
    return choiceText.trim();
  }

  const outputItems = Array.isArray(payload.output) ? payload.output : [];
  for (const item of outputItems) {
    for (const content of item.content ?? []) {
      if (typeof content.text === "string" && content.text.trim().length > 0) {
        return content.text.trim();
      }
    }
  }

  return "";
}

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

  async summarizeEvent(input: {
    title: string;
    category: string;
    articleCount: number;
  }): Promise<string> {
    const messages: DashScopeMessage[] = [
      {
        role: "system",
        content: "You are a concise Chinese news editor. Return only one short Chinese summary.",
      },
      {
        role: "user",
        content:
          `请用中文总结该热点事件，控制在 60 字以内，不要添加“据报道”等套话。\n` +
          `标题: ${input.title}\n` +
          `分类: ${input.category}\n` +
          `报道数量: ${input.articleCount}`,
      },
    ];

    return this.requestWithRetry(messages, 3);
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
        const text = extractDashScopeText(payload);
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
