import Link from "next/link";
import { NewsCard } from "@/components/news-card";
import { getCategoryHref, getCategoryLabel } from "@/lib/ui/categories";

type SectionEvent = {
  id: string;
  canonicalTitle: string;
  summaryCn?: string;
  hotScore?: number;
};

type CategorySectionProps = {
  category: string;
  events: SectionEvent[];
};

export function CategorySection({ category, events }: CategorySectionProps) {
  const categoryLabel = getCategoryLabel(category);

  return (
    <section className="rounded-2xl border border-[var(--line)] bg-[linear-gradient(145deg,rgba(17,24,39,0.92),rgba(15,23,42,0.85))] p-5 shadow-[0_16px_40px_rgba(2,6,23,0.45)]">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-100">{categoryLabel}</h2>
          <p className="mt-1 text-xs text-[var(--text-secondary)]">本领域高信号热点速览</p>
        </div>
        <Link
          href={getCategoryHref(category)}
          className="group inline-flex items-center gap-2 rounded-md px-2 py-1 text-sm font-medium text-blue-300 transition-colors duration-200 ease-out hover:text-blue-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/70"
        >
          查看全部
          <span className="h-px w-0 bg-blue-300 transition-all duration-200 group-hover:w-4" aria-hidden />
        </Link>
      </div>
      <div className="grid gap-2.5">
        {events.map((event, index) => (
          <NewsCard
            key={event.id}
            id={event.id}
            title={event.canonicalTitle}
            summaryCn={event.summaryCn}
            hotScore={event.hotScore}
            index={index}
          />
        ))}
      </div>
    </section>
  );
}
