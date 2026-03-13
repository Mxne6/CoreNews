import { describe, expect, it } from "vitest";
import { HOME_EVENT_LIMIT, buildSnapshotPayload, type SnapshotEvent } from "@/lib/pipeline/snapshot-builder";

function event(
  id: number,
  category: string,
  hotScore: number,
  lastPublishedAt?: string,
): SnapshotEvent {
  return {
    id: `${category}:${id}`,
    category,
    canonicalTitle: `${category}-${id}`,
    hotScore,
    articleCount: 1,
    summaryCn: "",
    ...(lastPublishedAt ? { lastPublishedAt } : {}),
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

  it("filters events older than 48h from home payload only", () => {
    const generatedAt = "2026-03-03T08:00:00.000Z";
    const input = [
      event(1, "world", 99, "2026-03-03T06:00:00.000Z"),
      event(2, "world", 98, "2026-03-01T09:00:00.000Z"),
      event(3, "world", 97, "2026-02-28T08:00:00.000Z"),
    ];

    const { homePayload, categoryPayloads } = buildSnapshotPayload(input, generatedAt);

    expect(homePayload.map((item) => item.id)).toEqual(["world:1", "world:2"]);
    expect(categoryPayloads.world.map((item) => item.id)).toEqual(["world:1", "world:2", "world:3"]);
  });

  it("fans out one event into multiple category payloads", () => {
    const input: SnapshotEvent[] = [
      {
        id: "event:1",
        category: "ai",
        categories: ["ai", "tech"],
        canonicalTitle: "AI model impacts chip industry",
        hotScore: 90,
        articleCount: 4,
        summaryCn: "summary",
      },
    ];

    const { categoryPayloads } = buildSnapshotPayload(input, "2026-03-03T08:00:00.000Z");
    expect(categoryPayloads.ai.map((item) => item.id)).toEqual(["event:1"]);
    expect(categoryPayloads.tech.map((item) => item.id)).toEqual(["event:1"]);
  });
});
