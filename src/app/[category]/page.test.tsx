import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import CategoryPage from "@/app/[category]/page";

const readCategorySnapshotMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/pipeline/read-model", () => ({
  readCategorySnapshot: readCategorySnapshotMock,
}));

beforeEach(() => {
  readCategorySnapshotMock.mockReset();
  readCategorySnapshotMock.mockResolvedValue({
    category: "ai",
    page: 2,
    pageSize: 5,
    total: 12,
    events: [
      { id: "ai:event-6", canonicalTitle: "AI Event 6", hotScore: 84 },
      { id: "ai:event-7", canonicalTitle: "AI Event 7", hotScore: 83 },
    ],
  });
});

describe("CategoryPage", () => {
  it("renders paginated events by category", async () => {
    const ui = await CategoryPage({
      params: Promise.resolve({ category: "ai" }),
      searchParams: Promise.resolve({ page: "2" }),
    });
    render(ui);

    expect(screen.getByText("ai 热点")).toBeInTheDocument();
    expect(screen.getByText("AI Event 6")).toBeInTheDocument();
    expect(screen.queryByText("AI Event 1")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "上一页" })).toHaveAttribute("href", "/ai?page=1");
    expect(screen.getByRole("link", { name: "下一页" })).toHaveAttribute("href", "/ai?page=3");
  });
});
