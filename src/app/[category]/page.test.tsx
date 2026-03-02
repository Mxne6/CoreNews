import { beforeEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import CategoryPage from "@/app/[category]/page";
import { defaultPipelineStore } from "@/lib/pipeline/run-daily";

beforeEach(() => {
  defaultPipelineStore.snapshots.length = 0;
  defaultPipelineStore.snapshots.push({
    generatedAt: new Date("2026-03-02T00:00:00.000Z"),
    homePayload: {},
    categoryPayloads: {
      ai: Array.from({ length: 7 }).map((_, index) => ({
        id: `ai:event-${index + 1}`,
        canonicalTitle: `AI Event ${index + 1}`,
        hotScore: 90 - index,
      })),
    },
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
  });
});
