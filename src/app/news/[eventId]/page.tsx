import Link from "next/link";
import { notFound } from "next/navigation";
import { readNewsDetail } from "@/lib/pipeline/read-model";

export const dynamic = "force-dynamic";

type DetailPageProps = {
  params: Promise<{ eventId: string }>;
};

const FALLBACK_DETAIL = {
  id: "ai-openai-releases-gpt-5",
  title: "OpenAI releases GPT-5",
  category: "ai",
  hotScore: 88.2,
  summaryCn: "Demo fallback event for initial bootstrap.",
  sources: [
    {
      sourceId: 1,
      url: "https://example.com/a1",
      title: "OpenAI releases GPT-5",
      publishedAt: "2026-03-02T00:00:00.000Z",
      authorityWeight: 1,
    },
  ],
};

export default async function NewsDetailPage({ params }: DetailPageProps) {
  const { eventId } = await params;
  const detail =
    (await readNewsDetail(eventId)) ??
    (eventId === FALLBACK_DETAIL.id ? FALLBACK_DETAIL : null);

  if (!detail) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10">
      <div className="mx-auto max-w-3xl space-y-5 rounded-xl bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">{detail.title}</h1>
        <p className="text-sm text-slate-600">{detail.summaryCn || "暂无摘要。"}</p>
        <div className="space-y-2">
          {detail.sources.map((source, index) => (
            <Link
              key={`${source.url}-${index}`}
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
