import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { timingSafeEqual } from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Webhook extension point for transactional email provider callbacks (bounces, complaints, delivery confirmations).
 * Validates webhook signatures and updates Notification records accordingly.
 */
export async function POST(request: Request) {
  const secret = process.env.EMAIL_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Webhook secret not configured." }, { status: 501 });
  }

  const authHeader = request.headers.get("Authorization") ?? "";
  const expectedAuth = `Bearer ${secret}`;

  if (authHeader.length !== expectedAuth.length) {
    return NextResponse.json({ error: "Invalid authorization." }, { status: 401 });
  }

  const authBuffer = Buffer.from(authHeader);
  const expectedBuffer = Buffer.from(expectedAuth);
  if (!timingSafeEqual(authBuffer, expectedBuffer)) {
    return NextResponse.json({ error: "Invalid authorization." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  const { eventType, recipient } = body;
  if (eventType === "BOUNCE" || eventType === "COMPLAINT") {
    if (recipient) {
      await db.notification.updateMany({
        where: { recipient: String(recipient).toLowerCase() },
        data: { status: eventType === "BOUNCE" ? "BOUNCED" : "COMPLAINED" },
      });
    }
  }

  return NextResponse.json({ received: true });
}
