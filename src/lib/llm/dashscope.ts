import type { AmbiguousGroup, AmbiguityResolverClient } from "@/lib/pipeline/resolve-ambiguous";

type DashScopeMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type DashScopeResponse = {
  output?: { text?: string } | Array<{ content?: Array<{ type?: string; text?: string }> }>;
  choices?: Array<{ message?: { content?: string } }>;
};

const GENERIC_TAGS = new Set([
  "\u70ed\u70b9",
  "\u7126\u70b9",
  "\u8fdb\u5c55",
  "\u5f71\u54cd",
  "\u66f4\u65b0",
  "\u5173\u6ce8",
  "\u52a8\u6001",
  "\u65b0\u95fb",
]);

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

function normalizeModelText(text: string): string {
  return text.trim().replace(/^["']+|["']+$/g, "").trim();
}

function buildDetailedFallbackSummary(input: {
  title: string;
  category: string;
  articleCount: number;
}): string {
  return `${input.title} 在 ${input.category} 领域持续发酵，当前已汇聚 ${input.articleCount} 条跨来源报道。当前焦点集中在关键进展与潜在影响，后续可重点关注监管口径、产业链反应以及官方披露更新。`;
}

function sanitizeTags(raw: unknown): string[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter((item) => item.length >= 2 && item.length <= 8)
    .filter((item) => !GENERIC_TAGS.has(item))
    .slice(0, 3);
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
    const result = await this.summarizeEventWithTags(input);
    return result.summary;
  }

  async summarizeEventWithTags(input: {
    title: string;
    category: string;
    articleCount: number;
  }): Promise<{ summary: string; tags: string[] }> {
    const messages: DashScopeMessage[] = [
      {
        role: "system",
        content:
          "You are a Chinese news editor. Return strict JSON: {\"summary\":\"...\",\"tags\":[\"...\",\"...\"]}.",
      },
      {
        role: "user",
        content:
          "Output JSON object with fields summary and tags.\n" +
          "summary: one paragraph in Chinese, 90-140 chars, must include development, impact/risk, and next watchpoint.\n" +
          "tags: 2-3 Chinese tags, each 2-8 chars, specific nouns only.\n" +
          "No markdown, JSON only.\n" +
          `Title: ${input.title}\n` +
          `Category: ${input.category}\n` +
          `Article Count: ${input.articleCount}`,
      },
    ];

    const text = await this.requestWithRetry(messages, 3);
    try {
      const parsed = JSON.parse(text) as { summary?: unknown; tags?: unknown };
      const summaryText = typeof parsed.summary === "string" ? parsed.summary.trim() : "";
      const summary = summaryText.length >= 45 ? summaryText : buildDetailedFallbackSummary(input);
      return {
        summary,
        tags: sanitizeTags(parsed.tags),
      };
    } catch {
      return {
        summary: buildDetailedFallbackSummary(input),
        tags: [],
      };
    }
  }

  async translateTitleToChinese(input: { title: string; category: string }): Promise<string> {
    const messages: DashScopeMessage[] = [
      {
        role: "system",
        content:
          "You are a Chinese news editor. Translate headline to concise Chinese. Return title text only.",
      },
      {
        role: "user",
        content:
          "Translate this headline into concise Simplified Chinese. Keep factual meaning unchanged and output title only.\n" +
          `Category: ${input.category}\n` +
          `Headline: ${input.title}`,
      },
    ];

    return this.requestWithRetry(messages, 3);
  }

  async extractTopicTags(input: {
    title: string;
    category: string;
    summary: string;
  }): Promise<string[]> {
    const messages: DashScopeMessage[] = [
      {
        role: "system",
        content:
          "You extract Chinese news topic tags. Return strict JSON array with 2-3 short Chinese tags only.",
      },
      {
        role: "user",
        content:
          "Extract 2-3 Chinese topic tags from title and summary.\n" +
          "Tags must be specific nouns/phrases (2-8 chars), no duplicates.\n" +
          "Do not output generic tags like hot topic/update/focus.\n" +
          "Return strict JSON array only.\n" +
          `Category: ${input.category}\n` +
          `Title: ${input.title}\n` +
          `Summary: ${input.summary}`,
      },
    ];

    const text = await this.requestWithRetry(messages, 3);
    try {
      return sanitizeTags(JSON.parse(text) as unknown);
    } catch {
      return [];
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
        const text = normalizeModelText(extractDashScopeText(payload));
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
