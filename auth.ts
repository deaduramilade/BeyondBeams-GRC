import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { authConfig } from "@/auth.config";
import { hashToken } from "@/lib/tokens";
import { enforceRateLimit } from "@/lib/rate-limit";

const credentialsSchema = z.object({ email: z.string().email(), password: z.string().min(8) });
const magicSchema = z.object({ email: z.string().email(), token: z.string().min(20) });

async function authUser(email: string, mfaCode?: string) {
  const user = await db.user.findUnique({ where: { email: email.toLowerCase() }, include: { tenant: true, memberships: true } });
  if (!user) return null;
  const membership = user.memberships.find((item) => item.tenantId === user.tenantId && (item.acceptedAt || item.userId && !item.inviteToken));
  if (!membership) return null;
  if ((membership.role === "OWNER" || membership.role === "RISK_MANAGER") && user.mfaEnabled) {
    const { decryptSecret, verifyTotpCode } = await import("@/lib/security");
    if (!mfaCode || !user.mfaSecret || !verifyTotpCode(decryptSecret(user.mfaSecret), mfaCode)) return null;
  }
  return { id: user.id, email: user.email, name: user.name, tenantId: user.tenantId, tenantName: user.tenant.name, role: membership.role, sessionVersion: user.sessionVersion };
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  session: { strategy: "jwt" },
  providers: [Credentials({
    credentials: { email: { label: "Email", type: "email" }, password: { label: "Password", type: "password" }, mfaCode: { label: "MFA code", type: "text" } },
    authorize: async (raw) => {
      const limit = await enforceRateLimit("login", `${String(raw?.email ?? "unknown")}:${"credentials"}`); if (!limit.allowed) return null;
      const parsed = credentialsSchema.safeParse(raw);
      if (!parsed.success) return null;
      const user = await db.user.findUnique({ where: { email: parsed.data.email.toLowerCase() } });
      if (!user || !(await compare(parsed.data.password, user.passwordHash))) return null;
      return authUser(user.email, String(raw?.mfaCode ?? ""));
    },
  }), Credentials({
    id: "magic-link", name: "Magic link", credentials: { email: { type: "email" }, token: { type: "text" } },
    authorize: async (raw) => {
      const limit = await enforceRateLimit("magicLink", String(raw?.email ?? "unknown")); if (!limit.allowed) return null;
      const parsed = magicSchema.safeParse(raw); if (!parsed.success) return null;
      const identifier = `magic:${parsed.data.email.toLowerCase()}`; const token = hashToken(parsed.data.token);
      const stored = await db.verificationToken.findUnique({ where: { identifier_token: { identifier, token } } }); if (!stored || stored.expires <= new Date()) return null;
      const user = await authUser(parsed.data.email); if (!user) return null;
      await db.verificationToken.delete({ where: { identifier_token: { identifier, token } } }); return user;
    },
  })],
  callbacks: {
    async jwt({ token, user }) { if (user) { token.userId = user.id!; token.tenantId = user.tenantId; token.tenantName = user.tenantName; token.role = user.role; token.sessionVersion = user.sessionVersion; } if (token.userId) { const current = await db.user.findUnique({ where: { id: token.userId }, select: { sessionVersion: true } }); if (!current || current.sessionVersion !== token.sessionVersion) return {}; } return token; },
    session({ session, token }) { session.user.id = token.userId; session.user.tenantId = token.tenantId; session.user.tenantName = token.tenantName; session.user.role = token.role; return session; },
  },
});