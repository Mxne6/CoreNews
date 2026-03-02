import { beforeEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import HomePage from "@/app/page";
import { defaultPipelineStore } from "@/lib/pipeline/run-daily";

beforeEach(() => {
  defaultPipelineStore.snapshots.length = 0;
  defaultPipelineStore.snapshots.push({
    generatedAt: new Date("2026-03-02T00:00:00.000Z"),
    homePayload: {
      ai: [
        {
          id: "ai:event-1",
          canonicalTitle: "OpenAI releases GPT-5",
          hotScore: 88.2,
          summaryCn: "示例摘要",
        },
      ],
    },
    categoryPayloads: {},
  });
});

describe("HomePage", () => {
  it("renders section and top events", async () => {
    const ui = await HomePage();
    render(ui);

    expect(screen.getByText("ai")).toBeInTheDocument();
    expect(screen.getByText("OpenAI releases GPT-5")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "查看更多" })).toBeInTheDocument();
  });
});
