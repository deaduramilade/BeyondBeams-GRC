import { NextResponse } from "next/server";
import { activeSession } from "@/lib/authz";
import {
  auditExportRoles,
  auditCsv,
  auditPdf,
  auditWorkbook,
  boardPdf,
  controlEffectivenessCsv,
  controlEffectivenessPdf,
  controlEffectivenessWorkbook,
  exportAllowance,
  exposureSummaryCsv,
  exposureSummaryPdf,
  exposureSummaryWorkbook,
  gapAnalysisPdf,
  gapAnalysisWorkbook,
  overdueItemsCsv,
  overdueItemsPdf,
  overdueItemsWorkbook,
  riskCsv,
  riskPdf,
  riskWorkbook,
  treatmentStatusCsv,
  treatmentStatusPdf,
  treatmentStatusWorkbook,
} from "@/lib/reporting";
import { db } from "@/lib/db";
import { appUrl, createToken, hashToken } from "@/lib/tokens";
import { sendNotificationEmail } from "@/lib/email";
import { z } from "zod";
import { clientAddress, enforceRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { completeJob, enqueueJob, failJob } from "@/lib/jobs";
import { reportStorage } from "@/lib/report-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const validReportTypes = [
  "RISK_REGISTER",
  "BOARD_REPORT",
  "GAP_ANALYSIS",
  "AUDIT_TRAIL",
  "TREATMENT_STATUS",
  "CONTROL_EFFECTIVENESS",
  "OVERDUE_ITEMS",
  "EXPOSURE_SUMMARY",
] as const;

async function generateReportBuffer(tenantId: string, type: string, format: "CSV" | "XLSX" | "PDF", from?: string, to?: string): Promise<Buffer> {
  switch (type) {
    case "BOARD_REPORT":
      return boardPdf(tenantId);
    case "GAP_ANALYSIS":
      return format === "XLSX" ? gapAnalysisWorkbook(tenantId) : gapAnalysisPdf(tenantId);
    case "AUDIT_TRAIL":
      return format === "PDF"
        ? auditPdf(tenantId, from, to)
        : format === "XLSX"
        ? auditWorkbook(tenantId, from, to)
        : Buffer.from(await auditCsv(tenantId, from, to));
    case "TREATMENT_STATUS":
      return format === "PDF"
        ? treatmentStatusPdf(tenantId)
        : format === "XLSX"
        ? treatmentStatusWorkbook(tenantId)
        : Buffer.from(await treatmentStatusCsv(tenantId));
    case "CONTROL_EFFECTIVENESS":
      return format === "PDF"
        ? controlEffectivenessPdf(tenantId)
        : format === "XLSX"
        ? controlEffectivenessWorkbook(tenantId)
        : Buffer.from(await controlEffectivenessCsv(tenantId));
    case "OVERDUE_ITEMS":
      return format === "PDF"
        ? overdueItemsPdf(tenantId)
        : format === "XLSX"
        ? overdueItemsWorkbook(tenantId)
        : Buffer.from(await overdueItemsCsv(tenantId));
    case "EXPOSURE_SUMMARY":
      return format === "PDF"
        ? exposureSummaryPdf(tenantId)
        : format === "XLSX"
        ? exposureSummaryWorkbook(tenantId)
        : Buffer.from(await exposureSummaryCsv(tenantId));
    case "RISK_REGISTER":
    default:
      return format === "PDF"
        ? riskPdf(tenantId)
        : format === "XLSX"
        ? riskWorkbook(tenantId)
        : Buffer.from(await riskCsv(tenantId));
  }
}

export async function GET(request: Request) {
  const session = await activeSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const limit = await enforceRateLimit("report", `${session.user.tenantId}:${session.user.id}:${clientAddress(request)}`);
  if (!limit.allowed) {
    const response = rateLimitResponse(limit);
    return NextResponse.json({ error: "Report generation limit reached. Try again later." }, response);
  }

  const params = new URL(request.url).searchParams;
  const type = (params.get("type") ?? "RISK_REGISTER").toUpperCase();
  const format = (params.get("format") ?? "CSV").toUpperCase() as "CSV" | "XLSX" | "PDF";

  if (!validReportTypes.includes(type as never) || !["CSV", "XLSX", "PDF"].includes(format)) {
    return NextResponse.json({ error: "Unsupported report type or format." }, { status: 400 });
  }

  if (type === "AUDIT_TRAIL" && !auditExportRoles.includes(session.user.role as never)) {
    return NextResponse.json({ error: "Audit export requires Owner, Auditor, or Risk Manager access." }, { status: 403 });
  }

  if (type === "BOARD_REPORT" && format !== "PDF") {
    return NextResponse.json({ error: "Board report is available only as PDF." }, { status: 400 });
  }
  if (type === "GAP_ANALYSIS" && !["PDF", "XLSX"].includes(format)) {
    return NextResponse.json({ error: "Gap analysis report is available as PDF or Excel (XLSX)." }, { status: 400 });
  }

  const allowance = await exportAllowance(session.user.tenantId, format, type);
  if (!allowance.allowed) {
    return NextResponse.json(
      {
        error: `Your ${allowance.plan.toLowerCase()} plan has used its ${allowance.limit} monthly exports. Upgrade to continue.`,
        remaining: 0,
      },
      { status: 402 }
    );
  }

  const ext = format === "PDF" ? "pdf" : format === "XLSX" ? "xlsx" : "csv";
  const fileName = `${type.toLowerCase().replaceAll("_", "-")}.${ext}`;

  const history = await db.exportHistory.create({
    data: {
      tenantId: session.user.tenantId,
      generatedById: session.user.id,
      reportType: type as never,
      format,
      fileName,
      status: "PROCESSING",
    },
  });

  const job = await enqueueJob(
    db,
    {
      tenantId: session.user.tenantId,
      type: "REPORT_EXPORT",
      payload: { exportId: history.id, reportType: type, format, fileName, delivery: "download" },
    },
    `report:${history.id}`
  );

  try {
    const body = await generateReportBuffer(session.user.tenantId, type, format, params.get("from") ?? undefined, params.get("to") ?? undefined);
    const mimeType =
      format === "PDF"
        ? "application/pdf"
        : format === "XLSX"
        ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        : "text/csv; charset=utf-8";

    // Save artifact to storage abstraction
    const storageResult = await reportStorage.putReport({
      tenantId: session.user.tenantId,
      exportId: history.id,
      fileName,
      mimeType,
      data: body,
    });

    await completeJob(db, job.id, { exportId: history.id, status: "COMPLETED", sizeBytes: storageResult.sizeBytes });
    await db.exportHistory.update({
      where: { id: history.id },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
        storageKey: storageResult.storageKey,
        checksum: storageResult.checksum,
        sizeBytes: storageResult.sizeBytes,
        artifactBase64: body.toString("base64"),
      },
    });

    return new NextResponse(new Uint8Array(body), {
      headers: {
        "Content-Type": mimeType,
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "private, no-store, no-cache, must-revalidate",
        "Pragma": "no-cache",
        "Expires": "0",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    await db.exportHistory.update({ where: { id: history.id }, data: { status: "FAILED" } });
    await failJob(db, job.id, error instanceof Error ? error.message : "Report generation failed.");
    console.error("Report generation failed", error);
    return NextResponse.json({ error: "Report generation failed." }, { status: 500 });
  }
}

const deliverySchema = z.object({
  type: z.enum([
    "RISK_REGISTER",
    "BOARD_REPORT",
    "GAP_ANALYSIS",
    "AUDIT_TRAIL",
    "TREATMENT_STATUS",
    "CONTROL_EFFECTIVENESS",
    "OVERDUE_ITEMS",
    "EXPOSURE_SUMMARY",
  ]),
  format: z.enum(["CSV", "XLSX", "PDF"]),
  recipients: z.array(z.string().email()).min(1).max(10),
  from: z.string().optional(),
  to: z.string().optional(),
});

export async function POST(request: Request) {
  const session = await activeSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const limit = await enforceRateLimit("report", `${session.user.tenantId}:${session.user.id}:${clientAddress(request)}`);
  if (!limit.allowed) {
    const response = rateLimitResponse(limit);
    return NextResponse.json({ error: "Report delivery limit reached. Try again later." }, response);
  }

  const parsed = deliverySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter up to 10 valid recipient email addresses." }, { status: 400 });

  const { type, format, recipients, from, to } = parsed.data;
  if (type === "BOARD_REPORT" && format !== "PDF") {
    return NextResponse.json({ error: "Board report is available only as PDF." }, { status: 400 });
  }
  if (type === "GAP_ANALYSIS" && !["PDF", "XLSX"].includes(format)) {
    return NextResponse.json({ error: "Gap analysis report is available as PDF or Excel (XLSX)." }, { status: 400 });
  }
  if (type === "AUDIT_TRAIL" && !auditExportRoles.includes(session.user.role as never)) {
    return NextResponse.json({ error: "Audit export requires Owner, Auditor, or Risk Manager access." }, { status: 403 });
  }

  const user = await db.user.findUniqueOrThrow({
    where: { id: session.user.id },
    select: { email: true, exportEmailsEnabled: true },
  });
  if (!user.exportEmailsEnabled) {
    return NextResponse.json({ error: "Export delivery emails are disabled in your notification preferences." }, { status: 400 });
  }

  const allowance = await exportAllowance(session.user.tenantId, format, type);
  if (!allowance.allowed) {
    return NextResponse.json({ error: `Your ${allowance.plan.toLowerCase()} plan has used its ${allowance.limit} monthly exports. Upgrade to continue.` }, { status: 402 });
  }

  const ext = format === "PDF" ? "pdf" : format === "XLSX" ? "xlsx" : "csv";
  const fileName = `${type.toLowerCase().replaceAll("_", "-")}.${ext}`;

  const history = await db.exportHistory.create({
    data: {
      tenantId: session.user.tenantId,
      generatedById: session.user.id,
      reportType: type as never,
      format,
      fileName,
      status: "PROCESSING",
    },
  });

  const job = await enqueueJob(
    db,
    {
      tenantId: session.user.tenantId,
      type: "REPORT_EXPORT",
      payload: { exportId: history.id, reportType: type, format, fileName, delivery: "email" },
    },
    `report:${history.id}`
  );

  try {
    const body = await generateReportBuffer(session.user.tenantId, type, format, from, to);
    const mimeType =
      format === "PDF"
        ? "application/pdf"
        : format === "XLSX"
        ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        : "text/csv; charset=utf-8";

    // Save artifact to storage abstraction
    const storageResult = await reportStorage.putReport({
      tenantId: session.user.tenantId,
      exportId: history.id,
      fileName,
      mimeType,
      data: body,
    });

    const token = createToken();
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const url = `${appUrl()}/api/reports/download/${token}`;

    await db.exportHistory.update({
      where: { id: history.id },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
        storageKey: storageResult.storageKey,
        checksum: storageResult.checksum,
        sizeBytes: storageResult.sizeBytes,
        artifactBase64: body.toString("base64"),
        downloadTokenHash: hashToken(token),
        downloadExpires: expires,
      },
    });

    await completeJob(db, job.id, { exportId: history.id, delivery: "email", recipients: recipients.length });

    for (const recipient of [...new Set(recipients.map((email) => email.toLowerCase()))]) {
      await sendNotificationEmail({
        tenantId: session.user.tenantId,
        userId: recipient === user.email.toLowerCase() ? session.user.id : undefined,
        recipient,
        type: "EXPORT_DELIVERY",
        subject: `${fileName} is ready to download`,
        eyebrow: "Secure report delivery",
        heading: "Your report is ready",
        paragraphs: [
          "The requested BeyondBeams GRC report has been generated successfully.",
          "Use the single-use secure link below within 24 hours. The link expires automatically and is consumed upon download.",
        ],
        cta: { label: "Download report", url },
        details: [
          { label: "File", value: fileName },
          { label: "Expires", value: expires.toLocaleString("en-US") },
        ],
        relatedEntityType: "ExportHistory",
        relatedEntityId: history.id,
      });
    }

    await db.auditEvent.create({
      data: {
        tenantId: session.user.tenantId,
        actorId: session.user.id,
        action: "CREATE",
        entityType: "ExportDelivery",
        entityId: history.id,
        summary: `Emailed ${fileName} to ${recipients.length} recipient(s)`,
      },
    });

    return NextResponse.json({ success: true, recipients: recipients.length });
  } catch (error) {
    await db.exportHistory.update({ where: { id: history.id }, data: { status: "FAILED" } });
    await failJob(db, job.id, error instanceof Error ? error.message : "Report generation or delivery failed.");
    console.error("Report generation or delivery failed", error);
    return NextResponse.json({ error: "Report generation or delivery failed." }, { status: 500 });
  }
}