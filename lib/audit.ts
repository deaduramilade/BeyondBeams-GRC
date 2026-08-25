import type { PrismaClient } from "@prisma/client";

export type AuditWriter = Pick<PrismaClient, "$transaction">;

type AuditTransaction = { auditEvent: { create(args: unknown): Promise<unknown> } };
export async function appendAuditEvent(tx: AuditTransaction, data: {
  tenantId: string; actorId: string; action: "CREATE" | "UPDATE" | "DELETE";
  entityType: string; entityId: string; summary: string; riskId?: string; changes?: unknown;
}) {
  return tx.auditEvent.create({ data: { ...data, changes: data.changes === undefined ? undefined : JSON.stringify(data.changes) } });
}

export function auditMutationDenied() {
  throw new Error("Audit events are append-only and cannot be modified or deleted.");
}