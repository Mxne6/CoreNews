export type SnapshotEvent = {
  id: string;
  category: string;
  canonicalTitle: string;
  hotScore: number;
  articleCount: number;
  summaryCn: string;
};

export const HOME_EVENT_LIMIT = 40;

function sortSnapshotEvents(events: SnapshotEvent[]) {
  return [...events].sort((a, b) => {
    if (b.hotScore !== a.hotScore) {
      return b.hotScore - a.hotScore;
    }
    if (b.articleCount !== a.articleCount) {
      return b.articleCount - a.articleCount;
    }
    return a.id.localeCompare(b.id);
  });
}

export function buildSnapshotPayload(events: SnapshotEvent[]) {
  const sorted = sortSnapshotEvents(events);
  const categoryPayloads: Record<string, SnapshotEvent[]> = {};

  for (const event of sorted) {
    if (!categoryPayloads[event.category]) {
      categoryPayloads[event.category] = [];
    }
    categoryPayloads[event.category].push(event);
  }

  const homePayload = sorted.slice(0, HOME_EVENT_LIMIT);

  return { homePayload, categoryPayloads };
}

export function buildSnapshotRows(
  runId: number,
  events: SnapshotEvent[],
  generatedAt: string,
  version = "v1",
) {
  const { homePayload, categoryPayloads } = buildSnapshotPayload(events);
  const rows: Array<{
    run_id: number;
    key: string;
    payload_json: unknown;
    generated_at: string;
    version: string;
  }> = [
    {
      run_id: runId,
      key: "home",
      payload_json: homePayload,
      generated_at: generatedAt,
      version,
    },
  ];

  for (const [category, payload] of Object.entries(categoryPayloads)) {
    rows.push({
      run_id: runId,
      key: `category:${category}`,
      payload_json: payload,
      generated_at: generatedAt,
      version,
    });
  }

  return rows;
}

