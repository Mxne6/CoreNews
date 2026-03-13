import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import CategoryPage from "@/app/category/[slug]/page";

const readCategorySnapshotMock = vi.hoisted(() => vi.fn());
const readHomeSnapshotMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/pipeline/read-model", () => ({
  readCategorySnapshot: readCategorySnapshotMock,
  readHomeSnapshot: readHomeSnapshotMock,
}));

beforeEach(() => {
  readCategorySnapshotMock.mockReset();
  readHomeSnapshotMock.mockReset();
  readCategorySnapshotMock.mockResolvedValue({
    category: "tech",
    page: 2,
    pageSize: 20,
    total: 45,
    events: [
      { id: "tech:event-21", category: "tech", canonicalTitle: "AI 事件 21", hotScore: 84 },
      { id: "tech:event-22", category: "tech", canonicalTitle: "AI 事件 22", hotScore: 83 },
    ],
  });
  readHomeSnapshotMock.mockResolvedValue({
    generatedAt: "2026-03-02T00:00:00.000Z",
    events: [
      {
        id: "tech:event-1",
        category: "tech",
        canonicalTitle: "科技事件 1",
        hotScore: 79,
      },
      {
        id: "international:event-1",
        category: "international",
        canonicalTitle: "国际事件 1",
        hotScore: 77,
      },
      {
        id: "international:event-2",
        category: "international",
        canonicalTitle: "日本事件 1",
        hotScore: 75,
      },
    ],
  });
});

describe("CategoryPage", () => {
  it("renders paginated events by category", async () => {
    const ui = await CategoryPage({
      params: Promise.resolve({ slug: "tech" }),
      searchParams: Promise.resolve({ page: "2" }),
    });
    render(ui);

    expect(screen.getByText("科技 热点情报")).toBeInTheDocument();
    expect(screen.getByText("AI 事件 21")).toBeInTheDocument();
    expect(screen.queryByText("AI 事件 1")).not.toBeInTheDocument();
    expect(readHomeSnapshotMock).not.toHaveBeenCalled();
    expect(screen.queryByText("来源聚合")).not.toBeInTheDocument();
    expect(screen.getAllByText("AI").length).toBeGreaterThan(1);
    expect(screen.getByRole("link", { name: "上一页" })).toHaveAttribute(
      "href",
      "/category/tech?page=1",
    );
    expect(screen.getByRole("link", { name: "下一页" })).toHaveAttribute(
      "href",
      "/category/tech?page=3",
    );
  });

  it("renders cross-category recommendations for empty state", async () => {
    readCategorySnapshotMock.mockResolvedValueOnce({
      category: "health",
      page: 1,
      pageSize: 20,
      total: 0,
      events: [],
    });

    const ui = await CategoryPage({
      params: Promise.resolve({ slug: "health" }),
      searchParams: Promise.resolve({ page: "1" }),
    });
    render(ui);

    expect(readHomeSnapshotMock).toHaveBeenCalledTimes(1);
    expect(screen.getByText("当前板块暂无热点")).toBeInTheDocument();
    expect(screen.getByText("你可能还会关注")).toBeInTheDocument();
    expect(screen.getByText("科技事件 1")).toBeInTheDocument();
    expect(screen.getByText("国际事件 1")).toBeInTheDocument();
  });
});

