import type { PrismaClient } from "@prisma/client";
import { headers } from "next/headers";

export type AuditWriter = Pick<PrismaClient, "$transaction">;

type AuditTransaction = { auditEvent: { create(args: unknown): Promise<unknown> } };
export async function appendAuditEvent(tx: AuditTransaction, data: {
  tenantId: string; actorId: string; action: "CREATE" | "UPDATE" | "DELETE";
  entityType: string; entityId: string; summary: string; riskId?: string; changes?: unknown;
  requestId?: string; source?: string; ipAddress?: string; userAgent?: string;
  beforeJson?: string; afterJson?: string; reason?: string;
}) {
  const requestHeaders = await headers();
  const { changes, requestId, source, ipAddress, userAgent, beforeJson, afterJson, reason, ...event } = data;
  return tx.auditEvent.create({ data: {
    ...event,
    requestId: requestId ?? requestHeaders.get("x-request-id") ?? undefined,
    source: source ?? requestHeaders.get("x-audit-source") ?? "server-action",
    ipAddress: ipAddress ?? requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ?? undefined,
    userAgent: userAgent ?? requestHeaders.get("user-agent") ?? undefined,
    beforeJson, afterJson, reason,
    changes: changes === undefined ? undefined : JSON.stringify(changes),
  } });
}

export function auditMutationDenied() {
  throw new Error("Audit events are append-only and cannot be modified or deleted.");
}