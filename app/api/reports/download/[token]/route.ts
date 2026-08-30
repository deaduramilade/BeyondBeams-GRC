import { db } from "@/lib/db";
import { hashToken } from "@/lib/tokens";
import { tokenIsUsable } from "@/lib/token-policy";
import { reportStorage } from "@/lib/report-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const tokenHash = hashToken(token);

  const item = await db.exportHistory.findFirst({
    where: { downloadTokenHash: tokenHash, downloadedAt: null },
  });

  if (!item || !tokenIsUsable(item.downloadExpires, item.downloadedAt !== null) || item.status !== "COMPLETED") {
    // If a matching item was found but was expired/consumed, log the rejection
    if (item) {
      await db.auditEvent.create({
        data: {
          tenantId: item.tenantId,
          actorId: item.generatedById,
          action: "UPDATE",
          entityType: "ExportDownload",
          entityId: item.id,
          summary: `Rejected expired or replayed download attempt for ${item.fileName}`,
        },
      }).catch(() => undefined);
    }
    return new Response("This download link is invalid, expired, or already used.", {
      status: 410,
      headers: {
        "Cache-Control": "private, no-store, no-cache, must-revalidate",
        "Pragma": "no-cache",
        "Expires": "0",
      },
    });
  }

  // Atomically consume token
  const consumed = await db.exportHistory.updateMany({
    where: { id: item.id, downloadTokenHash: tokenHash, downloadedAt: null },
    data: { downloadedAt: new Date(), downloadTokenHash: null },
  });

  if (consumed.count !== 1) {
    return new Response("This download link has already been used.", {
      status: 410,
      headers: {
        "Cache-Control": "private, no-store, no-cache, must-revalidate",
        "Pragma": "no-cache",
        "Expires": "0",
      },
    });
  }

  // Retrieve artifact from storage adapter with fallback to database artifactBase64
  let fileBuffer: Buffer | null = null;
  if (item.storageKey) {
    fileBuffer = await reportStorage.getReport(item.storageKey, item.tenantId);
  }
  if (!fileBuffer && item.artifactBase64) {
    fileBuffer = Buffer.from(item.artifactBase64, "base64");
  }

  if (!fileBuffer) {
    return new Response("Report artifact not found in storage.", {
      status: 404,
      headers: { "Cache-Control": "private, no-store" },
    });
  }

  // Record successful download audit event
  await db.auditEvent.create({
    data: {
      tenantId: item.tenantId,
      actorId: item.generatedById,
      action: "CREATE",
      entityType: "ExportDownload",
      entityId: item.id,
      summary: `Downloaded report ${item.fileName}`,
    },
  }).catch(() => undefined);

  const contentType =
    item.format === "PDF"
      ? "application/pdf"
      : item.format === "XLSX"
      ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      : "text/csv; charset=utf-8";

  return new Response(new Uint8Array(fileBuffer), {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${item.fileName}"`,
      "Cache-Control": "private, no-store, no-cache, must-revalidate",
      "Pragma": "no-cache",
      "Expires": "0",
      "X-Content-Type-Options": "nosniff",
    },
  });
}