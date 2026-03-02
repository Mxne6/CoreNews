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

    expect(summary).toBe("mock summary");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
