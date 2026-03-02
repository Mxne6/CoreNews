import { NextResponse } from "next/server";
import { defaultPipelineStore } from "@/lib/pipeline/run-daily";

export async function GET() {
  const latest = defaultPipelineStore.snapshots.at(-1);
  if (!latest) {
    return NextResponse.json({ generatedAt: null, sections: [] });
  }

  const sections = Object.entries(latest.homePayload as Record<string, unknown[]>).map(
    ([category, events]) => ({
      category,
      events,
    }),
  );

  return NextResponse.json({
    generatedAt: latest.generatedAt.toISOString(),
    sections,
  });
}
