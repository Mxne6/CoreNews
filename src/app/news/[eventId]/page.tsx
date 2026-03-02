import Link from "next/link";
import { notFound } from "next/navigation";
import { defaultPipelineStore } from "@/lib/pipeline/run-daily";

type DetailPageProps = {
  params: Promise<{ eventId: string }>;
};

export default async function NewsDetailPage({ params }: DetailPageProps) {
  const { eventId } = await params;
  const event = defaultPipelineStore.events.find((item) => item.id === eventId);
  if (!event) {
    notFound();
  }

  const summary = defaultPipelineStore.summaries.find((item) => item.eventId === eventId);
  const sources = event.articleIds
    .map((id) => defaultPipelineStore.articles.find((item) => item.id === id))
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10">
      <div className="mx-auto max-w-3xl space-y-5 rounded-xl bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">{event.canonicalTitle}</h1>
        <p className="text-sm text-slate-600">{summary?.summaryCn ?? "No summary available."}</p>
        <div className="space-y-2">
          {sources.map((source, index) => (
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
