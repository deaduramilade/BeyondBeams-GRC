import { db } from "@/lib/db";
import { hashToken } from "@/lib/tokens";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const item = await db.exportHistory.findFirst({ where: { downloadTokenHash: hashToken(token), downloadedAt: null } });
  if (!item?.artifactBase64 || !item.downloadExpires || item.downloadExpires <= new Date() || item.status !== "COMPLETED") return new Response("This download link is invalid, expired, or already used.", { status: 410 });
  const consumed = await db.exportHistory.updateMany({ where: { id: item.id, downloadTokenHash: hashToken(token), downloadedAt: null }, data: { downloadedAt: new Date(), downloadTokenHash: null } });
  if (consumed.count !== 1) return new Response("This download link has already been used.", { status: 410 });
  const contentType = item.format === "PDF" ? "application/pdf" : item.format === "XLSX" ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : "text/csv; charset=utf-8";
  return new Response(new Uint8Array(Buffer.from(item.artifactBase64, "base64")), { headers: { "Content-Type": contentType, "Content-Disposition": `attachment; filename="${item.fileName}"`, "Cache-Control": "private, no-store" } });
}