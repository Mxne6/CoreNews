import { NextResponse } from "next/server";
import { defaultPipelineStore } from "@/lib/pipeline/run-daily";

export async function GET(
  _request: Request,
  context: { params: Promise<{ eventId: string }> },
) {
  const { eventId } = await context.params;
  const event = defaultPipelineStore.events.find((item) => item.id === eventId);
  if (!event) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const summary = defaultPipelineStore.summaries.find((item) => item.eventId === eventId);
  const sources = event.articleIds
    .map((articleId) => defaultPipelineStore.articles.find((item) => item.id === articleId))
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .map((item) => ({
      sourceId: item.sourceId,
      url: item.url,
      title: item.title,
      publishedAt: item.publishedAt.toISOString(),
    }));

  return NextResponse.json({
    id: event.id,
    title: event.canonicalTitle,
    category: event.category,
    hotScore: event.hotScore,
    summaryCn: summary?.summaryCn ?? "",
    sources,
  });
}
