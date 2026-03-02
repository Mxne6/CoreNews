import { NextResponse } from "next/server";
import { readNewsDetail } from "@/lib/pipeline/read-model";

export async function GET(
  _request: Request,
  context: { params: Promise<{ eventId: string }> },
) {
  const { eventId } = await context.params;
  const detail = await readNewsDetail(eventId);
  if (!detail) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json(detail);
}
