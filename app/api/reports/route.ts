import { NextResponse } from "next/server";
import { activeSession } from "@/lib/authz";
import { auditExportRoles, auditCsv, auditWorkbook, boardPdf, gapAnalysisPdf, exportAllowance, riskCsv, riskWorkbook } from "@/lib/reporting";
import { db } from "@/lib/db";
import { appUrl, createToken, hashToken } from "@/lib/tokens";
import { sendNotificationEmail } from "@/lib/email";
import { z } from "zod";
import { clientAddress, enforceRateLimit, rateLimitResponse } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await activeSession(); if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const limit = await enforceRateLimit("report", `${session.user.tenantId}:${session.user.id}:${clientAddress(request)}`); if (!limit.allowed) { const response = rateLimitResponse(limit); return NextResponse.json({ error: "Report generation limit reached. Try again later." }, response); }
  const params = new URL(request.url).searchParams; const type = (params.get("type") ?? "RISK_REGISTER").toUpperCase(); const format = (params.get("format") ?? "CSV").toUpperCase() as "CSV" | "XLSX" | "PDF";
  if (type === "AUDIT_TRAIL" && !auditExportRoles.includes(session.user.role as never)) return NextResponse.json({ error: "Audit export requires Owner, Auditor, or Risk Manager access." }, { status: 403 });
  if (!["RISK_REGISTER", "BOARD_REPORT", "GAP_ANALYSIS", "AUDIT_TRAIL"].includes(type) || !["CSV", "XLSX", "PDF"].includes(format)) return NextResponse.json({ error: "Unsupported report format." }, { status: 400 });
  const allowance = await exportAllowance(session.user.tenantId, format, type); if (!allowance.allowed) return NextResponse.json({ error: `Your ${allowance.plan.toLowerCase()} plan has used its ${allowance.limit} monthly exports. Upgrade to continue.`, remaining: 0 }, { status: 402 });
  const fileName = type === "BOARD_REPORT" ? "board-risk-report.pdf" : type === "GAP_ANALYSIS" ? "framework-gap-analysis.pdf" : `${type.toLowerCase().replaceAll("_", "-")}.${format === "XLSX" ? "xlsx" : "csv"}`;
  const history = await db.exportHistory.create({ data: { tenantId: session.user.tenantId, generatedById: session.user.id, reportType: type as "RISK_REGISTER" | "BOARD_REPORT" | "GAP_ANALYSIS" | "AUDIT_TRAIL", format, fileName } });
  try {
    const body = type === "BOARD_REPORT" ? await boardPdf(session.user.tenantId) : type === "GAP_ANALYSIS" ? await gapAnalysisPdf(session.user.tenantId) : type === "AUDIT_TRAIL" ? format === "XLSX" ? await auditWorkbook(session.user.tenantId, params.get("from") ?? undefined, params.get("to") ?? undefined) : Buffer.from(await auditCsv(session.user.tenantId, params.get("from") ?? undefined, params.get("to") ?? undefined)) : format === "XLSX" ? await riskWorkbook(session.user.tenantId) : Buffer.from(await riskCsv(session.user.tenantId));
    await db.exportHistory.update({ where: { id: history.id }, data: { status: "COMPLETED", completedAt: new Date() } });
    return new NextResponse(new Uint8Array(body), { headers: { "Content-Type": type === "BOARD_REPORT" ? "application/pdf" : format === "XLSX" ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${fileName}"`, "Cache-Control": "no-store" } });
  } catch (error) { await db.exportHistory.update({ where: { id: history.id }, data: { status: "FAILED" } }); console.error(error); return NextResponse.json({ error: "Report generation failed." }, { status: 500 }); }
}

const deliverySchema = z.object({ type: z.enum(["RISK_REGISTER", "BOARD_REPORT", "GAP_ANALYSIS", "AUDIT_TRAIL"]), format: z.enum(["CSV", "XLSX", "PDF"]), recipients: z.array(z.string().email()).min(1).max(10), from: z.string().optional(), to: z.string().optional() });
export async function POST(request: Request) {
  const session = await activeSession(); if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const limit = await enforceRateLimit("report", `${session.user.tenantId}:${session.user.id}:${clientAddress(request)}`); if (!limit.allowed) { const response = rateLimitResponse(limit); return NextResponse.json({ error: "Report delivery limit reached. Try again later." }, response); }
  const parsed = deliverySchema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return NextResponse.json({ error: "Enter up to 10 valid recipient email addresses." }, { status: 400 });
  const { type, format, recipients, from, to } = parsed.data;
  if (type === "AUDIT_TRAIL" && !auditExportRoles.includes(session.user.role as never)) return NextResponse.json({ error: "Audit export requires Owner, Auditor, or Risk Manager access." }, { status: 403 });
  const user = await db.user.findUniqueOrThrow({ where: { id: session.user.id }, select: { email: true, exportEmailsEnabled: true } });
  if (!user.exportEmailsEnabled) return NextResponse.json({ error: "Export delivery emails are disabled in your notification preferences." }, { status: 400 });
  const allowance = await exportAllowance(session.user.tenantId, format, type); if (!allowance.allowed) return NextResponse.json({ error: `Your ${allowance.plan.toLowerCase()} plan has used its ${allowance.limit} monthly exports. Upgrade to continue.` }, { status: 402 });
  const fileName = type === "BOARD_REPORT" ? "board-risk-report.pdf" : type === "GAP_ANALYSIS" ? "framework-gap-analysis.pdf" : `${type.toLowerCase().replaceAll("_", "-")}.${format === "XLSX" ? "xlsx" : "csv"}`;
  const history = await db.exportHistory.create({ data: { tenantId: session.user.tenantId, generatedById: session.user.id, reportType: type, format, fileName } });
  try {
    const body = type === "BOARD_REPORT" ? await boardPdf(session.user.tenantId) : type === "GAP_ANALYSIS" ? await gapAnalysisPdf(session.user.tenantId) : type === "AUDIT_TRAIL" ? format === "XLSX" ? await auditWorkbook(session.user.tenantId, from, to) : Buffer.from(await auditCsv(session.user.tenantId, from, to)) : format === "XLSX" ? await riskWorkbook(session.user.tenantId) : Buffer.from(await riskCsv(session.user.tenantId));
    const token = createToken(); const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); const url = `${appUrl()}/api/reports/download/${token}`;
    await db.exportHistory.update({ where: { id: history.id }, data: { status: "COMPLETED", completedAt: new Date(), artifactBase64: body.toString("base64"), downloadTokenHash: hashToken(token), downloadExpires: expires } });
    for (const recipient of [...new Set(recipients.map((email) => email.toLowerCase()))]) await sendNotificationEmail({ tenantId: session.user.tenantId, userId: recipient === user.email.toLowerCase() ? session.user.id : undefined, recipient, type: "EXPORT_DELIVERY", subject: `${fileName} is ready to download`, eyebrow: "Secure report delivery", heading: "Your report is ready", paragraphs: ["The requested BeyondBeams GRC report has been generated successfully.", "Use the secure link below within 24 hours. The link expires automatically and is scoped to this export."], cta: { label: "Download report", url }, details: [{ label: "File", value: fileName }, { label: "Expires", value: expires.toLocaleString("en-US") }], relatedEntityType: "ExportHistory", relatedEntityId: history.id });
    await db.auditEvent.create({ data: { tenantId: session.user.tenantId, actorId: session.user.id, action: "CREATE", entityType: "ExportDelivery", entityId: history.id, summary: `Emailed ${fileName} to ${recipients.length} recipient(s)` } });
    return NextResponse.json({ success: true, recipients: recipients.length });
  } catch (error) { await db.exportHistory.update({ where: { id: history.id }, data: { status: "FAILED" } }); console.error(error); return NextResponse.json({ error: "Report generation or delivery failed." }, { status: 500 }); }
}