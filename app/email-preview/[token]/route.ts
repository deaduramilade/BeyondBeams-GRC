import { hashToken } from "@/lib/tokens";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: Promise<{ token: string }> }) {
  if (process.env.NODE_ENV === "production") return new Response("Not found", { status: 404 });
  const { token } = await params;
  const notification = await db.notification.findUnique({ where: { previewTokenHash: hashToken(token) }, select: { htmlBody: true } });
  return notification ? new Response(notification.htmlBody, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } }) : new Response("Email preview not found.", { status: 404 });
}