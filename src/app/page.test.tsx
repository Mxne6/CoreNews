import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import HomePage from "@/app/page";

const readHomeSnapshotMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/pipeline/read-model", () => ({
  readHomeSnapshot: readHomeSnapshotMock,
}));

beforeEach(() => {
  readHomeSnapshotMock.mockReset();
  readHomeSnapshotMock.mockResolvedValue({
    generatedAt: "2026-03-02T00:00:00.000Z",
    events: [
      {
        id: "tech:event-1",
        category: "tech",
        canonicalTitle: "OpenAI 发布 GPT-5 模型",
        hotScore: 88.2,
        summaryCn: "示例摘要",
      },
      {
        id: "tech:event-2",
        category: "tech",
        canonicalTitle: "谷歌发布新一代开发工具",
        hotScore: 75.5,
        summaryCn: "科技板块示例摘要",
      },
      {
        id: "international:event-3",
        category: "international",
        canonicalTitle: "国际油价出现明显波动",
        hotScore: 70.2,
        summaryCn: "国际板块示例摘要",
      },
    ],
  });
});

describe("HomePage", () => {
  it("renders unified top feed", async () => {
    const ui = await HomePage();
    render(ui);

    expect(screen.getByText("全站热点 Top 40")).toBeInTheDocument();
    expect(screen.getByText("OpenAI 发布 GPT-5 模型")).toBeInTheDocument();
    expect(screen.getByText("共 3 条")).toBeInTheDocument();
    expect(screen.getByText("TOP 1")).toBeInTheDocument();
    expect(screen.getByText("TOP 2")).toBeInTheDocument();
  });
});

