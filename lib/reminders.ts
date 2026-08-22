import { db } from "@/lib/db";
import { appUrl } from "@/lib/tokens";
import { sendNotificationEmail } from "@/lib/email";

export async function sendReviewReminders(asOf = new Date()) {
  const tenants = await db.tenant.findMany({ where: { reviewRemindersEnabled: true }, select: { id: true, name: true, reviewReminderCadence: true } });
  let sent = 0;
  for (const tenant of tenants) {
    const cadence = new Set(tenant.reviewReminderCadence.split(",").map(Number));
    const risks = await db.risk.findMany({ where: { tenantId: tenant.id, deletedAt: null, nextReviewDate: { lte: new Date(asOf.getTime() + 7 * 86400000) } }, include: { owner: { select: { id: true, email: true, reviewEmailsEnabled: true } } } });
    const emerging = await db.emergingRisk.findMany({ where: { tenantId: tenant.id, status: "MONITORING", nextReviewDate: { lte: new Date(asOf.getTime() + 7 * 86400000) } }, include: { owner: { select: { id: true, email: true, reviewEmailsEnabled: true } } } });
    for (const item of [...risks.map((risk) => ({ ...risk, entityType: "Risk", entityId: risk.id, score: risk.residualScore ?? risk.inherentScore })), ...emerging.map((risk) => ({ ...risk, entityType: "EmergingRisk", entityId: risk.id, score: undefined }))]) {
      const days = Math.ceil((item.nextReviewDate.getTime() - asOf.getTime()) / 86400000);
      const interval = days < 0 ? 0 : days;
      if (!cadence.has(interval) || !item.owner.reviewEmailsEnabled) continue;
      const state = days < 0 ? "overdue" : days === 0 ? "due today" : `due in ${days} days`;
      const result = await sendNotificationEmail({ tenantId: tenant.id, userId: item.owner.id, recipient: item.owner.email, type: "REVIEW_REMINDER", subject: `${item.title} review is ${state}`, eyebrow: days < 0 ? "Overdue review" : "Upcoming review", heading: `Review ${item.title}`, paragraphs: [`The ${item.entityType === "EmergingRisk" ? "emerging risk" : "risk"} review for “${item.title}” is ${state}. Please confirm the current position and next decision.`, `This reminder was generated for ${tenant.name}.`], cta: { label: "Open review", url: `${appUrl()}/app/${item.entityType === "Risk" ? `risks/${item.id}` : "emerging-risks"}` }, details: [{ label: "Current residual score", value: item.score === undefined ? "Monitoring" : String(item.score) }, { label: "Review date", value: item.nextReviewDate.toLocaleDateString("en-US", { dateStyle: "long" }) }], relatedEntityType: item.entityType, relatedEntityId: item.entityId, dedupeKey: `review:${item.entityId}:${item.nextReviewDate.toISOString().slice(0, 10)}:${interval}` });
      if (result.sent) sent += 1;
      await db.auditEvent.create({ data: { tenantId: tenant.id, actorId: item.owner.id, action: "CREATE", entityType: "Notification", entityId: result.notificationId ?? item.entityId, summary: `Sent ${state} review reminder for ${item.title}` } });
    }
  }
  return { sent };
}