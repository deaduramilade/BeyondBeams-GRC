import { NextResponse } from "next/server";
import { activeSession } from "@/lib/authz";
import { getPortfolioAnalytics } from "@/lib/analytics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await activeSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const analytics = await getPortfolioAnalytics(session.user.tenantId);
  return NextResponse.json(analytics, { headers: { "Cache-Control": "private, no-store" } });
}
