"use server";

import { Role } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/authz";
import { appUrl, createToken, deliverLink, hashToken } from "@/lib/tokens";

const inviteSchema = z.object({ email: z.string().trim().email().transform((value) => value.toLowerCase()), role: z.nativeEnum(Role) });
export async function inviteMember(input: z.input<typeof inviteSchema>) {
  const session = await requireRole([Role.OWNER, Role.RISK_MANAGER]); const parsed = inviteSchema.safeParse(input); if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the invitation." };
  const existingUser = await db.user.findUnique({ where: { email: parsed.data.email }, include: { memberships: true } });
  if (existingUser?.memberships.some((membership) => membership.tenantId === session.user.tenantId && membership.acceptedAt)) return { error: "This person is already a member." };
  if (existingUser && existingUser.tenantId !== session.user.tenantId) return { error: "This email belongs to another workspace and cannot be invited." };
  const token = createToken(); const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const membership = await db.membership.upsert({ where: { tenantId_inviteEmail: { tenantId: session.user.tenantId, inviteEmail: parsed.data.email } }, update: { role: parsed.data.role, inviteToken: hashToken(token), inviteExpires: expires, invitedById: session.user.id }, create: { tenantId: session.user.tenantId, inviteEmail: parsed.data.email, inviteToken: hashToken(token), inviteExpires: expires, invitedById: session.user.id, role: parsed.data.role } });
  const url = `${appUrl()}/invite/${token}`; deliverLink("invitation", parsed.data.email, url);
  await db.auditEvent.create({ data: { tenantId: session.user.tenantId, actorId: session.user.id, action: "CREATE", entityType: "MembershipInvitation", entityId: membership.id, summary: `Invited ${parsed.data.email} as ${parsed.data.role}` } }); revalidatePath("/app/roles");
  return { success: true, message: "Invitation created. In local development, the link is in the server console.", localUrl: process.env.NODE_ENV === "development" ? url : undefined };
}