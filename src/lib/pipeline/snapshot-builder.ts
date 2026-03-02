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
