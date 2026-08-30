import { NextResponse } from "next/server";
import { metrics } from "@/lib/metrics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(metrics.getSnapshot(), {
    headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
  });
}
