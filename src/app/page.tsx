import { NewsCard } from "@/components/news-card";
import { readHomeSnapshot } from "@/lib/pipeline/read-model";
import { getCategoryLabel } from "@/lib/ui/categories";

export const revalidate = 120;

type HomeEvent = {
  id: string;
  category: string;
  canonicalTitle: string;
  summaryCn?: string;
  hotScore?: number;
};

const FALLBACK_EVENTS: HomeEvent[] = [
  {
    id: "ai-openai-releases-gpt-5",
    category: "ai",
    canonicalTitle: "OpenAI 发布 GPT-5 模型",
    summaryCn: "用于初始启动的演示兜底事件。",
    hotScore: 88.2,
  },
];

export default async function HomePage() {
  const snapshot = await readHomeSnapshot();
  const snapshotEvents = snapshot.events as HomeEvent[];
  const events = snapshotEvents.length > 0 ? snapshotEvents : FALLBACK_EVENTS;

  return (
    <main className="page-shell px-5 pb-14 sm:px-8 sm:pb-16">
      <div className="content-container">
        <section className="rounded-3xl border border-[var(--line)] bg-[linear-gradient(145deg,rgba(17,24,39,0.92),rgba(15,23,42,0.87))] p-6 shadow-[0_20px_50px_rgba(2,6,23,0.52)] sm:p-8">
          <header>
            <p className="text-xs uppercase tracking-[0.22em] text-blue-300/90">每日情报看板</p>
            <h1 className="mt-4 text-4xl font-semibold text-slate-100 sm:text-[2.7rem]">全站热点 Top 40</h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-400/90 sm:text-base">
              首页按热度统一排序展示全站热点，前 3 条做视觉强化。分类浏览请使用上方导航。
            </p>
          </header>

          <div className="my-6 h-px w-full bg-gradient-to-r from-transparent via-white/12 to-transparent sm:my-7" />

          <div className="mb-5 flex items-center justify-between gap-3">
            <h2 className="text-2xl font-semibold text-slate-100">今日热点流</h2>
            <p className="text-xs text-slate-400/90">共 {events.length} 条</p>
          </div>

          <div className="grid gap-3 sm:gap-3.5" data-testid="home-news-list">
            {events.map((event, index) => (
              <NewsCard
                key={event.id}
                id={event.id}
                index={index}
                title={event.canonicalTitle}
                summaryCn={event.summaryCn}
                hotScore={event.hotScore}
                meta={getCategoryLabel(event.category)}
              />
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
