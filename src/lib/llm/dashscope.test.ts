import { describe, expect, it, vi } from "vitest";
import { DashScopeClient, extractDashScopeText } from "@/lib/llm/dashscope";

describe("extractDashScopeText", () => {
  it("extracts text from chat completions style response", () => {
    const text = extractDashScopeText({
      choices: [
        {
          message: {
            content: "summary from choices",
          },
        },
      ],
    });
    expect(text).toBe("summary from choices");
  });

  it("extracts text from responses style output", () => {
    const text = extractDashScopeText({
      output: [
        {
          content: [
            {
              type: "output_text",
              text: "summary from output",
            },
          ],
        },
      ],
    });
    expect(text).toBe("summary from output");
  });
});

describe("DashScopeClient.summarizeEvent", () => {
  it("returns summary text from mocked dashscope response", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: "mock summary" } }],
      }),
    }));
    // @ts-expect-error test override
    global.fetch = fetchMock;

    const client = new DashScopeClient("test-key");
    const summary = await client.summarizeEvent({
      title: "OpenAI releases GPT-5",
      category: "ai",
      articleCount: 4,
    });

    const firstCall = fetchMock.mock.calls[0] as unknown as
      | [RequestInfo | URL, RequestInit?]
      | undefined;
    const requestInit = firstCall?.[1];
    const payload = JSON.parse(String(requestInit?.body ?? "")) as {
      messages: Array<{ role: string; content: string }>;
    };

    expect(summary.length).toBeGreaterThanOrEqual(45);
    expect(summary).toContain("关键进展");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(payload.messages[1]?.content).toContain("90-140");
  });
});

describe("DashScopeClient.translateTitleToChinese", () => {
  it("returns translated Chinese title from mocked response", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: "OpenAI 发布 GPT-5 模型" } }],
      }),
    }));
    // @ts-expect-error test override
    global.fetch = fetchMock;

    const client = new DashScopeClient("test-key");
    const translated = await client.translateTitleToChinese({
      title: "OpenAI releases GPT-5",
      category: "ai",
    });

    const firstCall = fetchMock.mock.calls[0] as unknown as
      | [RequestInfo | URL, RequestInit?]
      | undefined;
    const requestInit = firstCall?.[1];
    const payload = JSON.parse(String(requestInit?.body ?? "")) as {
      messages: Array<{ role: string; content: string }>;
    };

    expect(translated).toBe("OpenAI 发布 GPT-5 模型");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(payload.messages[0]?.content).toContain("Translate headline to concise Chinese");
  });
});

describe("DashScopeClient.summarizeEventWithTags", () => {
  it("returns summary and tags from a single llm response", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [
          {
            message: {
              content:
                "{\"summary\":\"关键进展摘要内容，覆盖影响与后续观察。\",\"tags\":[\"关税\",\"供应链\",\"政策\"]}",
            },
          },
        ],
      }),
    }));
    // @ts-expect-error test override
    global.fetch = fetchMock;

    const client = new DashScopeClient("test-key");
    const result = await client.summarizeEventWithTags({
      title: "Tariff policy update",
      category: "policy",
      articleCount: 6,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.summary).toContain("关键进展");
    expect(result.tags).toEqual(["关税", "供应链", "政策"]);
  });
});
