export type SnapshotEvent = {
  id: string;
  category: string;
  canonicalTitle: string;
  hotScore: number;
  articleCount: number;
  summaryCn: string;
};

export function buildSnapshotPayload(events: SnapshotEvent[]) {
  const sorted = [...events].sort((a, b) => b.hotScore - a.hotScore);
  const homePayload: Record<string, SnapshotEvent[]> = {};
  const categoryPayloads: Record<string, SnapshotEvent[]> = {};

  for (const event of sorted) {
    if (!categoryPayloads[event.category]) {
      categoryPayloads[event.category] = [];
      homePayload[event.category] = [];
    }
    categoryPayloads[event.category].push(event);
    if (homePayload[event.category].length < 5) {
      homePayload[event.category].push(event);
    }
  }

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
