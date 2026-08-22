"use server";

import { Role } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/authz";

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