import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import NewsDetailPage from "@/app/news/[eventId]/page";

const readNewsDetailMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/pipeline/read-model", () => ({
  readNewsDetail: readNewsDetailMock,
}));

beforeEach(() => {
  readNewsDetailMock.mockReset();
  readNewsDetailMock.mockResolvedValue({
    id: "1",
    title: "OpenAI 发布 GPT-5 模型",
    category: "tech",
    tags: ["MODEL"],
    hotScore: 88,
    summaryCn: "摘要内容",
    sources: [
      {
        sourceId: 1,
        sourceName: "路透社",
        url: "https://example.com/a1",
        title: "OpenAI 发布 GPT-5 模型",
        publishedAt: "2026-03-02T00:00:00.000Z",
        authorityWeight: 1.2,
      },
    ],
  });
});

describe("NewsDetailPage", () => {
  it("renders source metadata and link", async () => {
    const ui = await NewsDetailPage({
      params: Promise.resolve({ eventId: "1" }),
    });
    render(ui);

    expect(screen.getByText("路透社")).toBeInTheDocument();
    expect(screen.getByText("#MODEL")).toBeInTheDocument();
    expect(screen.getByText(/热度\s*88\.0/)).toBeInTheDocument();
    expect(screen.getByText(/来源\s*1\s*条/)).toBeInTheDocument();
    const link = screen.getByRole("link", { name: "查看原始报道 1" });
    expect(link).toHaveAttribute("href", "https://example.com/a1");
    expect(link).toHaveAttribute("target", "_blank");
  });
});
