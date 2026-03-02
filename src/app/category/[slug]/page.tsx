import Link from "next/link";
import { notFound } from "next/navigation";
import { EmptyStateRecommendations } from "@/components/empty-state-recommendations";
import { NewsCard } from "@/components/news-card";
import { readCategorySnapshot, readHomeSnapshot } from "@/lib/pipeline/read-model";
import { getCategoryLabel, getCategoryHref, isKnownCategory } from "@/lib/ui/categories";

export const revalidate = 120;

type CategoryPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
};

type CategoryEvent = {
  id: string;
  category?: string;
  canonicalTitle: string;
  summaryCn?: string;
  hotScore?: number;
};

const PAGE_SIZE = 20;

export default async function CategoryPage({
  params,
  searchParams,
}: CategoryPageProps) {
  const { slug } = await params;
  const { page: pageRaw } = await searchParams;
  const page = Math.max(1, Number(pageRaw ?? "1"));

  if (!isKnownCategory(slug)) {
    notFound();
  }

  const categorySnapshot = await readCategorySnapshot(slug, page, PAGE_SIZE);
  const events = categorySnapshot.events as CategoryEvent[];
  let recommendationPool: Array<CategoryEvent & { category: string }> = [];
  if (events.length === 0) {
    const homeSnapshot = await readHomeSnapshot();
    recommendationPool = (homeSnapshot.events as CategoryEvent[]).filter(
      (item): item is CategoryEvent & { category: string } =>
        typeof item.category === "string" && item.category !== slug,
    );
  }

  const categoryLabel = getCategoryLabel(slug);
  const total = categorySnapshot.total;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const baseHref = getCategoryHref(slug);
  const previousHref = `${baseHref}?page=${Math.max(1, page - 1)}`;
  const nextHref = `${baseHref}?page=${Math.min(totalPages, page + 1)}`;

  return (
    <main className="page-shell px-5 pb-14 sm:px-8 sm:pb-16">
      <div className="content-container">
        <section className="rounded-3xl border border-[var(--line)] bg-[linear-gradient(145deg,rgba(17,24,39,0.92),rgba(15,23,42,0.87))] p-6 shadow-[0_20px_50px_rgba(2,6,23,0.52)] sm:p-8">
          <header>
            <h1 className="text-3xl font-semibold text-slate-100">{categoryLabel} 热点情报</h1>
            <p className="mt-4 text-sm text-slate-400/90">
              过去 24-72 小时 · 当前展示 {events.length} / {total} 条事件
            </p>
          </header>

          <div className="my-6 h-px w-full bg-gradient-to-r from-transparent via-white/12 to-transparent sm:my-7" />

          {events.length === 0 ? (
            <EmptyStateRecommendations
              currentCategoryLabel={categoryLabel}
              recommendations={recommendationPool}
            />
          ) : (
            <div className="grid gap-3 sm:gap-3.5">
              {events.map((event, index) => (
                <NewsCard
                  key={event.id}
                  id={event.id}
                  index={(page - 1) * PAGE_SIZE + index}
                  title={event.canonicalTitle}
                  summaryCn={event.summaryCn}
                  hotScore={event.hotScore}
                  meta={getCategoryLabel(event.category ?? slug)}
                />
              ))}
            </div>
          )}

          <nav className="mt-5 flex items-center justify-between rounded-xl border border-[var(--line)] bg-[var(--bg-card-soft)] px-4 py-3 text-sm text-slate-200">
            {page > 1 ? (
              <Link
                href={previousHref}
                scroll={false}
                className="cursor-pointer rounded-sm font-medium text-blue-300 transition-colors duration-200 ease-out hover:text-blue-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/70"
              >
                上一页
              </Link>
            ) : (
              <span className="text-slate-500">上一页</span>
            )}

            <span className="text-slate-400/90">
              {page} / {totalPages}
            </span>

            {page < totalPages ? (
              <Link
                href={nextHref}
                scroll={false}
                className="cursor-pointer rounded-sm font-medium text-blue-300 transition-colors duration-200 ease-out hover:text-blue-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/70"
              >
                下一页
              </Link>
            ) : (
              <span className="text-slate-500">下一页</span>
            )}
          </nav>
        </section>
      </div>
    </main>
  );
}
