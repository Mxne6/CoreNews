import { NewsCard } from "@/components/news-card";
import { defaultPipelineStore } from "@/lib/pipeline/run-daily";

type CategoryPageProps = {
  params: Promise<{ category: string }>;
  searchParams: Promise<{ page?: string }>;
};

type CategoryEvent = {
  id: string;
  canonicalTitle: string;
  summaryCn?: string;
  hotScore?: number;
};

const PAGE_SIZE = 5;

export default async function CategoryPage({
  params,
  searchParams,
}: CategoryPageProps) {
  const { category } = await params;
  const { page: pageRaw } = await searchParams;
  const page = Math.max(1, Number(pageRaw ?? "1"));

  const latestSnapshot = defaultPipelineStore.snapshots.at(-1);
  const categoryPayloads = (latestSnapshot?.categoryPayloads ?? {}) as Record<
    string,
    CategoryEvent[]
  >;
  const fallbackEvents: CategoryEvent[] = [
    {
      id: "ai-openai-releases-gpt-5",
      canonicalTitle: "OpenAI releases GPT-5",
      summaryCn: "Demo fallback event for initial bootstrap.",
      hotScore: 88.2,
    },
  ];
  const allEvents =
    categoryPayloads[category] && categoryPayloads[category].length > 0
      ? categoryPayloads[category]
      : category === "ai"
        ? fallbackEvents
        : [];
  const start = (page - 1) * PAGE_SIZE;
  const events = allEvents.slice(start, start + PAGE_SIZE);

  return (
    <main className="min-h-screen bg-slate-100 px-6 py-10">
      <div className="mx-auto max-w-4xl space-y-6">
        <header className="rounded-xl bg-white p-5 shadow-sm">
          <h1 className="text-2xl font-bold text-slate-900">{category} 热点</h1>
          <p className="mt-1 text-sm text-slate-600">
            Page {page}, showing {events.length} of {allEvents.length} events.
          </p>
        </header>
        <div className="grid gap-3">
          {events.map((event) => (
            <NewsCard
              key={event.id}
              id={event.id}
              title={event.canonicalTitle}
              summaryCn={event.summaryCn}
              hotScore={event.hotScore}
            />
          ))}
        </div>
      </div>
    </main>
  );
}
