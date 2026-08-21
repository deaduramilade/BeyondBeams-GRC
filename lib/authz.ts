import { Role } from "@prisma/client";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";

export const writeRoles: Role[] = [Role.OWNER, Role.RISK_MANAGER, Role.ASSESSOR];
export const deleteRoles: Role[] = [Role.OWNER, Role.RISK_MANAGER];

export async function activeSession() {
  const session = await auth();
  if (!session?.user) return null;
  const membership = await db.membership.findFirst({
    where: { userId: session.user.id, tenantId: session.user.tenantId, OR: [{ acceptedAt: { not: null } }, { inviteToken: null }] },
    include: { tenant: { select: { name: true } } },
  });
  if (!membership) return null;
  session.user.role = membership.role;
  session.user.tenantName = membership.tenant.name;
  return session;
}
export async function requireSession() { const session = await activeSession(); if (!session) redirect("/login?error=access"); return session; }
export async function requireRole(roles: Role[]) { const session = await requireSession(); if (!roles.includes(session.user.role)) throw new Error("You do not have permission to perform this action."); return session; }