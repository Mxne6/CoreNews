import Link from "next/link";
import { notFound } from "next/navigation";
import { readNewsDetail } from "@/lib/pipeline/read-model";
import { getCategoryLabel, isKnownCategory } from "@/lib/ui/categories";

export const revalidate = 120;

type DetailPageProps = {
  params: Promise<{ eventId: string }>;
};

const FALLBACK_DETAIL = {
  id: "tech-openai-releases-gpt-5",
  title: "OpenAI 发布 GPT-5 模型",
  category: "tech",
  tags: ["科技"],
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

function resolvePublishedBounds(values: Array<string | null | undefined>) {
  const parsed = values
    .filter((value): value is string => Boolean(value))
    .map((value) => new Date(value))
    .filter((date) => !Number.isNaN(date.getTime()))
    .sort((a, b) => a.getTime() - b.getTime());

  return {
    earliest: parsed[0]?.toISOString() ?? null,
    latest: parsed[parsed.length - 1]?.toISOString() ?? null,
  };
}

function averageAuthorityWeight(values: Array<number | null | undefined>): string {
  const normalized = values
    .map((value) => Number(value ?? 1))
    .filter((value) => Number.isFinite(value));
  if (normalized.length === 0) {
    return "--";
  }
  const avg = normalized.reduce((sum, value) => sum + value, 0) / normalized.length;
  return avg.toFixed(2);
}

function splitSummary(summary: string | undefined): string[] {
  const text = summary?.trim() || "该事件暂未生成摘要。";
  const blocks = text
    .split(/\n{2,}/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
  return blocks.length > 0 ? blocks : [text];
}

function getSourceHost(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, "");
  } catch {
    return "链接未知";
  }
}

function resolveDetailTags(input: { tags?: string[] }): string[] {
  const rawTags = Array.isArray(input.tags) ? input.tags : [];
  const labels = rawTags
    .map((item) => String(item).trim())
    .filter((item) => item.length > 0)
    .map((item) => {
      const key = item.toLowerCase();
      return isKnownCategory(key) ? getCategoryLabel(key) : item;
    });
  const deduped = [...new Set(labels)];
  return deduped.length > 0 ? deduped : ["未打标"];
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
  const sourceCount = detail.sources.length;
  const tagLabels = resolveDetailTags({ tags: (detail as { tags?: string[] }).tags });
  const summaryParagraphs = splitSummary(detail.summaryCn);
  const publishedBounds = resolvePublishedBounds(detail.sources.map((item) => item.publishedAt));
  const authorityAvg = averageAuthorityWeight(detail.sources.map((item) => item.authorityWeight));

  return (
    <main className="page-shell px-5 pb-12 sm:px-8 sm:pb-16">
      <article className="content-container rounded-2xl border border-[var(--line)] bg-[linear-gradient(150deg,rgba(17,24,39,0.95),rgba(15,23,42,0.9))] px-6 py-10 shadow-[0_18px_45px_rgba(2,6,23,0.5)] sm:px-10 sm:py-12">
        <header className="border-b border-[var(--line-soft)] pb-8">
          <p className="text-xs uppercase tracking-[0.2em] text-blue-300/85">事件详情</p>
          <h1 className="mt-4 text-3xl font-semibold leading-[1.25] text-slate-100 sm:text-4xl">
            {detail.title}
          </h1>
        </header>

        <section className="mt-6 px-1">
          <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
            <div className="flex flex-wrap items-center gap-2">
              {tagLabels.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center rounded-full border border-blue-300/35 bg-blue-300/10 px-3 py-1 text-sm font-medium text-blue-100"
                >
                  #{tag}
                </span>
              ))}
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/[0.03] px-3 py-1 text-sm font-medium text-slate-100">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-300" aria-hidden />
              热度 {detail.hotScore.toFixed(1)}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/[0.03] px-3 py-1 text-sm font-medium text-slate-100">
              <span className="h-1.5 w-1.5 rounded-full bg-violet-300" aria-hidden />
              来源 {sourceCount} 条
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/[0.03] px-3 py-1 text-sm font-medium text-slate-200">
              权威均值 {authorityAvg}
            </span>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-[var(--line-soft)] pt-3 text-xs text-slate-400/95">
            <span>首发 {formatPublishedAt(publishedBounds.earliest)}</span>
            <span>更新 {formatPublishedAt(publishedBounds.latest)}</span>
            <span>主来源 {primarySource?.sourceName ?? "来源未知"}</span>
          </div>
        </section>

        <section className="mt-10 w-full">
          <div className="mb-5 flex items-center gap-3">
            <span className="h-px w-8 bg-blue-300/70" aria-hidden />
            <h2 className="text-sm font-medium tracking-[0.08em] text-slate-300/90">核心摘要</h2>
          </div>
          <div className="space-y-5 [text-align:justify] [text-justify:inter-ideograph]">
            {summaryParagraphs.map((paragraph, index) => (
              <p
                key={`${index}-${paragraph.slice(0, 16)}`}
                className={
                  index === 0
                    ? "text-[1.14rem] font-medium leading-[1.9] tracking-[0.01em] text-slate-100"
                    : "text-[1.07rem] leading-[1.88] tracking-[0.01em] text-slate-200/95"
                }
              >
                {paragraph}
              </p>
            ))}
          </div>
        </section>

        <section className="mt-12 w-full border-t border-[var(--line-soft)] pt-7">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-medium tracking-[0.08em] text-slate-300/90">来源清单</h2>
            <p className="text-xs text-slate-400/90">共 {sourceCount} 条来源，按时间顺序聚合展示</p>
          </div>
          <ul className="mt-4 space-y-2">
            {detail.sources.map((source, index) => (
              <li
                key={`${source.url}-${index}`}
                className="group rounded-xl border border-transparent px-4 py-4 transition-all duration-200 hover:border-white/10 hover:bg-white/[0.02] sm:px-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex min-w-8 items-center justify-center rounded-full border border-blue-300/35 bg-blue-300/10 px-2 py-0.5 text-xs font-semibold text-blue-200">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <p className="truncate text-sm font-semibold text-slate-100">
                        {source.sourceName || `来源 ${source.sourceId}`}
                      </p>
                      {index === 0 ? (
                        <span className="rounded-full border border-violet-300/35 bg-violet-300/10 px-2 py-0.5 text-[11px] font-medium text-violet-200">
                          主来源
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-2 text-xs text-slate-400/95">
                      {formatPublishedAt(source.publishedAt)} · {getSourceHost(source.url)} · 权重{" "}
                      {Number(source.authorityWeight ?? 1).toFixed(2)}
                    </p>
                  </div>
                  <Link
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-white/10 px-3 py-1.5 text-sm font-medium text-blue-200 transition-all duration-200 ease-out hover:border-blue-300/50 hover:text-blue-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/70"
                  >
                    查看原始报道 {index + 1}
                    <span className="h-px w-0 bg-blue-200 transition-all duration-200 group-hover:w-4" aria-hidden />
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </article>
    </main>
  );
}
