"use server";

import { hash } from "bcryptjs";
import { Prisma, Role } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { appUrl, createToken, deliverLink, hashToken } from "@/lib/tokens";
import { requireSession } from "@/lib/authz";
import { createTotpSecret, encryptSecret, totpUri, verifyTotpCode } from "@/lib/security";
import { sendNotificationEmail } from "@/lib/email";
import { enforceRateLimit } from "@/lib/rate-limit";

const password = z.string().min(10, "Use at least 10 characters.").max(72);
const registrationSchema = z.object({ name: z.string().trim().min(2).max(80), email: z.string().trim().email().transform((value) => value.toLowerCase()), organisation: z.string().trim().min(2).max(100), password });
function slugBase(value: string) { return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 42) || "workspace"; }

export async function registerAccount(input: z.input<typeof registrationSchema>) {
  const limit = await enforceRateLimit("registration", String(input.email ?? "unknown")); if (!limit.allowed) return { error: "Too many registration attempts. Please try again later." };
  const parsed = registrationSchema.safeParse(input); if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check your details." };
  if (await db.user.findUnique({ where: { email: parsed.data.email }, select: { id: true } })) return { error: "An account already exists for this email." };
  const passwordHash = await hash(parsed.data.password, 12); const slug = `${slugBase(parsed.data.organisation)}-${createToken().slice(0, 7).toLowerCase()}`;
  try {
    await db.$transaction(async (tx) => { const tenant = await tx.tenant.create({ data: { name: parsed.data.organisation, slug } }); const user = await tx.user.create({ data: { name: parsed.data.name, email: parsed.data.email, passwordHash, tenantId: tenant.id, emailVerified: new Date() } }); await tx.membership.create({ data: { tenantId: tenant.id, userId: user.id, role: Role.OWNER, acceptedAt: new Date() } }); await tx.auditEvent.create({ data: { tenantId: tenant.id, actorId: user.id, action: "CREATE", entityType: "Tenant", entityId: tenant.id, summary: `Created workspace: ${tenant.name}` } }); });
    return { success: true, email: parsed.data.email };
  } catch (error) { if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return { error: "An account already exists for this email." }; return { error: "We could not create the workspace. Please try again." }; }
}

const emailSchema = z.string().trim().email().transform((value) => value.toLowerCase());
export async function requestMagicLink(rawEmail: string) {
  const limit = await enforceRateLimit("magicLink", rawEmail); if (!limit.allowed) return { error: "Too many requests. Please try again later." };
  const parsed = emailSchema.safeParse(rawEmail); if (!parsed.success) return { error: "Enter a valid email address." };
  if (await db.user.findUnique({ where: { email: parsed.data }, select: { id: true } })) { const token = createToken(); const identifier = `magic:${parsed.data}`; await db.$transaction([db.verificationToken.deleteMany({ where: { identifier } }), db.verificationToken.create({ data: { identifier, token: hashToken(token), expires: new Date(Date.now() + 15 * 60 * 1000) } })]); deliverLink("magic link", parsed.data, `${appUrl()}/magic-link?token=${encodeURIComponent(token)}&email=${encodeURIComponent(parsed.data)}`); }
  return { success: true, message: "If an account exists, a sign-in link has been sent. In local development, use the local email preview flow." };
}

export async function requestPasswordReset(rawEmail: string) {
  const limit = await enforceRateLimit("passwordReset", rawEmail); if (!limit.allowed) return { success: true };
  const parsed = emailSchema.safeParse(rawEmail); if (!parsed.success) return { success: true };
  const user = await db.user.findUnique({ where: { email: parsed.data }, select: { id: true } });
  if (user) { const token = createToken(); const url = `${appUrl()}/reset-password?token=${token}&email=${encodeURIComponent(parsed.data)}`; await db.$transaction([db.verificationToken.deleteMany({ where: { identifier: `reset:${parsed.data}` } }), db.verificationToken.create({ data: { identifier: `reset:${parsed.data}`, token: hashToken(token), expires: new Date(Date.now() + 30 * 60 * 1000) } })]); await sendNotificationEmail({ tenantId: (await db.user.findUniqueOrThrow({ where: { id: user.id }, select: { tenantId: true } })).tenantId, userId: user.id, recipient: parsed.data, type: "PASSWORD_RESET", subject: "Reset your BeyondBeams GRC password", eyebrow: "Account recovery", heading: "Reset your password", paragraphs: ["A password reset was requested for your account.", "This single-use link expires in 30 minutes. If you did not request it, no action is required."], cta: { label: "Reset password", url }, relatedEntityType: "User", relatedEntityId: user.id }); }
  return { success: true, message: "If an account exists, a password reset link has been sent." };
}

export async function resetPassword(input: { email: string; token: string; password: string }) {
  const parsed = z.object({ email: emailSchema, token: z.string().min(20), password }).safeParse(input); if (!parsed.success) return { error: "Invalid reset request." };
  const identifier = `reset:${parsed.data.email}`; const stored = await db.verificationToken.findUnique({ where: { identifier_token: { identifier, token: hashToken(parsed.data.token) } } });
  if (!stored || stored.expires <= new Date()) return { error: "This reset link is invalid or has expired." };
  const passwordHash = await hash(parsed.data.password, 12);
  const result = await db.$transaction(async (tx) => { const updated = await tx.user.updateMany({ where: { email: parsed.data.email }, data: { passwordHash, sessionVersion: { increment: 1 } } }); if (updated.count !== 1) throw new Error("Account not found."); await tx.verificationToken.delete({ where: { identifier_token: { identifier, token: hashToken(parsed.data.token) } } }); return updated; });
  return result.count === 1 ? { success: true } : { error: "Password reset failed." };
}

export async function beginMfaSetup() {
  const session = await requireSession(); if (!["OWNER", "RISK_MANAGER"].includes(session.user.role)) return { error: "MFA is required only for Owners and Risk Managers." };
  const secret = createTotpSecret(); await db.user.update({ where: { id: session.user.id }, data: { mfaSecret: encryptSecret(secret), mfaEnabled: false, mfaConfirmedAt: null } });
  return { success: true, uri: totpUri(secret, session.user.email ?? "user") };
}

export async function confirmMfa(code: string) {
  const session = await requireSession(); const user = await db.user.findUniqueOrThrow({ where: { id: session.user.id }, select: { mfaSecret: true } });
  if (!user.mfaSecret || !verifyTotpCode((await import("@/lib/security")).decryptSecret(user.mfaSecret), code)) return { error: "The verification code is invalid." };
  await db.user.update({ where: { id: session.user.id }, data: { mfaEnabled: true, mfaConfirmedAt: new Date(), sessionVersion: { increment: 1 } } }); return { success: true };
}

export async function disableMfa() {
  const session = await requireSession(); await db.user.update({ where: { id: session.user.id }, data: { mfaEnabled: false, mfaSecret: null, mfaConfirmedAt: null, sessionVersion: { increment: 1 } } }); return { success: true };
}

const acceptanceSchema = z.object({ token: z.string().min(20), name: z.string().trim().min(2).max(80), password });
export async function acceptInvitation(input: z.input<typeof acceptanceSchema>) {
  const parsed = acceptanceSchema.safeParse(input); if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check your details." };
  const tokenHash = hashToken(parsed.data.token); const invitation = await db.membership.findUnique({ where: { inviteToken: tokenHash }, include: { tenant: true } });
  if (!invitation?.inviteEmail || invitation.userId || !invitation.inviteExpires || invitation.inviteExpires <= new Date()) return { error: "This invitation is invalid or has expired." };
  const existing = await db.user.findUnique({ where: { email: invitation.inviteEmail } }); if (existing && existing.tenantId !== invitation.tenantId) return { error: "This email already belongs to another workspace. Contact your administrator." };
  const passwordHash = await hash(parsed.data.password, 12);
  try { const user = await db.$transaction(async (tx) => { const account = existing ?? await tx.user.create({ data: { name: parsed.data.name, email: invitation.inviteEmail!, passwordHash, tenantId: invitation.tenantId, emailVerified: new Date() } }); if (existing) await tx.user.update({ where: { id: existing.id }, data: { name: parsed.data.name, passwordHash, emailVerified: existing.emailVerified ?? new Date() } }); const activated = await tx.membership.updateMany({ where: { id: invitation.id, userId: null, inviteToken: tokenHash, inviteExpires: { gt: new Date() } }, data: { userId: account.id, acceptedAt: new Date(), inviteEmail: null, inviteToken: null, inviteExpires: null } }); if (activated.count !== 1) throw new Error("Invitation already used"); await tx.auditEvent.create({ data: { tenantId: invitation.tenantId, actorId: account.id, action: "CREATE", entityType: "Membership", entityId: invitation.id, summary: `Joined workspace as ${invitation.role}` } }); return account; }); return { success: true, email: user.email }; } catch { return { error: "This invitation could not be accepted. Request a new invitation." }; }
}