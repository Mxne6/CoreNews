import { NextResponse } from "next/server";
import { readPipelineHealth } from "@/lib/pipeline/read-model";

export async function GET() {
  return NextResponse.json(await readPipelineHealth());
}
