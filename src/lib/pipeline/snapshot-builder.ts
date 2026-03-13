export type SnapshotEvent = {
  id: string;
  category: string;
  categories?: string[];
  tags?: string[];
  canonicalTitle: string;
  hotScore: number;
  articleCount: number;
  summaryCn: string;
  lastPublishedAt?: string;
};

export const HOME_EVENT_LIMIT = 40;
const HOME_HOT_WINDOW_HOURS = 48;

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

function isWithinHomeHotWindow(event: SnapshotEvent, generatedAt: Date): boolean {
  if (!event.lastPublishedAt) {
    return true;
  }

  const publishedAt = new Date(event.lastPublishedAt);
  if (Number.isNaN(publishedAt.getTime())) {
    return true;
  }

  return generatedAt.getTime() - publishedAt.getTime() <= HOME_HOT_WINDOW_HOURS * 3_600_000;
}

export function buildSnapshotPayload(events: SnapshotEvent[], generatedAtInput?: string | Date) {
  const sorted = sortSnapshotEvents(events);
  const categoryPayloads: Record<string, SnapshotEvent[]> = {};

  for (const event of sorted) {
    const keys = [...new Set([event.category, ...(event.categories ?? [])])];
    for (const key of keys) {
      if (!categoryPayloads[key]) {
        categoryPayloads[key] = [];
      }
      categoryPayloads[key].push(event);
    }
  }

  const generatedAt =
    generatedAtInput instanceof Date
      ? generatedAtInput
      : generatedAtInput
        ? new Date(generatedAtInput)
        : null;
  const homeCandidates =
    generatedAt && !Number.isNaN(generatedAt.getTime())
      ? sorted.filter((event) => isWithinHomeHotWindow(event, generatedAt))
      : sorted;
  const homePayload = homeCandidates.slice(0, HOME_EVENT_LIMIT);

  return { homePayload, categoryPayloads };
}

export function buildSnapshotRows(
  runId: number,
  events: SnapshotEvent[],
  generatedAt: string,
  version = "v1",
) {
  const { homePayload, categoryPayloads } = buildSnapshotPayload(events, generatedAt);
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
