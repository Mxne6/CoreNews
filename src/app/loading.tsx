export default function GlobalLoading() {
  return (
    <main className="page-shell px-5 pb-14 sm:px-8 sm:pb-16">
      <div className="content-container">
        <div
          className="rounded-2xl border border-[var(--line)] bg-[linear-gradient(145deg,rgba(17,24,39,0.9),rgba(15,23,42,0.86))] px-5 py-4 shadow-[0_14px_34px_rgba(2,6,23,0.36)]"
          data-testid="route-loading-indicator"
        >
          <p className="text-sm text-slate-300">正在加载页面内容...</p>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.08]">
            <div className="h-full w-1/3 animate-pulse rounded-full bg-gradient-to-r from-blue-400 to-violet-400" />
          </div>
        </div>
      </div>
    </main>
  );
}
