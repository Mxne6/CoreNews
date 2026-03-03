import Link from "next/link";
import { getCategoryLabel, getHeatLevel } from "@/lib/ui/categories";

type NewsCardProps = {
  id: string;
  title: string;
  summaryCn?: string;
  hotScore?: number;
  index?: number;
  meta?: string;
  categories?: string[];
  tags?: string[];
  updatedAt?: string | null;
};

const HEAT_BG_CLASS: Record<"high" | "medium" | "low", string> = {
  high: "from-[#7c2d12]/30 via-[#c2410c]/22 to-transparent",
  medium: "from-[#4c1d95]/30 via-[#7e22ce]/22 to-transparent",
  low: "from-slate-700/30 via-slate-600/20 to-transparent",
};

const HEAT_META: Record<
  "high" | "medium" | "low",
  { label: string; valueClass: string; labelClass: string }
> = {
  high: {
    label: "高热",
    valueClass: "text-[#ff4d4f]",
    labelClass: "text-[#ff6b6d]",
  },
  medium: {
    label: "关注",
    valueClass: "text-[#f59e0b]",
    labelClass: "text-[#fbbf24]",
  },
  low: {
    label: "观察",
    valueClass: "text-slate-300",
    labelClass: "text-slate-400",
  },
};

const WEAK_TAGS = new Set(["热点", "焦点", "进展", "影响", "更新", "关注", "动态", "新闻"]);

function getHeatProgress(hotScore?: number): number {
  if (typeof hotScore !== "number") {
    return 20;
  }
  return Math.max(8, Math.min(100, Math.round(hotScore)));
}

function getBackgroundFillWidth(hotScore?: number): number {
  const progress = getHeatProgress(hotScore);
  return 40 + progress * 0.2;
}

function formatRelativeTime(updatedAt?: string | null): string {
  if (!updatedAt) {
    return "刚刚";
  }
  const date = new Date(updatedAt);
  if (Number.isNaN(date.getTime())) {
    return "刚刚";
  }
  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.max(0, Math.floor(diffMs / 60_000));
  if (diffMinutes < 1) {
    return "刚刚";
  }
  if (diffMinutes < 60) {
    return `${diffMinutes}分钟前`;
  }
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours}小时前`;
  }
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}天前`;
}

function getRankLabel(index?: number): string {
  if (typeof index !== "number") {
    return "TOP --";
  }
  const rank = index + 1;
  return `TOP ${rank}`;
}

function buildDisplayDescription(input: {
  summary?: string;
  source: string;
  relativeTime: string;
  category: string;
}): string {
  const summary = dedupeSummary(input.summary?.trim() ?? "");
  if (summary.length >= 28) {
    return summary;
  }
  if (summary.length > 0) {
    return `${summary}。${input.source} 持续跟进，${input.relativeTime}更新，重点影响 ${input.category} 板块。`;
  }
  return `${input.source} 持续跟进该事件，${input.relativeTime}更新，相关进展正在快速变化。`;
}

function dedupeSummary(raw: string): string {
  if (!raw) {
    return "";
  }

  const normalized = raw.replace(/\s+/g, " ").trim();
  const clauses = normalized
    .split(/[。！？；]/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

  const seen = new Set<string>();
  const uniqueClauses: string[] = [];
  for (const clause of clauses) {
    if (seen.has(clause)) {
      continue;
    }
    seen.add(clause);
    uniqueClauses.push(clause);
  }

  if (uniqueClauses.length === 0) {
    return normalized;
  }

  return `${uniqueClauses.join("。")}。`;
}

function extractTagCandidatesFromTitle(title: string): string[] {
  const normalized = title
    .replace(/[【】\[\]（）()]/g, " ")
    .replace(/[·|/,:;，。！？、]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const chunks = normalized.split(" ").filter(Boolean);
  return chunks.filter(
    (item) =>
      item.length >= 2 &&
      item.length <= 8 &&
      !WEAK_TAGS.has(item) &&
      !/^[0-9]+$/.test(item),
  );
}

export function NewsCard({
  id,
  title,
  summaryCn,
  hotScore,
  index,
  meta,
  categories,
  tags,
  updatedAt,
}: NewsCardProps) {
  const heat = getHeatLevel(hotScore);
  const heatMeta = HEAT_META[heat];
  const fillWidth = getBackgroundFillWidth(hotScore);
  const rank = typeof index === "number" ? index + 1 : null;
  const rankLabel = getRankLabel(index);
  const isTopTier = rank !== null && rank <= 3;

  const metaTokens = (meta ?? "聚合 · 多源聚合")
    .split(/[·|/]/g)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
  const categoryToken = metaTokens[0] ?? "聚合";
  const categoryTokens =
    categories && categories.length > 0
      ? [...new Set(categories.map((item) => getCategoryLabel(item)))]
      : [categoryToken];
  const tagTokens =
    tags && tags.length > 0
      ? [...new Set(tags.map((item) => item.trim()).filter((item) => item && !WEAK_TAGS.has(item)))].slice(0, 3)
      : [];
  const displayTags = [...(tagTokens.length > 0 ? tagTokens : categoryTokens.slice(0, 3))];
  for (const candidate of extractTagCandidatesFromTitle(title)) {
    if (displayTags.length >= 3) {
      break;
    }
    if (!displayTags.includes(candidate)) {
      displayTags.push(candidate);
    }
  }
  for (const categoryTag of categoryTokens) {
    if (displayTags.length >= 3) {
      break;
    }
    if (!displayTags.includes(categoryTag)) {
      displayTags.push(categoryTag);
    }
  }
  const sourceToken = metaTokens[1] ?? "多源聚合";
  const relativeTime = formatRelativeTime(updatedAt);
  const description = buildDisplayDescription({
    summary: summaryCn,
    source: sourceToken,
    relativeTime,
    category: categoryTokens[0] ?? "聚合",
  });

  return (
    <article
      className="group relative overflow-hidden rounded-xl border border-white/12 bg-[linear-gradient(145deg,rgba(14,20,35,0.96),rgba(10,15,27,0.94))] px-4 py-2.5 shadow-[0_10px_24px_rgba(30,64,175,0.14)] transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-violet-300/45 hover:shadow-[0_16px_34px_rgba(76,29,149,0.24)]"
    >
      <div
        className={`row-fill-grow pointer-events-none absolute inset-y-0 right-0 bg-gradient-to-l ${HEAT_BG_CLASS[heat]}`}
        style={{ width: `${fillWidth}%` }}
        aria-hidden
      />

      <div className="relative flex items-center gap-2">
        <div className="w-[74px] shrink-0">
          {isTopTier ? (
            <span className="inline-flex items-center rounded-full border border-violet-300/45 bg-violet-500/25 px-2.5 py-0.5 text-[0.72rem] font-semibold tracking-[0.1em] text-violet-100 shadow-[0_0_10px_rgba(168,85,247,0.45)] [font-family:var(--font-core-display)]">
              {rankLabel}
            </span>
          ) : (
            <span className="inline-flex text-[0.74rem] font-semibold tracking-[0.09em] text-slate-500 [font-family:var(--font-core-display)]">
              {rankLabel}
            </span>
          )}
        </div>

        <div className="min-w-0 flex flex-1 items-center gap-2">
          <h3 className="min-w-0 max-w-[60%] flex-1 text-[1.08rem] font-semibold leading-6 text-slate-100 sm:text-[1.16rem]">
            <Link
              href={`/news/${id}`}
              className="block truncate cursor-pointer rounded-sm transition-colors duration-200 ease-out hover:text-blue-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/70"
            >
              {title}
            </Link>
          </h3>
          {displayTags.length > 0 ? (
            <div className="hidden shrink-0 items-center gap-1.5 md:flex">
              {displayTags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-md border border-white/12 bg-white/[0.04] px-2 py-0.5 text-[0.72rem] font-medium text-slate-200"
                >
                  {tag}
                </span>
              ))}
            </div>
          ) : null}

        </div>

        <div className="w-[82px] shrink-0 text-right [font-variant-numeric:tabular-nums]">
          <span className={`inline-flex items-center justify-end gap-1 text-[0.98rem] font-semibold ${heatMeta.valueClass}`}>
            <span>{typeof hotScore === "number" ? hotScore.toFixed(1) : "--"}</span>
            <svg
              viewBox="0 0 24 24"
              className={`h-5 w-5 drop-shadow-[0_0_10px_currentColor] ${heatMeta.valueClass}`}
              fill="currentColor"
              aria-hidden
            >
              <path d="M13.8 3.5c.4 2.4-.4 4.1-1.8 5.6-1.1 1.2-1.8 2.2-1.8 3.8 0 1.5 1.2 2.8 2.8 2.8 2.2 0 3.9-1.8 3.9-4 0-2.2-1.2-3.7-3.1-5.5zm-2.5 13.2c-1.2-.7-2-2-2-3.5 0-2.4 1.1-3.9 2.5-5.3.2 1.2.8 2.1 1.8 3 1.1 1 1.8 2 1.8 3.4 0 2.1-1.8 3.8-4 3.8-.4 0-.8-.1-1.1-.2z" />
            </svg>
          </span>
          <span className={`mt-0.5 block text-[0.66rem] tracking-[0.08em] ${heatMeta.labelClass}`}>
            {heatMeta.label}
          </span>
        </div>
      </div>

      <p className="relative mt-1.5 border-l border-white/14 pl-2 text-[0.98rem] leading-[1.7] text-slate-300/90">
        {description}
      </p>
    </article>
  );
}
