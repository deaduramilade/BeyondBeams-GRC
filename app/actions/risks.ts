import type { Prisma } from "@prisma/client";
"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireRole, writeRoles, deleteRoles } from "@/lib/authz";
import { riskSchema, type RiskInput } from "@/lib/validations";
import { linkComplianceToRisk } from "@/lib/compliance";
import { notifyHighResidualRisk, notifyTreatmentChange } from "@/lib/lifecycle-notifications";
import { nextRiskReference } from "@/lib/risk-reference";
import { appendAuditEvent } from "@/lib/audit";

export async function createRisk(input: RiskInput): Promise<{ error: string } | { success: true; id: string }> {
  const session = await requireRole(writeRoles); const parsed = riskSchema.safeParse(input); if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid risk" };
  const data = parsed.data;
  try {
    const risk = await db.$transaction(async (tx: Prisma.TransactionClient) => {
      const owner = await tx.user.findFirst({ where: { id: data.ownerId, tenantId: session.user.tenantId } });
      if (!owner) throw new Error("Risk owner is not a member of this workspace.");
      const reference = await nextRiskReference(tx, session.user.tenantId);
      const created = await tx.risk.create({ data: { ...data, tenantId: session.user.tenantId, reference, inherentScore: data.inherentLikelihood * data.inherentImpact, residualScore: data.residualLikelihood && data.residualImpact ? data.residualLikelihood * data.residualImpact : null } });
      await appendAuditEvent(tx, { tenantId: session.user.tenantId, actorId: session.user.id, action: "CREATE", riskId: created.id, entityType: "Risk", entityId: created.id, summary: `Created ${reference}` });
      return created;
    });
    await linkComplianceToRisk(risk); await notifyHighResidualRisk(risk); revalidatePath("/app"); return { success: true, id: risk.id };
  } catch (error) { return { error: error instanceof Error ? error.message : "Risk creation failed." }; }
}
export async function updateRisk(id: string, input: RiskInput, expectedVersion: number) {
  const session = await requireRole(writeRoles); const parsed = riskSchema.safeParse(input); if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid risk" }; const data = parsed.data;
  const [existing, owner] = await Promise.all([db.risk.findFirst({ where: { id, tenantId: session.user.tenantId, deletedAt: null } }), db.user.findFirst({ where: { id: data.ownerId, tenantId: session.user.tenantId } })]); if (!existing) return { error: "Risk not found" }; if (!owner) return { error: "Risk owner is not a member of this workspace." };
  const risk = await db.$transaction(async (tx: Prisma.TransactionClient) => { const updated = await tx.risk.updateMany({ where: { id, tenantId: session.user.tenantId, deletedAt: null, version: expectedVersion }, data: { ...data, version: { increment: 1 }, inherentScore: data.inherentLikelihood * data.inherentImpact, residualScore: data.residualLikelihood && data.residualImpact ? data.residualLikelihood * data.residualImpact : null } }); if (updated.count !== 1) return 0; await tx.auditEvent.create({ data: { tenantId: session.user.tenantId, actorId: session.user.id, action: "UPDATE", riskId: id, entityId: id, summary: `Updated ${existing.reference}`, changes: JSON.stringify({ version: expectedVersion, nextVersion: expectedVersion + 1 }) } }); return 1; });
  if (risk !== 1) return { error: "This risk changed while you were editing it. Reload and review the latest values." };
  const updated = await db.risk.findUniqueOrThrow({ where: { id } });
  await linkComplianceToRisk(updated);
  await notifyHighResidualRisk(updated, existing.residualScore); await notifyTreatmentChange(updated, existing.treatment); revalidatePath("/app"); revalidatePath(`/app/risks/${id}`); return { success: true };
}
export async function deleteRisk(id: string) {
  const session = await requireRole(deleteRoles); const existing = await db.risk.findFirst({ where: { id, tenantId: session.user.tenantId, deletedAt: null } }); if (!existing) return { error: "Risk not found" };
  await db.$transaction(async (tx: Prisma.TransactionClient) => { await tx.risk.update({ where: { id }, data: { deletedAt: new Date(), version: { increment: 1 } } }); await appendAuditEvent(tx, { tenantId: session.user.tenantId, actorId: session.user.id, action: "DELETE", riskId: id, entityType: "Risk", entityId: id, summary: `Deleted ${existing.reference}` }); }); revalidatePath("/app"); return { success: true };
}