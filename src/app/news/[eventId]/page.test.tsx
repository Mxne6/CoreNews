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
    title: "OpenAI releases GPT-5",
    category: "ai",
    hotScore: 88,
    summaryCn: "摘要内容",
    sources: [
      {
        sourceId: 1,
        sourceName: "Reuters",
        url: "https://example.com/a1",
        title: "OpenAI releases GPT-5",
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

    expect(screen.getByText("Reuters")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: "查看原文 1" });
    expect(link).toHaveAttribute("href", "https://example.com/a1");
    expect(link).toHaveAttribute("target", "_blank");
  });
});
