import { CategorySection } from "@/components/category-section";
import { defaultPipelineStore } from "@/lib/pipeline/run-daily";

type HomeEvent = {
  id: string;
  canonicalTitle: string;
  summaryCn?: string;
  hotScore?: number;
};

export default async function HomePage() {
  const latestSnapshot = defaultPipelineStore.snapshots.at(-1);
  const homePayload = (latestSnapshot?.homePayload ?? {}) as Record<string, HomeEvent[]>;
  const categories = Object.entries(homePayload);

  return (
    <main className="min-h-screen bg-gradient-to-b from-cyan-50 via-white to-slate-100 px-6 py-10">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="space-y-2">
          <h1 className="text-3xl font-black tracking-tight text-slate-900">CoreNews</h1>
          <p className="text-sm text-slate-600">Daily hotspot snapshot for fast reading.</p>
        </header>
        {categories.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">
            No snapshot yet. Wait for the next scheduled run.
          </p>
        ) : (
          <div className="grid gap-5">
            {categories.map(([category, events]) => (
              <CategorySection key={category} category={category} events={events} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
