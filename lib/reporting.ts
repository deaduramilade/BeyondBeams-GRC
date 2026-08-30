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
const riskInclude = {
  owner: { select: { name: true } },
  businessUnit: { select: { name: true } },
  objective: { select: { name: true } },
  riskSource: { select: { name: true } },
  regulatoryDomain: { select: { name: true } },
} as const;
type RiskExportRow = Awaited<ReturnType<typeof db.risk.findMany<{ include: typeof riskInclude }>>>[number];
function riskRows(risks: RiskExportRow[]) {
  return risks.map((risk) => [risk.reference, risk.title, risk.description, formatEnum(risk.category), risk.owner.name, risk.inherentLikelihood, risk.inherentImpact, risk.inherentScore, risk.residualLikelihood ?? "", risk.residualImpact ?? "", risk.residualScore ?? "", formatEnum(risk.treatment), formatEnum(risk.status), risk.nextReviewDate.toISOString().slice(0, 10), risk.updatedAt.toISOString(), risk.businessUnit?.name ?? "", risk.objective?.name ?? "", risk.riskSource?.name ?? "", risk.regulatoryDomain?.name ?? ""]);
}
export const riskHeaders = ["Reference", "Title", "Description", "Category", "Owner", "Inherent likelihood", "Inherent impact", "Inherent score", "Residual likelihood", "Residual impact", "Residual score", "Treatment", "Status", "Next review date", "Last updated", "Business unit", "Objective", "Risk source", "Regulatory domain"];

async function rowsPdf(title: string, headers: string[], rows: unknown[][]) {
  const doc = new PDFDocument({ size: "A4", margin: 42 }); const chunks: Buffer[] = [];
  doc.on("data", (chunk) => chunks.push(chunk));
  doc.fillColor("#0A2540").fontSize(20).text("BEYONDBEAMS GRC");
  doc.moveDown(0.5).fontSize(16).text(title);
  doc.moveDown().fontSize(8).fillColor("#374151").text(`Generated ${new Date().toISOString()}`);
  let y = 120;
  const drawRow = (values: unknown[], header = false) => { if (y > 750) { doc.addPage(); y = 48; } doc.fillColor(header ? "#0A2540" : "#FFFFFF").rect(42, y - 3, 511, 18).fill(); doc.fillColor(header ? "#FFFFFF" : "#173746").fontSize(header ? 7 : 6).text(values.map((value) => String(value ?? "")).join(" | "), 47, y, { width: 500, ellipsis: true }); y += 20; };
  drawRow(headers, true); rows.forEach((row) => drawRow(row));
  doc.end(); await new Promise<void>((resolve) => doc.on("end", resolve)); return Buffer.concat(chunks);
}

export async function riskPdf(tenantId: string) {
  const risks = await db.risk.findMany({ where: { tenantId, deletedAt: null }, include: riskInclude, orderBy: { residualScore: "desc" } });
  return rowsPdf("Risk register", riskHeaders, riskRows(risks));
}

export async function riskCsv(tenantId: string) {
  const risks = await db.risk.findMany({ where: { tenantId, deletedAt: null }, include: riskInclude, orderBy: { residualScore: "desc" } });
  return [riskHeaders, ...riskRows(risks)].map((row) => row.map(csvCell).join(",")).join("\r\n");
}
export async function riskWorkbook(tenantId: string) {
  const risks = await db.risk.findMany({ where: { tenantId, deletedAt: null }, include: riskInclude, orderBy: { residualScore: "desc" } });
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

export async function auditPdf(tenantId: string, from?: string, to?: string) {
  const events = await db.auditEvent.findMany({ where: { tenantId, createdAt: { gte: from ? new Date(from) : undefined, lte: to ? new Date(`${to}T23:59:59.999Z`) : undefined } }, include: { actor: { select: { name: true, email: true } } }, orderBy: { createdAt: "desc" } });
  return rowsPdf("Audit activity", ["Actor", "Email", "Entity", "Action", "Timestamp", "Summary"], events.map((event) => [event.actor.name, event.actor.email, event.entityType, event.action, event.createdAt.toISOString(), event.summary]));
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
  const [tenant, selections, unmappedRisks, highUncoveredRisks] = await Promise.all([
    db.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { name: true } }),
    db.tenantFramework.findMany({
      where: { tenantId, enabled: true },
      include: {
        framework: {
          include: {
            controls: {
              include: {
                mappings: {
                  where: { risk: { tenantId, deletedAt: null } },
                  include: { risk: { select: { id: true, reference: true, title: true } } },
                },
              },
            },
          },
        },
      },
      orderBy: { framework: { name: "asc" } },
    }),
    db.risk.findMany({
      where: { tenantId, deletedAt: null, frameworkMappings: { none: {} } },
      select: { reference: true, title: true, residualScore: true, inherentScore: true, category: true },
      orderBy: { residualScore: "desc" },
    }),
    db.risk.findMany({
      where: {
        tenantId,
        deletedAt: null,
        residualScore: { gte: 15 },
        frameworkMappings: { none: {} },
      },
      select: { reference: true, title: true, residualScore: true, treatment: true },
      orderBy: { residualScore: "desc" },
    }),
  ]);

  const doc = new PDFDocument({ size: "A4", margin: 48 });
  const chunks: Buffer[] = [];
  const stream = doc as PDFKit.PDFDocument & { on: (event: string, callback: (chunk: Buffer) => void) => void };
  stream.on("data", (chunk) => chunks.push(chunk));

  doc.fillColor("#0A2540").rect(0, 0, 595, 120).fill();
  doc.fillColor("#FFFFFF").fontSize(11).text("BEYONDBEAMS GRC", 48, 38);
  doc.fontSize(27).text("Framework gap analysis", 48, 60);
  doc.fontSize(10).fillColor("#A9EDE5").text(`${tenant.name}  |  ${new Date().toLocaleDateString("en-US", { dateStyle: "long" })}`, 48, 94);
  doc.fillColor("#6B7280").fontSize(8).text("Governance aid only — not certification, legal advice, or an authoritative conformance opinion.", 48, 112);

  let y = 145;
  if (!selections.length) {
    doc.fillColor("#374151").fontSize(12).text("No frameworks are enabled for this workspace.", 48, 160);
  } else {
    for (const selection of selections) {
      const controls = selection.framework.controls;
      const mapped = controls.filter((c) => c.mappings.length > 0);
      const unmapped = controls.filter((c) => c.mappings.length === 0);

      if (y > 680) { doc.addPage(); y = 52; }
      doc.fillColor("#0A2540").fontSize(15).text(selection.framework.name, 48, y);
      doc.fillColor("#00A896").fontSize(10).text(`${mapped.length}/${controls.length} controls mapped (${Math.round((mapped.length / (controls.length || 1)) * 100)}% coverage)`, 48, y + 20);
      y += 44;

      if (unmapped.length > 0) {
        doc.fillColor("#B91C1C").fontSize(9).text(`Unmapped controls (${unmapped.length})`, 48, y);
        y += 16;
        for (const control of unmapped) {
          if (y > 740) { doc.addPage(); y = 52; }
          doc.fillColor("#0A2540").fontSize(8).text(`${control.controlId}  ${control.title}`, 56, y, { width: 480 });
          y += 16;
        }
        y += 10;
      }
    }

    if (highUncoveredRisks.length > 0) {
      if (y > 660) { doc.addPage(); y = 52; }
      doc.fillColor("#B91C1C").fontSize(13).text("High exposure risks without control coverage", 48, y);
      y += 24;
      for (const r of highUncoveredRisks) {
        if (y > 740) { doc.addPage(); y = 52; }
        doc.fillColor("#0A2540").fontSize(8).text(`${r.reference} - ${r.title} (Score: ${r.residualScore}, Treatment: ${formatEnum(r.treatment)})`, 56, y, { width: 480 });
        y += 16;
      }
      y += 10;
    }

    if (unmappedRisks.length > 0) {
      if (y > 660) { doc.addPage(); y = 52; }
      doc.fillColor("#0A2540").fontSize(13).text(`Risks awaiting framework mapping (${unmappedRisks.length})`, 48, y);
      y += 24;
      for (const r of unmappedRisks.slice(0, 15)) {
        if (y > 740) { doc.addPage(); y = 52; }
        doc.fillColor("#374151").fontSize(8).text(`${r.reference} - ${r.title} [${formatEnum(r.category)}]`, 56, y, { width: 480 });
        y += 16;
      }
    }
  }

  doc.end();
  await new Promise<void>((resolve) => doc.on("end", resolve));
  return Buffer.concat(chunks);
}

export async function gapAnalysisWorkbook(tenantId: string) {
  const [tenant, selections, unmappedRisks, highUncoveredRisks, allMappings] = await Promise.all([
    db.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { name: true } }),
    db.tenantFramework.findMany({
      where: { tenantId, enabled: true },
      include: {
        framework: {
          include: {
            controls: {
              include: {
                mappings: {
                  where: { risk: { tenantId, deletedAt: null } },
                  include: {
                    risk: { select: { id: true, reference: true, title: true, category: true, residualScore: true } },
                    reviewedBy: { select: { name: true } },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { framework: { name: "asc" } },
    }),
    db.risk.findMany({
      where: { tenantId, deletedAt: null, frameworkMappings: { none: {} } },
      include: { owner: { select: { name: true } }, businessUnit: { select: { name: true } } },
      orderBy: { residualScore: "desc" },
    }),
    db.risk.findMany({
      where: { tenantId, deletedAt: null, residualScore: { gte: 15 }, frameworkMappings: { none: {} } },
      include: { owner: { select: { name: true } } },
      orderBy: { residualScore: "desc" },
    }),
    db.riskFrameworkMapping.findMany({
      where: { risk: { tenantId, deletedAt: null } },
      include: {
        frameworkControl: { include: { framework: { select: { name: true } } } },
        risk: { select: { reference: true, title: true, category: true, residualScore: true } },
        reviewedBy: { select: { name: true } },
      },
      orderBy: { mappedAt: "desc" },
    }),
  ]);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "BeyondBeams GRC";
  workbook.created = new Date();

  // 1. Summary Sheet
  const summarySheet = workbook.addWorksheet("Gap Summary");
  summarySheet.addRow(["BeyondBeams GRC - Compliance Gap Analysis"]);
  summarySheet.addRow(["Workspace", tenant.name]);
  summarySheet.addRow(["Generated At", new Date().toISOString()]);
  summarySheet.addRow(["Disclaimer", "Reference governance aid only; not certification or legal advice."]);
  summarySheet.addRow([]);
  summarySheet.addRow(["Framework", "Version", "Total Controls", "Mapped Controls", "Unmapped Controls", "Coverage %"]);

  let totalFrameworkControls = 0;
  let totalMappedControls = 0;

  for (const s of selections) {
    const total = s.framework.controls.length;
    const mapped = s.framework.controls.filter((c) => c.mappings.length > 0).length;
    const unmapped = total - mapped;
    totalFrameworkControls += total;
    totalMappedControls += mapped;
    summarySheet.addRow([
      s.framework.name,
      s.framework.version,
      total,
      mapped,
      unmapped,
      total > 0 ? `${Math.round((mapped / total) * 100)}%` : "0%",
    ]);
  }

  summarySheet.addRow([]);
  summarySheet.addRow(["Total Enabled Controls", totalFrameworkControls]);
  summarySheet.addRow(["Total Mapped Controls", totalMappedControls]);
  summarySheet.addRow(["Unmapped Risks Count", unmappedRisks.length]);
  summarySheet.addRow(["High Exposure Uncovered Risks", highUncoveredRisks.length]);
  summarySheet.getRow(6).font = { bold: true };

  // 2. Unmapped Controls Sheet
  const unmappedSheet = workbook.addWorksheet("Unmapped Controls");
  const unmappedHeaders = ["Framework", "Control ID", "Category", "Title", "Description"];
  unmappedSheet.addRow(unmappedHeaders);
  unmappedSheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  unmappedSheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0A2540" } };

  for (const s of selections) {
    for (const c of s.framework.controls.filter((c) => c.mappings.length === 0)) {
      unmappedSheet.addRow([s.framework.name, c.controlId, c.category, c.title, c.description]);
    }
  }

  // 3. Mapped Controls & Applicability Reviews Sheet
  const mappedSheet = workbook.addWorksheet("Mappings & Applicability");
  const mappedHeaders = ["Framework", "Control ID", "Control Title", "Risk Reference", "Risk Title", "Applicability Decision", "Decision Rationale", "Reviewed By", "Reviewed At"];
  mappedSheet.addRow(mappedHeaders);
  mappedSheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  mappedSheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0A2540" } };

  for (const m of allMappings) {
    mappedSheet.addRow([
      m.frameworkControl.framework.name,
      m.frameworkControl.controlId,
      m.frameworkControl.title,
      m.risk.reference,
      m.risk.title,
      m.applicability ? formatEnum(m.applicability) : "Pending Review",
      m.notes ?? "",
      m.reviewedBy?.name ?? "",
      m.reviewedAt ? m.reviewedAt.toISOString().slice(0, 10) : "",
    ]);
  }

  // 4. Unmapped Risks Sheet
  const risksSheet = workbook.addWorksheet("Unmapped Risks");
  const risksHeaders = ["Reference", "Title", "Category", "Owner", "Business Unit", "Residual Score", "Treatment", "Next Review"];
  risksSheet.addRow(risksHeaders);
  risksSheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  risksSheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0A2540" } };

  for (const r of unmappedRisks) {
    risksSheet.addRow([
      r.reference,
      r.title,
      formatEnum(r.category),
      r.owner.name,
      r.businessUnit?.name ?? "",
      r.residualScore ?? r.inherentScore,
      formatEnum(r.treatment),
      r.nextReviewDate.toISOString().slice(0, 10),
    ]);
  }

  // Auto-fit column widths across sheets
  [summarySheet, unmappedSheet, mappedSheet, risksSheet].forEach((sheet) => {
    sheet.columns.forEach((column) => {
      column.width = Math.min(Math.max((column.header?.toString().length ?? 10) + 4, 14), 36);
    });
  });

  return Buffer.from(await workbook.xlsx.writeBuffer());
}

// ---------------------------------------------------------------------------
// Phase 4: Treatment Status & Action Progress Report
// ---------------------------------------------------------------------------
export async function treatmentStatusCsv(tenantId: string) {
  const plans = await db.treatmentPlan.findMany({
    where: { tenantId },
    include: {
      risk: { select: { reference: true, title: true, status: true, treatment: true, residualScore: true } },
      createdBy: { select: { name: true } },
      actions: { select: { id: true, title: true, status: true, dueDate: true, owner: { select: { name: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });

  const headers = ["Risk Reference", "Risk Title", "Risk Status", "Treatment Type", "Residual Score", "Plan Status", "Plan Summary", "Target Date", "Total Actions", "Completed Actions", "Overdue Actions"];
  const now = new Date();
  const rows = plans.map((p) => {
    const total = p.actions.length;
    const completed = p.actions.filter((a) => a.status === "COMPLETED").length;
    const overdue = p.actions.filter((a) => a.status !== "COMPLETED" && a.dueDate && a.dueDate < now).length;
    return [
      p.risk.reference,
      p.risk.title,
      formatEnum(p.risk.status),
      formatEnum(p.risk.treatment),
      p.risk.residualScore ?? "",
      formatEnum(p.status),
      p.summary,
      p.targetDate ? p.targetDate.toISOString().slice(0, 10) : "",
      total,
      completed,
      overdue,
    ];
  });

  return [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
}

export async function treatmentStatusWorkbook(tenantId: string) {
  const plans = await db.treatmentPlan.findMany({
    where: { tenantId },
    include: {
      risk: { select: { reference: true, title: true, status: true, treatment: true, residualScore: true } },
      createdBy: { select: { name: true } },
      actions: { select: { id: true, title: true, status: true, dueDate: true, owner: { select: { name: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });

  const workbook = new ExcelJS.Workbook();
  const summarySheet = workbook.addWorksheet("Treatment Summary");
  const headers = ["Risk Reference", "Risk Title", "Risk Status", "Treatment Type", "Residual Score", "Plan Status", "Plan Summary", "Target Date", "Total Actions", "Completed Actions", "Overdue Actions"];
  summarySheet.addRow(headers);
  summarySheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  summarySheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0A2540" } };

  const now = new Date();
  for (const p of plans) {
    const total = p.actions.length;
    const completed = p.actions.filter((a) => a.status === "COMPLETED").length;
    const overdue = p.actions.filter((a) => a.status !== "COMPLETED" && a.dueDate && a.dueDate < now).length;
    summarySheet.addRow([
      p.risk.reference,
      p.risk.title,
      formatEnum(p.risk.status),
      formatEnum(p.risk.treatment),
      p.risk.residualScore ?? "",
      formatEnum(p.status),
      p.summary,
      p.targetDate ? p.targetDate.toISOString().slice(0, 10) : "",
      total,
      completed,
      overdue,
    ]);
  }

  const actionsSheet = workbook.addWorksheet("Treatment Actions");
  const actionHeaders = ["Risk Reference", "Action Title", "Action Owner", "Status", "Due Date", "Is Overdue"];
  actionsSheet.addRow(actionHeaders);
  actionsSheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  actionsSheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0A2540" } };

  for (const p of plans) {
    for (const a of p.actions) {
      const isOverdue = a.status !== "COMPLETED" && a.dueDate && a.dueDate < now;
      actionsSheet.addRow([
        p.risk.reference,
        a.title,
        a.owner.name,
        formatEnum(a.status),
        a.dueDate ? a.dueDate.toISOString().slice(0, 10) : "",
        isOverdue ? "YES" : "NO",
      ]);
    }
  }

  [summarySheet, actionsSheet].forEach((sheet) => {
    sheet.columns.forEach((column) => {
      column.width = Math.min(Math.max((column.header?.toString().length ?? 10) + 4, 14), 36);
    });
  });

  return Buffer.from(await workbook.xlsx.writeBuffer());
}

export async function treatmentStatusPdf(tenantId: string) {
  const plans = await db.treatmentPlan.findMany({
    where: { tenantId },
    include: {
      risk: { select: { reference: true, title: true, status: true, treatment: true, residualScore: true } },
      actions: { select: { id: true, title: true, status: true, dueDate: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const headers = ["Risk", "Treatment", "Plan Status", "Target Date", "Actions (Done/Total)"];
  const rows = plans.map((p) => {
    const total = p.actions.length;
    const completed = p.actions.filter((a) => a.status === "COMPLETED").length;
    return [
      `${p.risk.reference} - ${p.risk.title}`,
      formatEnum(p.risk.treatment),
      formatEnum(p.status),
      p.targetDate ? p.targetDate.toISOString().slice(0, 10) : "None",
      `${completed}/${total}`,
    ];
  });

  return rowsPdf("Treatment status and action progress", headers, rows);
}

// ---------------------------------------------------------------------------
// Phase 4: Control Effectiveness Summary Report
// ---------------------------------------------------------------------------
export async function controlEffectivenessCsv(tenantId: string) {
  const profiles = await db.controlProfile.findMany({
    where: { tenantId },
    include: {
      frameworkControl: { include: { framework: { select: { name: true } } } },
      owner: { select: { name: true } },
      tests: { orderBy: { testDate: "desc" }, take: 1, select: { result: true, testDate: true } },
    },
    orderBy: { frameworkControl: { controlId: "asc" } },
  });

  const headers = ["Framework", "Control ID", "Title", "Owner", "Implementation Status", "Effectiveness", "Frequency", "Last Tested", "Last Outcome"];
  const rows = profiles.map((p) => [
    p.frameworkControl.framework.name,
    p.frameworkControl.controlId,
    p.frameworkControl.title,
    p.owner?.name ?? "Unassigned",
    formatEnum(p.implementationStatus),
    formatEnum(p.effectiveness),
    p.frequency ? formatEnum(p.frequency) : "Ad-hoc",
    p.lastTestedAt ? p.lastTestedAt.toISOString().slice(0, 10) : "",
    p.tests[0]?.result ? formatEnum(p.tests[0].result) : "",
  ]);

  return [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
}

export async function controlEffectivenessWorkbook(tenantId: string) {
  const profiles = await db.controlProfile.findMany({
    where: { tenantId },
    include: {
      frameworkControl: { include: { framework: { select: { name: true } } } },
      owner: { select: { name: true } },
      tests: { orderBy: { testDate: "desc" }, take: 1, select: { result: true, testDate: true } },
    },
    orderBy: { frameworkControl: { controlId: "asc" } },
  });

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Control Effectiveness");
  const headers = ["Framework", "Control ID", "Title", "Owner", "Implementation Status", "Effectiveness", "Frequency", "Last Tested", "Last Outcome"];
  sheet.addRow(headers);
  sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0A2540" } };

  for (const p of profiles) {
    sheet.addRow([
      p.frameworkControl.framework.name,
      p.frameworkControl.controlId,
      p.frameworkControl.title,
      p.owner?.name ?? "Unassigned",
      formatEnum(p.implementationStatus),
      formatEnum(p.effectiveness),
      p.frequency ? formatEnum(p.frequency) : "Ad-hoc",
      p.lastTestedAt ? p.lastTestedAt.toISOString().slice(0, 10) : "",
      p.tests[0]?.result ? formatEnum(p.tests[0].result) : "",
    ]);
  }

  sheet.columns.forEach((column) => {
    column.width = Math.min(Math.max((column.header?.toString().length ?? 10) + 4, 14), 36);
  });

  return Buffer.from(await workbook.xlsx.writeBuffer());
}

export async function controlEffectivenessPdf(tenantId: string) {
  const profiles = await db.controlProfile.findMany({
    where: { tenantId },
    include: {
      frameworkControl: { include: { framework: { select: { name: true } } } },
      owner: { select: { name: true } },
    },
    orderBy: { frameworkControl: { controlId: "asc" } },
  });

  const headers = ["Control", "Framework", "Owner", "Implementation", "Effectiveness"];
  const rows = profiles.map((p) => [
    `${p.frameworkControl.controlId} ${p.frameworkControl.title}`,
    p.frameworkControl.framework.name,
    p.owner?.name ?? "Unassigned",
    formatEnum(p.implementationStatus),
    formatEnum(p.effectiveness),
  ]);

  return rowsPdf("Control effectiveness summary", headers, rows);
}

// ---------------------------------------------------------------------------
// Phase 4: Overdue Items Report (Reviews + Actions)
// ---------------------------------------------------------------------------
export async function overdueItemsCsv(tenantId: string) {
  const now = new Date();
  const [overdueRisks, overdueActions] = await Promise.all([
    db.risk.findMany({
      where: { tenantId, deletedAt: null, nextReviewDate: { lt: now } },
      include: { owner: { select: { name: true } } },
      orderBy: { nextReviewDate: "asc" },
    }),
    db.treatmentAction.findMany({
      where: { tenantId, status: { in: ["NOT_STARTED", "IN_PROGRESS", "BLOCKED"] }, dueDate: { lt: now } },
      include: { owner: { select: { name: true } }, treatmentPlan: { include: { risk: { select: { reference: true } } } } },
      orderBy: { dueDate: "asc" },
    }),
  ]);

  const headers = ["Item Type", "Reference", "Title", "Accountable Owner", "Due Date", "Days Overdue", "Status / Severity"];
  const rows: unknown[][] = [];

  for (const r of overdueRisks) {
    const days = Math.floor((now.getTime() - r.nextReviewDate.getTime()) / (1000 * 60 * 60 * 24));
    rows.push(["Risk Review", r.reference, r.title, r.owner.name, r.nextReviewDate.toISOString().slice(0, 10), days, `Score ${r.residualScore ?? r.inherentScore}`]);
  }

  for (const a of overdueActions) {
    const days = a.dueDate ? Math.floor((now.getTime() - a.dueDate.getTime()) / (1000 * 60 * 60 * 24)) : 0;
    rows.push(["Treatment Action", a.treatmentPlan.risk.reference, a.title, a.owner.name, a.dueDate ? a.dueDate.toISOString().slice(0, 10) : "", days, formatEnum(a.status)]);
  }

  return [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
}

export async function overdueItemsWorkbook(tenantId: string) {
  const now = new Date();
  const [overdueRisks, overdueActions] = await Promise.all([
    db.risk.findMany({
      where: { tenantId, deletedAt: null, nextReviewDate: { lt: now } },
      include: { owner: { select: { name: true } }, businessUnit: { select: { name: true } } },
      orderBy: { nextReviewDate: "asc" },
    }),
    db.treatmentAction.findMany({
      where: { tenantId, status: { in: ["NOT_STARTED", "IN_PROGRESS", "BLOCKED"] }, dueDate: { lt: now } },
      include: { owner: { select: { name: true } }, treatmentPlan: { include: { risk: { select: { reference: true, title: true } } } } },
      orderBy: { dueDate: "asc" },
    }),
  ]);

  const workbook = new ExcelJS.Workbook();

  // Overdue Reviews Sheet
  const reviewsSheet = workbook.addWorksheet("Overdue Risk Reviews");
  const reviewHeaders = ["Reference", "Title", "Owner", "Business Unit", "Review Due Date", "Days Overdue", "Residual Score", "Status"];
  reviewsSheet.addRow(reviewHeaders);
  reviewsSheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  reviewsSheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0A2540" } };

  for (const r of overdueRisks) {
    const days = Math.floor((now.getTime() - r.nextReviewDate.getTime()) / (1000 * 60 * 60 * 24));
    reviewsSheet.addRow([
      r.reference,
      r.title,
      r.owner.name,
      r.businessUnit?.name ?? "",
      r.nextReviewDate.toISOString().slice(0, 10),
      days,
      r.residualScore ?? r.inherentScore,
      formatEnum(r.status),
    ]);
  }

  // Overdue Actions Sheet
  const actionsSheet = workbook.addWorksheet("Overdue Treatment Actions");
  const actionHeaders = ["Risk Reference", "Action Title", "Action Owner", "Due Date", "Days Overdue", "Status"];
  actionsSheet.addRow(actionHeaders);
  actionsSheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  actionsSheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0A2540" } };

  for (const a of overdueActions) {
    const days = a.dueDate ? Math.floor((now.getTime() - a.dueDate.getTime()) / (1000 * 60 * 60 * 24)) : 0;
    actionsSheet.addRow([
      a.treatmentPlan.risk.reference,
      a.title,
      a.owner.name,
      a.dueDate ? a.dueDate.toISOString().slice(0, 10) : "",
      days,
      formatEnum(a.status),
    ]);
  }

  [reviewsSheet, actionsSheet].forEach((sheet) => {
    sheet.columns.forEach((column) => {
      column.width = Math.min(Math.max((column.header?.toString().length ?? 10) + 4, 14), 36);
    });
  });

  return Buffer.from(await workbook.xlsx.writeBuffer());
}

export async function overdueItemsPdf(tenantId: string) {
  const now = new Date();
  const [overdueRisks, overdueActions] = await Promise.all([
    db.risk.findMany({
      where: { tenantId, deletedAt: null, nextReviewDate: { lt: now } },
      include: { owner: { select: { name: true } } },
      orderBy: { nextReviewDate: "asc" },
    }),
    db.treatmentAction.findMany({
      where: { tenantId, status: { in: ["NOT_STARTED", "IN_PROGRESS", "BLOCKED"] }, dueDate: { lt: now } },
      include: { owner: { select: { name: true } }, treatmentPlan: { include: { risk: { select: { reference: true } } } } },
      orderBy: { dueDate: "asc" },
    }),
  ]);

  const headers = ["Item", "Reference", "Owner", "Due Date", "Days Overdue"];
  const rows: unknown[][] = [];

  for (const r of overdueRisks) {
    const days = Math.floor((now.getTime() - r.nextReviewDate.getTime()) / (1000 * 60 * 60 * 24));
    rows.push(["Risk Review", `${r.reference} ${r.title}`, r.owner.name, r.nextReviewDate.toISOString().slice(0, 10), `${days} days`]);
  }

  for (const a of overdueActions) {
    const days = a.dueDate ? Math.floor((now.getTime() - a.dueDate.getTime()) / (1000 * 60 * 60 * 24)) : 0;
    rows.push(["Action", `${a.treatmentPlan.risk.reference}: ${a.title}`, a.owner.name, a.dueDate ? a.dueDate.toISOString().slice(0, 10) : "", `${days} days`]);
  }

  return rowsPdf("Overdue risk reviews and treatment actions", headers, rows);
}

// ---------------------------------------------------------------------------
// Phase 4: Exposure Summary Report
// ---------------------------------------------------------------------------
export async function exposureSummaryCsv(tenantId: string) {
  const risks = await db.risk.findMany({
    where: { tenantId, deletedAt: null },
    include: riskInclude,
    orderBy: { residualScore: "desc" },
  });

  const headers = ["Reference", "Title", "Category", "Owner", "Business Unit", "Inherent Score", "Residual Score", "Exposure Level", "Treatment", "Status"];
  const rows = risks.map((r) => [
    r.reference,
    r.title,
    formatEnum(r.category),
    r.owner.name,
    r.businessUnit?.name ?? "Unassigned",
    r.inherentScore,
    r.residualScore ?? r.inherentScore,
    riskLevel(r.residualScore ?? r.inherentScore),
    formatEnum(r.treatment),
    formatEnum(r.status),
  ]);

  return [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
}

export async function exposureSummaryWorkbook(tenantId: string) {
  const [tenant, risks, breaches] = await Promise.all([
    db.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { name: true } }),
    db.risk.findMany({ where: { tenantId, deletedAt: null }, include: riskInclude, orderBy: { residualScore: "desc" } }),
    db.appetiteBreach.findMany({ where: { tenantId, status: { in: ["OPEN", "ACKNOWLEDGED", "TREATING"] } }, include: { risk: { select: { reference: true } } } }),
  ]);

  const workbook = new ExcelJS.Workbook();
  const summarySheet = workbook.addWorksheet("Exposure Overview");
  summarySheet.addRow(["BeyondBeams GRC - Portfolio Exposure Summary"]);
  summarySheet.addRow(["Workspace", tenant.name]);
  summarySheet.addRow(["Generated At", new Date().toISOString()]);
  summarySheet.addRow([]);

  const total = risks.length;
  const critical = risks.filter((r) => (r.residualScore ?? r.inherentScore) >= 20).length;
  const high = risks.filter((r) => { const s = r.residualScore ?? r.inherentScore; return s >= 15 && s < 20; }).length;
  const moderate = risks.filter((r) => { const s = r.residualScore ?? r.inherentScore; return s >= 7 && s < 15; }).length;
  const low = risks.filter((r) => (r.residualScore ?? r.inherentScore) < 7).length;

  summarySheet.addRow(["Metric", "Value"]);
  summarySheet.addRow(["Total Active Risks", total]);
  summarySheet.addRow(["Critical Exposure (≥ 20)", critical]);
  summarySheet.addRow(["High Exposure (15–19)", high]);
  summarySheet.addRow(["Moderate Exposure (7–14)", moderate]);
  summarySheet.addRow(["Low Exposure (< 7)", low]);
  summarySheet.addRow(["Active Appetite Breaches", breaches.length]);
  summarySheet.getRow(5).font = { bold: true };

  const registerSheet = workbook.addWorksheet("Ranked Risks");
  const headers = ["Rank", "Reference", "Title", "Category", "Owner", "Business Unit", "Inherent Score", "Residual Score", "Exposure Level", "Treatment", "Status"];
  registerSheet.addRow(headers);
  registerSheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  registerSheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0A2540" } };

  risks.forEach((r, index) => {
    const score = r.residualScore ?? r.inherentScore;
    registerSheet.addRow([
      index + 1,
      r.reference,
      r.title,
      formatEnum(r.category),
      r.owner.name,
      r.businessUnit?.name ?? "Unassigned",
      r.inherentScore,
      score,
      riskLevel(score),
      formatEnum(r.treatment),
      formatEnum(r.status),
    ]);
  });

  [summarySheet, registerSheet].forEach((sheet) => {
    sheet.columns.forEach((column) => {
      column.width = Math.min(Math.max((column.header?.toString().length ?? 10) + 4, 14), 36);
    });
  });

  return Buffer.from(await workbook.xlsx.writeBuffer());
}

export async function exposureSummaryPdf(tenantId: string) {
  const risks = await db.risk.findMany({
    where: { tenantId, deletedAt: null },
    include: riskInclude,
    orderBy: { residualScore: "desc" },
  });

  const headers = ["Reference", "Title", "Category", "Owner", "Score", "Level", "Treatment"];
  const rows = risks.map((r) => {
    const score = r.residualScore ?? r.inherentScore;
    return [
      r.reference,
      r.title,
      formatEnum(r.category),
      r.owner.name,
      score,
      riskLevel(score),
      formatEnum(r.treatment),
    ];
  });

  return rowsPdf("Portfolio risk profile and exposure summary", headers, rows);
}