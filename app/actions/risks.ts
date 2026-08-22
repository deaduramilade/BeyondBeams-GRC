"use server";
import { AuditAction } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireRole, writeRoles, deleteRoles } from "@/lib/authz";
import { riskSchema, type RiskInput } from "@/lib/validations";
import { linkComplianceToRisk } from "@/lib/compliance";
import { notifyHighResidualRisk, notifyTreatmentChange } from "@/lib/lifecycle-notifications";

function audit(tenantId: string, actorId: string, action: AuditAction, riskId: string, summary: string, changes?: string) { return db.auditEvent.create({ data: { tenantId, actorId, riskId, action, entityId: riskId, summary, changes } }); }
export async function createRisk(input: RiskInput): Promise<{ error: string } | { success: true; id: string }> {
  const session = await requireRole(writeRoles); const parsed = riskSchema.safeParse(input); if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid risk" };
  const data = parsed.data; const owner = await db.user.findFirst({ where: { id: data.ownerId, tenantId: session.user.tenantId } }); if (!owner) return { error: "Risk owner is not a member of this workspace." }; const count = await db.risk.count({ where: { tenantId: session.user.tenantId } }); const reference = `RSK-${String(count + 1).padStart(4, "0")}`;
  const risk = await db.risk.create({ data: { ...data, tenantId: session.user.tenantId, reference, inherentScore: data.inherentLikelihood * data.inherentImpact, residualScore: data.residualLikelihood && data.residualImpact ? data.residualLikelihood * data.residualImpact : null } });
  await linkComplianceToRisk(risk);
  await audit(session.user.tenantId, session.user.id, "CREATE", risk.id, `Created ${reference}`); await notifyHighResidualRisk(risk); revalidatePath("/app"); return { success: true, id: risk.id };
}
export async function updateRisk(id: string, input: RiskInput) {
  const session = await requireRole(writeRoles); const parsed = riskSchema.safeParse(input); if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid risk" }; const data = parsed.data;
  const [existing, owner] = await Promise.all([db.risk.findFirst({ where: { id, tenantId: session.user.tenantId, deletedAt: null } }), db.user.findFirst({ where: { id: data.ownerId, tenantId: session.user.tenantId } })]); if (!existing) return { error: "Risk not found" }; if (!owner) return { error: "Risk owner is not a member of this workspace." };
  const risk = await db.risk.update({ where: { id }, data: { ...data, inherentScore: data.inherentLikelihood * data.inherentImpact, residualScore: data.residualLikelihood && data.residualImpact ? data.residualLikelihood * data.residualImpact : null } });
  await linkComplianceToRisk(risk);
  await audit(session.user.tenantId, session.user.id, "UPDATE", id, `Updated ${existing.reference}`); await notifyHighResidualRisk(risk, existing.residualScore); await notifyTreatmentChange(risk, existing.treatment); revalidatePath("/app"); revalidatePath(`/app/risks/${id}`); return { success: true };
}
export async function deleteRisk(id: string) {
  const session = await requireRole(deleteRoles); const existing = await db.risk.findFirst({ where: { id, tenantId: session.user.tenantId, deletedAt: null } }); if (!existing) return { error: "Risk not found" };
  await db.risk.update({ where: { id }, data: { deletedAt: new Date() } }); await audit(session.user.tenantId, session.user.id, "DELETE", id, `Deleted ${existing.reference}`); revalidatePath("/app"); return { success: true };
}