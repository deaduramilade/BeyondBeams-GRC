import { NextResponse } from "next/server";
import { sendReviewReminders } from "@/lib/reminders";
import { enforceRateLimit, rateLimitResponse, safeEqual } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const expected = process.env.NOTIFICATION_CRON_SECRET;
  if (!expected) return NextResponse.json({ error: "Cron endpoint is not configured." }, { status: 503 });
  const authorization = request.headers.get("authorization") ?? "";
  if (!safeEqual(authorization, `Bearer ${expected}`)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const limit = await enforceRateLimit("cron", "review-reminders"); if (!limit.allowed) { const response = rateLimitResponse(limit); return NextResponse.json({ error: "Too many requests." }, response); }
  return NextResponse.json(await sendReviewReminders());
}