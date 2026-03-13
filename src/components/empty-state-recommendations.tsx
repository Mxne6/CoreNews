import Link from "next/link";
import { getCategoryLabel } from "@/lib/ui/categories";

type RecommendationItem = {
  id: string;
  category: string;
  canonicalTitle: string;
  hotScore?: number;
};

type EmptyStateRecommendationsProps = {
  currentCategoryLabel: string;
  recommendations: RecommendationItem[];
};

export function EmptyStateRecommendations({
  currentCategoryLabel,
  recommendations,
}: EmptyStateRecommendationsProps) {
  return (
    <section className="rounded-2xl border border-[var(--line)] bg-[linear-gradient(145deg,rgba(17,24,39,0.96),rgba(15,23,42,0.88))] p-6 shadow-[0_16px_36px_rgba(2,6,23,0.45)]">
      <div className="mb-5 flex items-center gap-4">
        <div className="relative h-11 w-11 shrink-0">
          <span className="absolute inset-0 rounded-full border border-blue-300/45" aria-hidden />
          <span className="absolute inset-[7px] rounded-full border border-violet-300/45" aria-hidden />
          <span className="absolute inset-[14px] rounded-full bg-blue-300/85" aria-hidden />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-slate-100">当前板块暂无热点</h3>
          <p className="mt-1 text-sm text-slate-400/90">{currentCategoryLabel} 暂无可展示事件。</p>
          <p className="mt-1 text-sm font-medium text-slate-300">你可能还会关注</p>
        </div>
      </div>

      <div className="grid gap-3" data-testid="empty-state-recommendations">
        {recommendations.slice(0, 3).map((item, index) => (
          <Link
            key={item.id}
            href={`/news/${item.id}`}
            prefetch={false}
            className="group rounded-xl border border-white/10 bg-white/[0.03] p-4 transition-all duration-200 ease-out hover:border-blue-300/45 hover:bg-white/[0.05]"
          >
            <p className="text-xs text-slate-400">
              推荐 {index + 1} · {getCategoryLabel(item.category)}
              {typeof item.hotScore === "number" ? ` · 热度 ${item.hotScore.toFixed(1)}` : ""}
            </p>
            <p className="mt-2 text-base font-semibold text-slate-100 transition-colors duration-200 group-hover:text-blue-200">
              {item.canonicalTitle}
            </p>
          </Link>
        ))}
      </div>
    </section>
  );
}
