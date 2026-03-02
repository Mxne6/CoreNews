import Link from "next/link";
import { NewsCard } from "@/components/news-card";
import { readCategorySnapshot } from "@/lib/pipeline/read-model";

export const dynamic = "force-dynamic";

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

  const categorySnapshot = await readCategorySnapshot(category, page, PAGE_SIZE);
  const snapshotEvents = categorySnapshot.events as CategoryEvent[];

  const fallbackEvents: CategoryEvent[] = [
    {
      id: "ai-openai-releases-gpt-5",
      canonicalTitle: "OpenAI releases GPT-5",
      summaryCn: "Demo fallback event for initial bootstrap.",
      hotScore: 88.2,
    },
  ];

  const events =
    snapshotEvents.length > 0
      ? snapshotEvents
      : category === "ai" && page === 1
        ? fallbackEvents
        : [];
  const total = categorySnapshot.total > 0 ? categorySnapshot.total : events.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const previousHref = `/${category}?page=${Math.max(1, page - 1)}`;
  const nextHref = `/${category}?page=${Math.min(totalPages, page + 1)}`;

  return (
    <main className="min-h-screen bg-slate-100 px-6 py-10">
      <div className="mx-auto max-w-4xl space-y-6">
        <header className="rounded-xl bg-white p-5 shadow-sm">
          <h1 className="text-2xl font-bold text-slate-900">{category} 热点</h1>
          <p className="mt-1 text-sm text-slate-600">
            第 {page} 页，当前显示 {events.length} 条，共 {total} 条。
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
        <nav className="flex items-center justify-between rounded-xl bg-white p-4 text-sm shadow-sm">
          {page > 1 ? (
            <Link href={previousHref} className="font-semibold text-cyan-700 hover:underline">
              上一页
            </Link>
          ) : (
            <span className="text-slate-400">上一页</span>
          )}
          <span className="text-slate-600">
            {page}/{totalPages}
          </span>
          {page < totalPages ? (
            <Link href={nextHref} className="font-semibold text-cyan-700 hover:underline">
              下一页
            </Link>
          ) : (
            <span className="text-slate-400">下一页</span>
          )}
        </nav>
      </div>
    </main>
  );
}
