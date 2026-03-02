import Link from "next/link";
import { notFound } from "next/navigation";
import { readNewsDetail } from "@/lib/pipeline/read-model";

export const revalidate = 120;

type DetailPageProps = {
  params: Promise<{ eventId: string }>;
};

const FALLBACK_DETAIL = {
  id: "ai-openai-releases-gpt-5",
  title: "OpenAI 发布 GPT-5 模型",
  category: "ai",
  hotScore: 88.2,
  summaryCn: "用于初始启动的演示兜底事件。",
  sources: [
    {
      sourceId: 1,
      sourceName: "演示来源",
      url: "https://example.com/a1",
      title: "OpenAI 发布 GPT-5 模型",
      publishedAt: "2026-03-02T00:00:00.000Z",
      authorityWeight: 1,
    },
  ],
};

function formatPublishedAt(value: string | null): string {
  if (!value) {
    return "时间未知";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "时间未知";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

export default async function NewsDetailPage({ params }: DetailPageProps) {
  const { eventId } = await params;
  const detail =
    (await readNewsDetail(eventId)) ??
    (eventId === FALLBACK_DETAIL.id ? FALLBACK_DETAIL : null);

  if (!detail) {
    notFound();
  }

  const primarySource = detail.sources[0];

  return (
    <main className="page-shell px-5 pb-12 sm:px-8 sm:pb-16">
      <article className="content-container space-y-8 rounded-2xl border border-[var(--line)] bg-[linear-gradient(150deg,rgba(17,24,39,0.95),rgba(15,23,42,0.88))] px-6 py-8 shadow-[0_18px_45px_rgba(2,6,23,0.5)] sm:px-10">
        <header className="space-y-4 text-center">
          <p className="text-xs uppercase tracking-[0.2em] text-blue-300/85">事件详情</p>
          <h1 className="text-3xl font-semibold leading-tight text-slate-100 sm:text-4xl">{detail.title}</h1>
          <p className="text-sm text-[var(--text-secondary)]">
            {(primarySource?.sourceName ?? "来源未知") + " · " + formatPublishedAt(primarySource?.publishedAt ?? null)}
          </p>
          <div className="mx-auto h-px w-full max-w-2xl bg-[var(--line-soft)]" />
        </header>

        <section className="mx-auto max-w-3xl rounded-xl border border-[var(--line)] bg-[rgba(15,23,42,0.8)] px-5 py-5 text-[1.03rem] leading-8 text-slate-200">
          {detail.summaryCn || "该事件暂未生成摘要。"}
        </section>

        <section className="space-y-3">
          {detail.sources.map((source, index) => (
            <div
              key={`${source.url}-${index}`}
              className="rounded-xl border border-[var(--line)] bg-[rgba(15,23,42,0.62)] px-4 py-4 transition-colors duration-200 ease-out hover:border-white/20"
            >
              <p className="text-sm font-medium text-slate-100">{source.sourceName || `来源 ${source.sourceId}`}</p>
              <p className="mt-1 text-xs text-[var(--text-secondary)]">{formatPublishedAt(source.publishedAt)}</p>
              <Link
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group mt-3 inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-blue-300 transition-colors duration-200 ease-out hover:text-blue-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/70"
              >
                查看原始报道 {index + 1}
                <span className="h-px w-0 bg-blue-300 transition-all duration-200 group-hover:w-5" aria-hidden />
              </Link>
            </div>
          ))}
        </section>
      </article>
    </main>
  );
}
