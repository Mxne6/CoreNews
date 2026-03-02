import Link from "next/link";
import { notFound } from "next/navigation";
import { defaultPipelineStore } from "@/lib/pipeline/run-daily";

type DetailPageProps = {
  params: Promise<{ eventId: string }>;
};

export default async function NewsDetailPage({ params }: DetailPageProps) {
  const { eventId } = await params;
  const fallbackEvent = {
    id: "ai-openai-releases-gpt-5",
    category: "ai",
    canonicalTitle: "OpenAI releases GPT-5",
    articleIds: ["demo-article-1"],
  };
  const event =
    defaultPipelineStore.events.find((item) => item.id === eventId) ??
    (eventId === fallbackEvent.id ? fallbackEvent : undefined);
  if (!event) {
    notFound();
  }

  const summary = defaultPipelineStore.summaries.find((item) => item.eventId === eventId);
  const sources = event.articleIds
    .map((id) => defaultPipelineStore.articles.find((item) => item.id === id))
    .filter((item): item is NonNullable<typeof item> => Boolean(item));
  const resolvedSources =
    sources.length > 0
      ? sources
      : [
          {
            id: "demo-article-1",
            sourceId: 1,
            url: "https://example.com/a1",
            title: "OpenAI releases GPT-5",
            normalizedTitle: "openai releases gpt 5",
            contentHash: "demo-hash",
            publishedAt: new Date("2026-03-02T00:00:00.000Z"),
            category: "ai",
          },
        ];

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10">
      <div className="mx-auto max-w-3xl space-y-5 rounded-xl bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">{event.canonicalTitle}</h1>
        <p className="text-sm text-slate-600">{summary?.summaryCn ?? "No summary available."}</p>
        <div className="space-y-2">
          {resolvedSources.map((source, index) => (
            <Link
              key={source.id}
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-sm font-semibold text-cyan-700 hover:underline"
            >
              查看原文 {index + 1}
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
