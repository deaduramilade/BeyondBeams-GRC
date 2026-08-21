import type { NextAuthConfig } from "next-auth";

export const authConfig = {
  providers: [],
  pages: { signIn: "/login" },
  callbacks: {
    authorized({ auth: session, request }) {
      const path = request.nextUrl.pathname;
      if (!path.startsWith("/app")) return true;
      if (!session) return false;
      // Mutation authorization is enforced by the server actions and API routes,
      // where the complete tenant-scoped session is available.
      return true;
    },
  },
} satisfies NextAuthConfig;