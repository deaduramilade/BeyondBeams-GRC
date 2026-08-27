import type { PrismaClient } from "@prisma/client";

export type TenantDatabase = Pick<PrismaClient, "risk" | "membership" | "exportHistory" | "notification" | "auditEvent">;

export function tenantRiskWhere(tenantId: string, id?: string) {
  return { tenantId, deletedAt: null, ...(id ? { id } : {}) } as const;
}

export async function tenantResources(db: TenantDatabase, tenantId: string) {
  return Promise.all([
    db.risk.findMany({ where: tenantRiskWhere(tenantId) }),
    db.membership.findMany({ where: { tenantId } }),
    db.exportHistory.findMany({ where: { tenantId } }),
    db.notification.findMany({ where: { tenantId } }),
    db.auditEvent.findMany({ where: { tenantId } }),
  ]);
}

export function updateTenantRisk(db: TenantDatabase, tenantId: string, id: string, title: string) {
  return db.risk.updateMany({ where: tenantRiskWhere(tenantId, id), data: { title, version: { increment: 1 } } });
}

export function deleteTenantRisk(db: TenantDatabase, tenantId: string, id: string) {
  return db.risk.updateMany({ where: tenantRiskWhere(tenantId, id), data: { deletedAt: new Date(), version: { increment: 1 } } });
}

export function activeMembershipWhere(userId: string, tenantId: string) {
  return { userId, tenantId, acceptedAt: { not: null }, inviteToken: null } as const;
}