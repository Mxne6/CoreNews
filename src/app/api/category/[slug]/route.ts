import { NextResponse } from "next/server";
import { readCategorySnapshot } from "@/lib/pipeline/read-model";
import { isKnownCategory } from "@/lib/ui/categories";

export async function GET(
  request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug } = await context.params;
  if (!isKnownCategory(slug)) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const { searchParams } = new URL(request.url);
  const page = Number(searchParams.get("page") ?? "1");
  const pageSize = Number(searchParams.get("pageSize") ?? "20");
  return NextResponse.json(await readCategorySnapshot(slug, page, pageSize));
}
