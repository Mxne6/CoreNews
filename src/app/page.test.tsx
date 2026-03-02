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
    sections: [
      {
        category: "ai",
        events: [
          {
            id: "ai:event-1",
            canonicalTitle: "OpenAI releases GPT-5",
            hotScore: 88.2,
            summaryCn: "示例摘要",
          },
        ],
      },
    ],
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
