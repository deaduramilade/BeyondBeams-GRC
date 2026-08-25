import { Role } from "@prisma/client";
import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session { user: { id: string; tenantId: string; tenantName: string; role: Role; name?: string | null; email?: string | null; image?: string | null } }
  interface User { tenantId: string; tenantName: string; role: Role; sessionVersion: number }
}
declare module "next-auth/jwt" { interface JWT { userId: string; tenantId: string; tenantName: string; role: Role; sessionVersion: number } }