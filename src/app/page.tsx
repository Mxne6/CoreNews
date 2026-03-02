import { CategorySection } from "@/components/category-section";
import { readHomeSnapshot } from "@/lib/pipeline/read-model";

export const dynamic = "force-dynamic";

type HomeEvent = {
  id: string;
  canonicalTitle: string;
  summaryCn?: string;
  hotScore?: number;
};

export default async function HomePage() {
  const snapshot = await readHomeSnapshot();
  const homePayload = Object.fromEntries(
    snapshot.sections.map((section) => [section.category, section.events as HomeEvent[]]),
  );
  const fallbackCategories: Array<[string, HomeEvent[]]> = [
    [
      "ai",
      [
        {
          id: "ai-openai-releases-gpt-5",
          canonicalTitle: "OpenAI releases GPT-5",
          summaryCn: "Demo fallback event for initial bootstrap.",
          hotScore: 88.2,
        },
      ],
    ],
  ];
  const categories = Object.entries(homePayload);
  const sections = categories.length > 0 ? categories : fallbackCategories;

  return (
    <main className="min-h-screen bg-gradient-to-b from-cyan-50 via-white to-slate-100 px-6 py-10">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="space-y-2">
          <h1 className="text-3xl font-black tracking-tight text-slate-900">CoreNews</h1>
          <p className="text-sm text-slate-600">每日热点快照，2-3 分钟快速读完。</p>
        </header>
        <div className="grid gap-5">
          {sections.map(([category, events]) => (
            <CategorySection key={category} category={category} events={events} />
          ))}
        </div>
      </div>
    </main>
  );
}
