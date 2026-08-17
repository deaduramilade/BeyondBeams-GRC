import type { NextAuthConfig } from "next-auth";

export const authConfig = {
  providers: [],
  pages: { signIn: "/login" },
  callbacks: {
    authorized({ auth: session, request }) {
      const path = request.nextUrl.pathname;
      if (!path.startsWith("/app")) return true;
      if (!session) return false;
      const mutationPage = path === "/app/risks/new" || /^\/app\/risks\/[^/]+\/edit$/.test(path);
      return mutationPage ? ["OWNER", "RISK_MANAGER", "ASSESSOR"].includes(session.user.role) : true;
    },
  },
} satisfies NextAuthConfig;