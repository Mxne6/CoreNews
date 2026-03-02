import { describe, expect, it } from "vitest";
import { HOME_EVENT_LIMIT, buildSnapshotPayload, type SnapshotEvent } from "@/lib/pipeline/snapshot-builder";

function event(id: number, category: string, hotScore: number): SnapshotEvent {
  return {
    id: `${category}:${id}`,
    category,
    canonicalTitle: `${category}-${id}`,
    hotScore,
    articleCount: 1,
    summaryCn: "",
  };
}

describe("buildSnapshotPayload", () => {
  it("builds home payload with global top 40 only", () => {
    const events: SnapshotEvent[] = [];

    for (let i = 0; i < 50; i += 1) {
      events.push(event(i, "ai", 200 - i));
    }
    for (let i = 0; i < 50; i += 1) {
      events.push(event(i, "world", 150 - i));
    }
    for (let i = 0; i < 50; i += 1) {
      events.push(event(i, "tech", 100 - i));
    }

    const { homePayload } = buildSnapshotPayload(events);

    expect(homePayload).toHaveLength(HOME_EVENT_LIMIT);
    expect(new Set(homePayload.map((item) => item.category))).toEqual(new Set(["ai"]));
  });

  it("keeps category payload sorted by hot score desc", () => {
    const input = [event(1, "ai", 80), event(2, "ai", 95), event(3, "ai", 88)];
    const { categoryPayloads } = buildSnapshotPayload(input);

    expect(categoryPayloads.ai.map((item) => item.hotScore)).toEqual([95, 88, 80]);
  });
});
