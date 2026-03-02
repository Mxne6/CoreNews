import { NextResponse } from "next/server";
import { defaultPipelineStore } from "@/lib/pipeline/run-daily";

export async function GET(
  request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug } = await context.params;
  const latest = defaultPipelineStore.snapshots.at(-1);
  const events = ((latest?.categoryPayloads as Record<string, unknown[]>) ?? {})[slug] ?? [];

  const { searchParams } = new URL(request.url);
  const page = Number(searchParams.get("page") ?? "1");
  const pageSize = Number(searchParams.get("pageSize") ?? "20");
  const start = (page - 1) * pageSize;

  return NextResponse.json({
    category: slug,
    page,
    pageSize,
    total: events.length,
    events: events.slice(start, start + pageSize),
  });
}
