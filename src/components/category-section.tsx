import Link from "next/link";
import { NewsCard } from "@/components/news-card";

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
  return (
    <section className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold tracking-tight text-slate-900">{category}</h2>
        <Link href={`/${category}`} className="text-sm font-semibold text-cyan-700 hover:underline">
          查看更多
        </Link>
      </div>
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
    </section>
  );
}
