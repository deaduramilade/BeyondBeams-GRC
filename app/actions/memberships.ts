"use server";

import { Role } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/authz";
import { appUrl, createToken, hashToken } from "@/lib/tokens";
import { sendNotificationEmail } from "@/lib/email";

const inviteSchema = z.object({ email: z.string().trim().email().transform((value) => value.toLowerCase()), role: z.nativeEnum(Role) });
export async function inviteMember(input: z.input<typeof inviteSchema>) {
  const session = await requireRole([Role.OWNER, Role.RISK_MANAGER]); const parsed = inviteSchema.safeParse(input); if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the invitation." };
  const existingUser = await db.user.findUnique({ where: { email: parsed.data.email }, include: { memberships: true } });
  if (existingUser?.memberships.some((membership) => membership.tenantId === session.user.tenantId && membership.acceptedAt)) return { error: "This person is already a member." };
  if (existingUser && existingUser.tenantId !== session.user.tenantId) return { error: "This email belongs to another workspace and cannot be invited." };
  const token = createToken(); const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const membership = await db.membership.upsert({ where: { tenantId_inviteEmail: { tenantId: session.user.tenantId, inviteEmail: parsed.data.email } }, update: { role: parsed.data.role, inviteToken: hashToken(token), inviteExpires: expires, invitedById: session.user.id }, create: { tenantId: session.user.tenantId, inviteEmail: parsed.data.email, inviteToken: hashToken(token), inviteExpires: expires, invitedById: session.user.id, role: parsed.data.role } });
  const url = `${appUrl()}/invite/${token}`;
  const tenant = await db.tenant.findUniqueOrThrow({ where: { id: session.user.tenantId }, select: { name: true } });
  await sendNotificationEmail({ tenantId: session.user.tenantId, recipient: parsed.data.email, type: "INVITATION", subject: `You have been invited to ${tenant.name}`, eyebrow: "Workspace invitation", heading: "Join your risk workspace", paragraphs: [`You have been invited to join ${tenant.name} in BeyondBeams GRC.`, "Use the secure link below to set your password and activate your membership. This invitation can be used once."], cta: { label: "Accept invitation", url }, details: [{ label: "Organisation", value: tenant.name }, { label: "Role", value: parsed.data.role.replaceAll("_", " ") }, { label: "Expires", value: expires.toLocaleDateString("en-US", { dateStyle: "long" }) }], relatedEntityType: "MembershipInvitation", relatedEntityId: membership.id });
  await db.auditEvent.create({ data: { tenantId: session.user.tenantId, actorId: session.user.id, action: "CREATE", entityType: "MembershipInvitation", entityId: membership.id, summary: `Invited ${parsed.data.email} as ${parsed.data.role}` } }); revalidatePath("/app/roles");
  return { success: true, message: "Invitation created. In local development, the link is in the server console.", localUrl: process.env.NODE_ENV === "development" ? url : undefined };
}