import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { authConfig } from "@/auth.config";

const credentialsSchema = z.object({ email: z.string().email(), password: z.string().min(8) });

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  session: { strategy: "jwt" },
  providers: [Credentials({
    credentials: { email: { label: "Email", type: "email" }, password: { label: "Password", type: "password" } },
    authorize: async (raw) => {
      const parsed = credentialsSchema.safeParse(raw);
      if (!parsed.success) return null;
      const user = await db.user.findUnique({ where: { email: parsed.data.email.toLowerCase() }, include: { tenant: true, memberships: true } });
      if (!user || !(await compare(parsed.data.password, user.passwordHash))) return null;
      const membership = user.memberships.find((item) => item.tenantId === user.tenantId);
      if (!membership) return null;
      return { id: user.id, email: user.email, name: user.name, tenantId: user.tenantId, tenantName: user.tenant.name, role: membership.role };
    },
  })],
  callbacks: {
    jwt({ token, user }) { if (user) { token.userId = user.id!; token.tenantId = user.tenantId; token.tenantName = user.tenantName; token.role = user.role; } return token; },
    session({ session, token }) { session.user.id = token.userId; session.user.tenantId = token.tenantId; session.user.tenantName = token.tenantName; session.user.role = token.role; return session; },
  },
});