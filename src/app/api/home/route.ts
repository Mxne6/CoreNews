import { NextResponse } from "next/server";
import { readHomeSnapshot } from "@/lib/pipeline/read-model";

export async function GET() {
  return NextResponse.json(await readHomeSnapshot());
}
