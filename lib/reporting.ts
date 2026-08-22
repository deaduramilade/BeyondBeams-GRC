import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import { db } from "@/lib/db";
import { formatEnum, riskLevel } from "@/lib/utils";

export const exportRoles = ["OWNER", "RISK_MANAGER", "ASSESSOR", "VIEWER", "AUDITOR"] as const;
export const auditExportRoles = ["OWNER", "AUDITOR", "RISK_MANAGER"] as const;
const monthStart = () => new Date(new Date().getFullYear(), new Date().getMonth(), 1);
const planLimits: Record<string, number> = { FREE: 2, BASIC: 10, PROFESSIONAL: 50, PREMIUM: Number.POSITIVE_INFINITY };

export async function exportAllowance(tenantId: string, format: "PDF" | "XLSX" | "CSV", type: string) {
  const tenant = await db.tenant.findUnique({ where: { id: tenantId }, select: { plan: true } });
  if (!tenant) return { allowed: false, used: 0, limit: 0, plan: "FREE" };
  const counted = format !== "CSV" || type === "AUDIT_TRAIL";
  const used = counted ? await db.exportHistory.count({ where: { tenantId, createdAt: { gte: monthStart() }, status: { in: ["PROCESSING", "COMPLETED"] }, format: { in: ["PDF", "XLSX"] } } }) : 0;
  const limit = planLimits[tenant.plan] ?? 2;
  return { allowed: !counted || used < limit, used, limit, plan: tenant.plan };
}

function csvCell(value: unknown) { return `"${String(value ?? "").replaceAll('"', '""')}"`; }
type RiskExportRow = Awaited<ReturnType<typeof db.risk.findMany>>[number] & { owner: { name: string } };
function riskRows(risks: RiskExportRow[]) {
  return risks.map((risk) => [risk.reference, risk.title, risk.description, formatEnum(risk.category), risk.owner.name, risk.inherentLikelihood, risk.inherentImpact, risk.inherentScore, risk.residualLikelihood ?? "", risk.residualImpact ?? "", risk.residualScore ?? "", formatEnum(risk.treatment), formatEnum(risk.status), risk.nextReviewDate.toISOString().slice(0, 10), risk.updatedAt.toISOString()]);
}
export const riskHeaders = ["Reference", "Title", "Description", "Category", "Owner", "Inherent likelihood", "Inherent impact", "Inherent score", "Residual likelihood", "Residual impact", "Residual score", "Treatment", "Status", "Next review date", "Last updated"];

export async function riskCsv(tenantId: string) {
  const risks = await db.risk.findMany({ where: { tenantId, deletedAt: null }, include: { owner: { select: { name: true } } }, orderBy: { residualScore: "desc" } });
  return [riskHeaders, ...riskRows(risks)].map((row) => row.map(csvCell).join(",")).join("\r\n");
}
export async function riskWorkbook(tenantId: string) {
  const risks = await db.risk.findMany({ where: { tenantId, deletedAt: null }, include: { owner: { select: { name: true } } }, orderBy: { residualScore: "desc" } });
  const workbook = new ExcelJS.Workbook(); const sheet = workbook.addWorksheet("Risk Register");
  sheet.addRow(riskHeaders); riskRows(risks).forEach((row) => sheet.addRow(row));
  sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } }; sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0A2540" } };
  sheet.views = [{ state: "frozen", ySplit: 1 }]; sheet.columns.forEach((column) => { column.width = Math.min(Math.max((column.header?.toString().length ?? 10) + 4, 14), 32); });
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

export async function auditCsv(tenantId: string, from?: string, to?: string) {
  const events = await db.auditEvent.findMany({ where: { tenantId, createdAt: { gte: from ? new Date(from) : undefined, lte: to ? new Date(`${to}T23:59:59.999Z`) : undefined } }, include: { actor: { select: { name: true, email: true } } }, orderBy: { createdAt: "desc" } });
  const rows = events.map((event) => [event.actor.name, event.actor.email, event.entityType, event.action, event.createdAt.toISOString(), event.summary, event.changes ?? ""]);
  return [["Actor", "Actor email", "Entity type", "Action", "Timestamp", "Before/after summary", "Changes"], ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
}
export async function auditWorkbook(tenantId: string, from?: string, to?: string) {
  const csv = await auditCsv(tenantId, from, to); const workbook = new ExcelJS.Workbook(); const sheet = workbook.addWorksheet("Audit Events");
  csv.split("\r\n").forEach((line) => sheet.addRow(line.match(/("(?:[^"]|"")*"|[^,]*)/g)?.filter((value) => value !== "," && value !== "").map((value) => value.replace(/^"|"$/g, "").replaceAll('""', '"')) ?? []));
  sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } }; sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0A2540" } }; sheet.columns.forEach((column) => { column.width = 24; });
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

export async function boardPdf(tenantId: string) {
  const [tenant, risks, emerging] = await Promise.all([
    db.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { name: true } }),
    db.risk.findMany({ where: { tenantId, deletedAt: null }, include: { owner: { select: { name: true } } }, orderBy: { residualScore: "desc" } }),
    db.emergingRisk.findMany({ where: { tenantId, status: "MONITORING" }, orderBy: { updatedAt: "desc" }, take: 10 }),
  ]);
  const high = risks.filter((r) => riskLevel(r.residualScore ?? r.inherentScore) === "High").length; const medium = risks.filter((r) => riskLevel(r.residualScore ?? r.inherentScore) === "Medium").length; const low = risks.length - high - medium; const treated = risks.filter((r) => ["MITIGATE", "TRANSFER", "AVOID"].includes(r.treatment)).length;
  const doc = new PDFDocument({ size: "A4", margin: 48 }); const chunks: Buffer[] = []; const stream = doc as PDFKit.PDFDocument & { on: (event: string, callback: (chunk: Buffer) => void) => void }; stream.on("data", (chunk) => chunks.push(chunk));
  doc.fillColor("#0A2540").rect(0, 0, 595, 120).fill(); doc.fillColor("#FFFFFF").fontSize(11).text("BEYONDBEAMS GRC", 48, 38); doc.fontSize(27).text("Board risk report", 48, 60); doc.fontSize(10).fillColor("#A9EDE5").text(`${tenant.name}  |  ${new Date().toLocaleDateString("en-US", { dateStyle: "long" })}`, 48, 94);
  doc.fillColor("#0A2540").fontSize(18).text("Executive summary", 48, 150); doc.fontSize(11).fillColor("#374151").text(`The current register contains ${risks.length} active risks. Residual exposure is distributed across ${high} high, ${medium} medium, and ${low} low risks. ${treated} of ${risks.length} risks have an active treatment strategy.`, 48, 178, { width: 490, lineGap: 5 });
  doc.fillColor("#00A896").fontSize(12).text("RESIDUAL HEATMAP", 48, 238); const cells = ["#D8F3EF", "#A9EDE5", "#F6D58A", "#F0A06A", "#D95C5C"]; for (let y = 0; y < 5; y++) for (let x = 0; x < 5; x++) { const score = (y + 1) * (x + 1); doc.fillColor(cells[score >= 15 ? 4 : score >= 7 ? 2 : 0]).rect(48 + x * 42, 265 + (4 - y) * 32, 38, 28).fill(); doc.fillColor("#0A2540").fontSize(8).text(String(score), 62 + x * 42, 275 + (4 - y) * 32); } doc.fillColor("#6B7280").fontSize(8).text("Likelihood →", 48, 430); doc.text("Impact increases ↑", 48, 252);
  doc.fillColor("#0A2540").fontSize(18).text("Top residual risks", 48, 470); let y = 500; doc.fontSize(9); risks.slice(0, 10).forEach((risk, index) => { doc.fillColor(index % 2 ? "#F3F7F8" : "#FFFFFF").rect(48, y - 4, 500, 27).fill(); doc.fillColor("#0A2540").text(`${index + 1}. ${risk.title}`, 56, y, { width: 275 }); doc.fillColor("#00A896").text(`${risk.residualScore ?? risk.inherentScore}  |  ${formatEnum(risk.status)}`, 350, y); y += 28; });
  doc.addPage(); doc.fillColor("#0A2540").fontSize(20).text("Treatment and emerging risks", 48, 52); doc.fillColor("#374151").fontSize(11).text(`Treatment progress: ${treated}/${risks.length} risks carry a defined mitigation, transfer, avoidance, or acceptance decision. Open and in-review items should remain on the management agenda until an owner confirms the next dated action.`, 48, 90, { width: 490, lineGap: 5 }); doc.fillColor("#00A896").fontSize(12).text("EMERGING RISKS", 48, 170); y = 198; emerging.forEach((risk) => { doc.fillColor("#0A2540").fontSize(11).text(risk.title, 48, y); doc.fillColor("#6B7280").fontSize(9).text(`${formatEnum(risk.status)}  |  Review ${risk.nextReviewDate.toLocaleDateString()}`, 48, y + 16); y += 44; });
  doc.end(); await new Promise<void>((resolve) => doc.on("end", resolve)); return Buffer.concat(chunks);
}

export async function gapAnalysisPdf(tenantId: string) {
  const [tenant, selections] = await Promise.all([
    db.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { name: true } }),
    db.tenantFramework.findMany({ where: { tenantId, enabled: true }, include: { framework: { include: { controls: { include: { mappings: { where: { risk: { tenantId, deletedAt: null } } } } } } } }, orderBy: { framework: { name: "asc" } } }),
  ]);
  const doc = new PDFDocument({ size: "A4", margin: 48 }); const chunks: Buffer[] = []; const stream = doc as PDFKit.PDFDocument & { on: (event: string, callback: (chunk: Buffer) => void) => void }; stream.on("data", (chunk) => chunks.push(chunk));
  doc.fillColor("#0A2540").rect(0, 0, 595, 120).fill(); doc.fillColor("#FFFFFF").fontSize(11).text("BEYONDBEAMS GRC", 48, 38); doc.fontSize(27).text("Framework gap analysis", 48, 60); doc.fontSize(10).fillColor("#A9EDE5").text(`${tenant.name}  |  ${new Date().toLocaleDateString("en-US", { dateStyle: "long" })}`, 48, 94);
  let y = 150; for (const selection of selections) { const controls = selection.framework.controls; const mapped = controls.filter((control) => control.mappings.length > 0).length; if (y > 690) { doc.addPage(); y = 52; } doc.fillColor("#0A2540").fontSize(17).text(selection.framework.name, 48, y); doc.fillColor("#00A896").fontSize(10).text(`${mapped}/${controls.length} controls mapped`, 48, y + 24); y += 54; for (const control of controls.filter((item) => item.mappings.length === 0)) { if (y > 740) { doc.addPage(); y = 52; } doc.fillColor("#0A2540").fontSize(9).text(`${control.controlId}  ${control.title}`, 58, y, { width: 470 }); y += 20; } y += 18; }
  if (!selections.length) doc.fillColor("#374151").fontSize(12).text("No frameworks are enabled for this workspace.", 48, 160);
  doc.end(); await new Promise<void>((resolve) => doc.on("end", resolve)); return Buffer.concat(chunks);
}