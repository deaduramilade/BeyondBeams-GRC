import { NextResponse } from "next/server";
import { sendReviewReminders } from "@/lib/reminders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const expected = process.env.NOTIFICATION_CRON_SECRET;
  if (expected && request.headers.get("authorization") !== `Bearer ${expected}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await sendReviewReminders());
}