import { NextResponse } from "next/server";
import { activeSession } from "@/lib/authz";
import { auditExportRoles, auditCsv, auditWorkbook, boardPdf, exportAllowance, riskCsv, riskWorkbook } from "@/lib/reporting";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await activeSession(); if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const params = new URL(request.url).searchParams; const type = (params.get("type") ?? "RISK_REGISTER").toUpperCase(); const format = (params.get("format") ?? "CSV").toUpperCase() as "CSV" | "XLSX" | "PDF";
  if (type === "AUDIT_TRAIL" && !auditExportRoles.includes(session.user.role as never)) return NextResponse.json({ error: "Audit export requires Owner, Auditor, or Risk Manager access." }, { status: 403 });
  if (!["RISK_REGISTER", "BOARD_REPORT", "AUDIT_TRAIL"].includes(type) || !["CSV", "XLSX", "PDF"].includes(format)) return NextResponse.json({ error: "Unsupported report format." }, { status: 400 });
  const allowance = await exportAllowance(session.user.tenantId, format, type); if (!allowance.allowed) return NextResponse.json({ error: `Your ${allowance.plan.toLowerCase()} plan has used its ${allowance.limit} monthly exports. Upgrade to continue.`, remaining: 0 }, { status: 402 });
  const fileName = type === "BOARD_REPORT" ? "board-risk-report.pdf" : `${type.toLowerCase().replaceAll("_", "-")}.${format === "XLSX" ? "xlsx" : "csv"}`;
  const history = await db.exportHistory.create({ data: { tenantId: session.user.tenantId, generatedById: session.user.id, reportType: type as "RISK_REGISTER" | "BOARD_REPORT" | "AUDIT_TRAIL", format, fileName } });
  try {
    const body = type === "BOARD_REPORT" ? await boardPdf(session.user.tenantId) : type === "AUDIT_TRAIL" ? format === "XLSX" ? await auditWorkbook(session.user.tenantId, params.get("from") ?? undefined, params.get("to") ?? undefined) : Buffer.from(await auditCsv(session.user.tenantId, params.get("from") ?? undefined, params.get("to") ?? undefined)) : format === "XLSX" ? await riskWorkbook(session.user.tenantId) : Buffer.from(await riskCsv(session.user.tenantId));
    await db.exportHistory.update({ where: { id: history.id }, data: { status: "COMPLETED", completedAt: new Date() } });
    return new NextResponse(new Uint8Array(body), { headers: { "Content-Type": type === "BOARD_REPORT" ? "application/pdf" : format === "XLSX" ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${fileName}"`, "Cache-Control": "no-store" } });
  } catch (error) { await db.exportHistory.update({ where: { id: history.id }, data: { status: "FAILED" } }); console.error(error); return NextResponse.json({ error: "Report generation failed." }, { status: 500 }); }
}