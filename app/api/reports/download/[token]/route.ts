import { db } from "@/lib/db";
import { hashToken } from "@/lib/tokens";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const item = await db.exportHistory.findUnique({ where: { downloadTokenHash: hashToken(token) } });
  if (!item?.artifactBase64 || !item.downloadExpires || item.downloadExpires <= new Date() || item.status !== "COMPLETED") return new Response("This download link is invalid or has expired.", { status: 410 });
  const contentType = item.format === "PDF" ? "application/pdf" : item.format === "XLSX" ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : "text/csv; charset=utf-8";
  return new Response(new Uint8Array(Buffer.from(item.artifactBase64, "base64")), { headers: { "Content-Type": contentType, "Content-Disposition": `attachment; filename="${item.fileName}"`, "Cache-Control": "private, no-store" } });
}