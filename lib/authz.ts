import { Role } from "@prisma/client";
import { redirect } from "next/navigation";
import { auth } from "@/auth";

export const writeRoles: Role[] = [Role.OWNER, Role.RISK_MANAGER, Role.ASSESSOR];
export const deleteRoles: Role[] = [Role.OWNER, Role.RISK_MANAGER];

export async function requireSession() { const session = await auth(); if (!session?.user) redirect("/login"); return session; }
export async function requireRole(roles: Role[]) { const session = await requireSession(); if (!roles.includes(session.user.role)) throw new Error("You do not have permission to perform this action."); return session; }