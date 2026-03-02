import Link from "next/link";

type NewsCardProps = {
  id: string;
  title: string;
  summaryCn?: string;
  hotScore?: number;
};

export function NewsCard({ id, title, summaryCn, hotScore }: NewsCardProps) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="text-base font-semibold text-slate-900">
        <Link href={`/news/${id}`} className="hover:underline">
          {title}
        </Link>
      </h3>
      {summaryCn ? <p className="mt-2 text-sm text-slate-600">{summaryCn}</p> : null}
      {typeof hotScore === "number" ? (
        <p className="mt-3 text-xs text-slate-500">热度值 {hotScore.toFixed(1)}</p>
      ) : null}
    </article>
  );
}
