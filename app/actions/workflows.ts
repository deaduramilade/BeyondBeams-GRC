import type { Prisma } from "@prisma/client";
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Role } from "@prisma/client";
import { db } from "@/lib/db";
import { requireRole, writeRoles } from "@/lib/authz";
import { isModuleSlug } from "@/lib/modules";
import { linkComplianceToRisk } from "@/lib/compliance";
import { appUrl } from "@/lib/tokens";
import { sendNotificationEmail } from "@/lib/email";
import { notifyEmergingSettlement } from "@/lib/lifecycle-notifications";
import { nextRiskReference } from "@/lib/risk-reference";

const recordSchema = z.object({ module: z.string(), title: z.string().trim().min(3).max(140), owner: z.string().trim().min(2).max(100), status: z.string().trim().min(2).max(40), priority: z.string().trim().min(2).max(20), dueDate: z.coerce.date().nullable(), details: z.string().trim().min(10).max(5000), outcome: z.string().trim().min(10).max(3000) });

export async function createGrcRecord(input: z.input<typeof recordSchema>) {
  const session = await requireRole(writeRoles); const parsed = recordSchema.safeParse(input);
  if (!parsed.success || !isModuleSlug(parsed.data.module)) return { error: parsed.success ? "Unknown GRC module." : parsed.error.issues[0]?.message ?? "Invalid record." };
  const record = await db.grcRecord.create({ data: { ...parsed.data, tenantId: session.user.tenantId, createdById: session.user.id } });
  await db.auditEvent.create({ data: { tenantId: session.user.tenantId, actorId: session.user.id, action: "CREATE", entityType: parsed.data.module, entityId: record.id, summary: `Created ${parsed.data.module} record: ${record.title}` } });
  const assignee = await db.user.findFirst({ where: { tenantId: session.user.tenantId, OR: [{ name: parsed.data.owner }, { email: parsed.data.owner.toLowerCase() }] }, select: { id: true, email: true, assignmentEmailsEnabled: true } });
  if (assignee?.assignmentEmailsEnabled) await sendNotificationEmail({ tenantId: session.user.tenantId, userId: assignee.id, recipient: assignee.email, type: "ACTION_ASSIGNED", subject: `Action assigned: ${record.title}`, eyebrow: "Action assignment", heading: "A GRC action needs your attention", paragraphs: [`You have been named accountable owner for “${record.title}”.`, parsed.data.dueDate ? `Due date: ${parsed.data.dueDate.toLocaleDateString("en-US", { dateStyle: "long" })}.` : "No due date was set."], cta: { label: "Open workspace", url: `${appUrl()}/app/${parsed.data.module}` }, details: [{ label: "Priority", value: parsed.data.priority }, { label: "Status", value: parsed.data.status }], relatedEntityType: parsed.data.module, relatedEntityId: record.id });
  revalidatePath(`/app/${parsed.data.module}`); return { success: true };
}

const emergingSchema = z.object({ title: z.string().trim().min(3).max(140), hypothesis: z.string().trim().min(10).max(3000), indicators: z.string().trim().min(5).max(3000), cadence: z.enum(["WEEKLY", "MONTHLY", "QUARTERLY"]), horizon: z.enum(["0-3 MONTHS", "3-12 MONTHS", "1-3 YEARS", "3+ YEARS"]), ownerId: z.string().cuid(), nextReviewDate: z.coerce.date() });
export async function createEmergingRisk(input: z.input<typeof emergingSchema>) {
  const session = await requireRole(writeRoles); const parsed = emergingSchema.safeParse(input); if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid emerging risk." };
  const owner = await db.user.findFirst({ where: { id: parsed.data.ownerId, tenantId: session.user.tenantId } }); if (!owner) return { error: "Owner is not in this workspace." };
  const emerging = await db.emergingRisk.create({ data: { ...parsed.data, tenantId: session.user.tenantId } });
  await db.auditEvent.create({ data: { tenantId: session.user.tenantId, actorId: session.user.id, action: "CREATE", entityType: "EmergingRisk", entityId: emerging.id, summary: `Flagged emerging risk: ${emerging.title}` } }); revalidatePath("/app/emerging-risks"); return { success: true };
}

export async function settleEmergingRisk(id: string, decision: string, promote: boolean) {
  const session = await requireRole(writeRoles); const item = await db.emergingRisk.findFirst({ where: { id, tenantId: session.user.tenantId, status: "MONITORING" } }); if (!item) return { error: "Emerging risk not found or already settled." };
  let promotedRiskId: string | undefined;
  if (promote) { const risk = await db.$transaction(async (tx: Prisma.TransactionClient) => { const reference = await nextRiskReference(tx, session.user.tenantId); return tx.risk.create({ data: { tenantId: session.user.tenantId, reference, title: item.title, description: item.hypothesis, category: "STRATEGIC", ownerId: item.ownerId, inherentLikelihood: 3, inherentImpact: 3, inherentScore: 9, treatment: "NONE", status: "IN_REVIEW", nextReviewDate: item.nextReviewDate } }); }); await linkComplianceToRisk(risk); promotedRiskId = risk.id; }
  await db.emergingRisk.update({ where: { id }, data: { status: promote ? "PROMOTED" : "SETTLED", settlementDecision: decision, settledAt: new Date(), promotedRiskId } });
  await notifyEmergingSettlement(item, promote);
  await db.auditEvent.create({ data: { tenantId: session.user.tenantId, actorId: session.user.id, action: "UPDATE", entityType: "EmergingRisk", entityId: id, summary: promote ? `Promoted emerging risk into the formal register` : `Settled emerging risk without promotion`, changes: decision } }); revalidatePath("/app/emerging-risks"); revalidatePath("/app/risks"); return { success: true };
}

export async function translateForBoard(
  input: string,
  context?: {
    riskReference?: string;
    controls?: string[];
    businessUnit?: string;
    objective?: string;
  }
) {
  const session = await requireRole(Object.values(Role));
  const parsed = z.string().trim().min(20).max(5000).safeParse(input);
  if (!parsed.success) return { error: "Enter at least 20 characters of technical risk context." };

  const entitlement = await db.$transaction(async (tx) => {
    const user = await tx.user.findFirst({
      where: { id: session.user.id, tenantId: session.user.tenantId },
      select: { translatorUses: true, paidPlan: true },
    });
    if (!user) return null;
    if (!user.paidPlan && user.translatorUses >= 3) return false;
    await tx.user.update({
      where: { id: session.user.id },
      data: { translatorUses: { increment: 1 } },
    });
    return user;
  });

  if (entitlement === null) return { error: "User not found." };
  if (entitlement === false) {
    return { error: "Your 3 free board translations have been used. Upgrade to continue.", limitReached: true };
  }
  const user = entitlement;

  const replacements: [RegExp, string][] = [
    [/vulnerabilit(?:y|ies)/gi, "control weakness"],
    [/threat actor/gi, "potential attacker"],
    [/data exfiltration/gi, "unauthorised loss of information"],
    [/ransomware/gi, "criminal disruption and extortion"],
    [/non-compliance/gi, "regulatory exposure"],
    [/CVE-\S+/gi, "a known software weakness"],
    [/RTO/gi, "recovery time objective"],
    [/privileged access/gi, "high-level system access"],
  ];
  let clear = parsed.data;
  replacements.forEach(([pattern, value]) => {
    clear = clear.replace(pattern, value);
  });

  let contextSummary = "";
  if (context?.businessUnit || context?.objective) {
    contextSummary += `\n\nStrategic alignment: Affects ${context.businessUnit ?? "general operations"}${
      context.objective ? ` and the '${context.objective}' objective` : ""
    }.`;
  }
  if (context?.controls && context.controls.length > 0) {
    contextSummary += `\nGoverning controls: Aligned to ${context.controls.join(", ")}.`;
  }

  const output = `Business exposure\n${clear}${contextSummary}\n\nBoard perspective\nThis may affect operational continuity, stakeholder trust, regulatory standing, or financial performance. Management should confirm the accountable owner, quantify the plausible impact, validate current controls, and report progress against a dated treatment decision.`;

  await db.auditEvent.create({
    data: {
      tenantId: session.user.tenantId,
      actorId: session.user.id,
      action: "CREATE",
      entityType: "BoardTranslation",
      entityId: session.user.id,
      summary: "Generated board-language translation",
    },
  });

  revalidatePath("/app/translator");
  return {
    success: true,
    output,
    remaining: user.paidPlan ? null : Math.max(0, 3 - (user.translatorUses + 1)),
  };
}