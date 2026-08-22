import { Role } from "@prisma/client";
import { db } from "@/lib/db";
import { appUrl } from "@/lib/tokens";
import { sendNotificationEmail } from "@/lib/email";

async function riskManagers(tenantId: string) {
  return db.user.findMany({ where: { tenantId, memberships: { some: { tenantId, acceptedAt: { not: null }, role: { in: [Role.OWNER, Role.RISK_MANAGER] } } } }, select: { id: true, email: true, assignmentEmailsEnabled: true } });
}

export async function notifyHighResidualRisk(risk: { id: string; tenantId: string; title: string; reference: string; residualScore: number | null }, previousScore?: number | null) {
  const score = risk.residualScore ?? 0;
  if (score < 15 || (previousScore !== undefined && (previousScore ?? 0) >= 15 && score <= (previousScore ?? 0))) return;
  for (const recipient of await riskManagers(risk.tenantId)) if (recipient.assignmentEmailsEnabled) await sendNotificationEmail({ tenantId: risk.tenantId, userId: recipient.id, recipient: recipient.email, type: "HIGH_RESIDUAL_RISK", subject: `High residual risk: ${risk.title}`, eyebrow: "Priority risk alert", heading: "High residual exposure needs attention", paragraphs: [`${risk.reference} ${risk.title} has a residual score of ${score}. Review the treatment decision and confirm the next action.`], cta: { label: "Open risk", url: `${appUrl()}/app/risks/${risk.id}` }, details: [{ label: "Residual score", value: String(score) }], relatedEntityType: "Risk", relatedEntityId: risk.id, dedupeKey: `high-risk:${risk.id}:${score}` });
}

export async function notifyTreatmentChange(risk: { id: string; tenantId: string; title: string; treatment: string }, previousTreatment: string) {
  if (risk.treatment === previousTreatment || !["MITIGATE", "ACCEPT"].includes(risk.treatment)) return;
  for (const recipient of await riskManagers(risk.tenantId)) if (recipient.assignmentEmailsEnabled) await sendNotificationEmail({ tenantId: risk.tenantId, userId: recipient.id, recipient: recipient.email, type: "TREATMENT_CHANGED", subject: `Treatment changed for ${risk.title}`, eyebrow: "Treatment decision", heading: "Risk treatment updated", paragraphs: [`The treatment for ${risk.title} changed from ${previousTreatment.replaceAll("_", " ")} to ${risk.treatment.replaceAll("_", " ")}.`], cta: { label: "Review risk", url: `${appUrl()}/app/risks/${risk.id}` }, details: [{ label: "New treatment", value: risk.treatment.replaceAll("_", " ") }], relatedEntityType: "Risk", relatedEntityId: risk.id });
}

export async function notifyEmergingSettlement(item: { id: string; tenantId: string; title: string; ownerId: string }, promoted: boolean) {
  const recipients = await db.user.findMany({ where: { tenantId: item.tenantId, OR: [{ id: item.ownerId }, { memberships: { some: { tenantId: item.tenantId, acceptedAt: { not: null }, role: { in: [Role.OWNER, Role.RISK_MANAGER] } } } }] }, select: { id: true, email: true, assignmentEmailsEnabled: true } });
  for (const recipient of recipients) if (recipient.assignmentEmailsEnabled) await sendNotificationEmail({ tenantId: item.tenantId, userId: recipient.id, recipient: recipient.email, type: "EMERGING_RISK_SETTLED", subject: `${item.title} was ${promoted ? "promoted" : "settled"}`, eyebrow: "Emerging risk decision", heading: promoted ? "Emerging risk promoted" : "Emerging risk settled", paragraphs: [`The emerging risk “${item.title}” was ${promoted ? "promoted to the formal risk register" : "settled without promotion"}.`], cta: { label: "Open emerging risks", url: `${appUrl()}/app/emerging-risks` }, relatedEntityType: "EmergingRisk", relatedEntityId: item.id });
}