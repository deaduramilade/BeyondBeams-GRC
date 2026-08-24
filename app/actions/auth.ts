"use server";

import { hash } from "bcryptjs";
import { Prisma, Role } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { appUrl, createToken, deliverLink, hashToken } from "@/lib/tokens";
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

const acceptanceSchema = z.object({ token: z.string().min(20), name: z.string().trim().min(2).max(80), password });
export async function acceptInvitation(input: z.input<typeof acceptanceSchema>) {
  const parsed = acceptanceSchema.safeParse(input); if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check your details." };
  const tokenHash = hashToken(parsed.data.token); const invitation = await db.membership.findUnique({ where: { inviteToken: tokenHash }, include: { tenant: true } });
  if (!invitation?.inviteEmail || invitation.userId || !invitation.inviteExpires || invitation.inviteExpires <= new Date()) return { error: "This invitation is invalid or has expired." };
  const existing = await db.user.findUnique({ where: { email: invitation.inviteEmail } }); if (existing && existing.tenantId !== invitation.tenantId) return { error: "This email already belongs to another workspace. Contact your administrator." };
  const passwordHash = await hash(parsed.data.password, 12);
  try { const user = await db.$transaction(async (tx) => { const account = existing ?? await tx.user.create({ data: { name: parsed.data.name, email: invitation.inviteEmail!, passwordHash, tenantId: invitation.tenantId, emailVerified: new Date() } }); if (existing) await tx.user.update({ where: { id: existing.id }, data: { name: parsed.data.name, passwordHash, emailVerified: existing.emailVerified ?? new Date() } }); const activated = await tx.membership.updateMany({ where: { id: invitation.id, userId: null, inviteToken: tokenHash, inviteExpires: { gt: new Date() } }, data: { userId: account.id, acceptedAt: new Date(), inviteEmail: null, inviteToken: null, inviteExpires: null } }); if (activated.count !== 1) throw new Error("Invitation already used"); await tx.auditEvent.create({ data: { tenantId: invitation.tenantId, actorId: account.id, action: "CREATE", entityType: "Membership", entityId: invitation.id, summary: `Joined workspace as ${invitation.role}` } }); return account; }); return { success: true, email: user.email }; } catch { return { error: "This invitation could not be accepted. Request a new invitation." }; }
}