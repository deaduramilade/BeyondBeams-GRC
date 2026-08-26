"use server";

import { Role } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePermission, requireSession } from "@/lib/authz";
import { sendNotificationEmail, type EmailInput } from "@/lib/email";

const preferences = z.object({ reviewEmailsEnabled: z.boolean(), assignmentEmailsEnabled: z.boolean(), exportEmailsEnabled: z.boolean() });
export async function updateNotificationPreferences(input: z.input<typeof preferences>) {
  const session = await requireSession();
  const parsed = preferences.safeParse(input);
  if (!parsed.success) return { error: "Choose valid notification preferences." };
  await db.user.update({ where: { id: session.user.id }, data: parsed.data });
  await db.auditEvent.create({ data: { tenantId: session.user.tenantId, actorId: session.user.id, action: "UPDATE", entityType: "NotificationPreferences", entityId: session.user.id, summary: "Updated email notification preferences" } });
  revalidatePath("/app/settings");
  return { success: true };
}

const tenantSettings = z.object({ enabled: z.boolean(), cadence: z.string().regex(/^\d+(,\d+)*$/) });
export async function updateReviewReminderSettings(input: z.input<typeof tenantSettings>) {
  const session = await requireSession();
  if (session.user.role !== Role.OWNER) return { error: "Only an Owner can change workspace reminder settings." };
  const parsed = tenantSettings.safeParse(input);
  if (!parsed.success) return { error: "Use comma-separated day intervals such as 7,1,0." };
  const plan = await db.tenant.findUniqueOrThrow({ where: { id: session.user.tenantId }, select: { plan: true } });
  if (plan.plan === "FREE" && parsed.data.cadence !== "7,1,0") return { error: "Custom reminder cadence is available on Basic and higher plans. Upgrade to continue." };
  await db.tenant.update({ where: { id: session.user.tenantId }, data: { reviewRemindersEnabled: parsed.data.enabled, reviewReminderCadence: parsed.data.cadence } });
  await db.auditEvent.create({ data: { tenantId: session.user.tenantId, actorId: session.user.id, action: "UPDATE", entityType: "TenantNotificationSettings", entityId: session.user.tenantId, summary: "Updated review reminder settings" } });
  revalidatePath("/app/settings");
  return { success: true };
}

export async function retryFailedNotification(notificationId: string) {
  const session = await requirePermission("settings:manage");
  const notification = await db.notification.findFirst({ where: { id: notificationId, tenantId: session.user.tenantId, status: "FAILED" } });
  if (!notification) return { error: "Failed notification not found." };
  const supportedTypes = ["INVITATION", "MAGIC_LINK", "PASSWORD_RESET", "REVIEW_REMINDER", "EXPORT_DELIVERY", "ACTION_ASSIGNED", "ACTION_OVERDUE", "HIGH_RESIDUAL_RISK", "EMERGING_RISK_SETTLED", "TREATMENT_CHANGED"];
  if (!supportedTypes.includes(notification.type)) return { error: "This notification type cannot be retried." };
  const result = await sendNotificationEmail({ tenantId: session.user.tenantId, userId: notification.userId ?? undefined, recipient: notification.recipient, type: notification.type as EmailInput["type"], subject: notification.subject, eyebrow: "Retry delivery", heading: notification.subject, paragraphs: ["This notification is being retried after a previous delivery failure."], relatedEntityType: notification.relatedEntityType ?? undefined, relatedEntityId: notification.relatedEntityId ?? undefined, dedupeKey: `retry:${notification.id}:${Date.now()}` });
  return result.sent ? { success: true } : { error: "Notification retry failed." };
}