"use server";

import { Role } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireRole, writeRoles } from "@/lib/authz";
import { canManageFramework, planFrameworkLimit, planMappingLimit } from "@/lib/frameworks";

const id = z.string().cuid();

export async function setFrameworkEnabled(frameworkId: string, enabled: boolean) {
  const session = await requireRole([Role.OWNER, Role.RISK_MANAGER]);
  const parsed = id.safeParse(frameworkId); if (!parsed.success) return { error: "Invalid framework." };
  const [tenant, framework, selection] = await Promise.all([
    db.tenant.findUnique({ where: { id: session.user.tenantId }, select: { plan: true } }),
    db.framework.findUnique({ where: { id: parsed.data }, select: { id: true, name: true } }),
    db.tenantFramework.findUnique({ where: { tenantId_frameworkId: { tenantId: session.user.tenantId, frameworkId: parsed.data } } }),
  ]);
  if (!tenant || !framework) return { error: "Framework not found." };
  if (enabled && !selection?.enabled) {
    const count = await db.tenantFramework.count({ where: { tenantId: session.user.tenantId, enabled: true } });
    if (count >= planFrameworkLimit[tenant.plan]) return { error: `${tenant.plan} supports ${planFrameworkLimit[tenant.plan]} enabled framework${planFrameworkLimit[tenant.plan] === 1 ? "" : "s"}. Upgrade to enable ${framework.name}.`, limitReached: true };
  }
  await db.$transaction([
    db.tenantFramework.upsert({ where: { tenantId_frameworkId: { tenantId: session.user.tenantId, frameworkId: parsed.data } }, update: { enabled, enabledAt: enabled ? new Date() : selection?.enabledAt }, create: { tenantId: session.user.tenantId, frameworkId: parsed.data, enabled } }),
    db.auditEvent.create({ data: { tenantId: session.user.tenantId, actorId: session.user.id, action: "UPDATE", entityType: "Framework", entityId: parsed.data, summary: `${enabled ? "Enabled" : "Disabled"} ${framework.name}` } }),
  ]);
  revalidatePath("/app/frameworks"); return { success: true };
}

export async function addRiskControlMapping(riskId: string, controlId: string, notes?: string) {
  const session = await requireRole(writeRoles);
  const parsed = z.object({ riskId: id, controlId: id, notes: z.string().trim().max(500).optional() }).safeParse({ riskId, controlId, notes });
  if (!parsed.success) return { error: "Invalid control mapping." };
  const [risk, control, tenant] = await Promise.all([
    db.risk.findFirst({ where: { id: parsed.data.riskId, tenantId: session.user.tenantId, deletedAt: null }, select: { id: true, reference: true } }),
    db.frameworkControl.findFirst({ where: { id: parsed.data.controlId, framework: { tenantSelections: { some: { tenantId: session.user.tenantId, enabled: true } } } }, include: { framework: { select: { name: true } } } }),
    db.tenant.findUnique({ where: { id: session.user.tenantId }, select: { plan: true } }),
  ]);
  if (!risk || !control || !tenant) return { error: "Risk or enabled control not found." };
  const existing = await db.riskFrameworkMapping.findUnique({ where: { riskId_frameworkControlId: { riskId: risk.id, frameworkControlId: control.id } } });
  if (existing) return { success: true };
  const count = await db.riskFrameworkMapping.count({ where: { risk: { tenantId: session.user.tenantId, deletedAt: null } } });
  if (count >= planMappingLimit[tenant.plan]) return { error: `${tenant.plan} has reached its ${planMappingLimit[tenant.plan]} control mapping limit. Upgrade for unlimited mappings.`, limitReached: true };
  await db.$transaction([
    db.riskFrameworkMapping.create({ data: { riskId: risk.id, frameworkControlId: control.id, mappedBy: session.user.id, notes: parsed.data.notes || null } }),
    db.auditEvent.create({ data: { tenantId: session.user.tenantId, riskId: risk.id, actorId: session.user.id, action: "UPDATE", entityType: "RiskFrameworkMapping", entityId: risk.id, summary: `Mapped ${control.framework.name} ${control.controlId} to ${risk.reference}` } }),
  ]);
  revalidatePath(`/app/risks/${risk.id}`); revalidatePath("/app/frameworks"); return { success: true };
}

export async function removeRiskControlMapping(mappingId: string) {
  const session = await requireRole(writeRoles); const parsed = id.safeParse(mappingId); if (!parsed.success) return { error: "Invalid mapping." };
  const mapping = await db.riskFrameworkMapping.findFirst({ where: { id: parsed.data, risk: { tenantId: session.user.tenantId, deletedAt: null } }, include: { risk: { select: { id: true, reference: true } }, frameworkControl: { include: { framework: { select: { name: true } } } } } });
  if (!mapping) return { error: "Mapping not found." };
  await db.$transaction([
    db.riskFrameworkMapping.delete({ where: { id: mapping.id } }),
    db.auditEvent.create({ data: { tenantId: session.user.tenantId, riskId: mapping.risk.id, actorId: session.user.id, action: "UPDATE", entityType: "RiskFrameworkMapping", entityId: mapping.risk.id, summary: `Removed ${mapping.frameworkControl.framework.name} ${mapping.frameworkControl.controlId} from ${mapping.risk.reference}` } }),
  ]);
  revalidatePath(`/app/risks/${mapping.risk.id}`); revalidatePath("/app/frameworks"); return { success: true };
}

export async function syncRiskControlMappings(riskId: string, requestedControlIds: string[]) {
  const session = await requireRole(writeRoles);
  const parsed = z.object({ riskId: id, controlIds: z.array(id).max(100) }).safeParse({ riskId, controlIds: [...new Set(requestedControlIds)] });
  if (!parsed.success) return { error: "Invalid control selection." };
  const [risk, tenant, controls, current] = await Promise.all([
    db.risk.findFirst({ where: { id: parsed.data.riskId, tenantId: session.user.tenantId, deletedAt: null }, select: { id: true, reference: true } }),
    db.tenant.findUnique({ where: { id: session.user.tenantId }, select: { plan: true } }),
    db.frameworkControl.findMany({ where: { id: { in: parsed.data.controlIds }, framework: { tenantSelections: { some: { tenantId: session.user.tenantId, enabled: true } } } }, select: { id: true } }),
    db.riskFrameworkMapping.findMany({ where: { riskId: parsed.data.riskId }, select: { id: true, frameworkControlId: true } }),
  ]);
  if (!risk || !tenant) return { error: "Risk not found." };
  if (controls.length !== parsed.data.controlIds.length) return { error: "One or more controls are unavailable for this workspace." };
  const allowed = new Set(controls.map((control) => control.id));
  const existing = new Set(current.map((mapping) => mapping.frameworkControlId));
  const add = [...allowed].filter((controlId) => !existing.has(controlId));
  const remove = current.filter((mapping) => !allowed.has(mapping.frameworkControlId));
  const tenantMappingCount = await db.riskFrameworkMapping.count({ where: { risk: { tenantId: session.user.tenantId, deletedAt: null } } });
  if (tenantMappingCount - remove.length + add.length > planMappingLimit[tenant.plan]) return { error: `${tenant.plan} has reached its ${planMappingLimit[tenant.plan]} control mapping limit. Upgrade for unlimited mappings.`, limitReached: true };
  await db.$transaction([
    ...(remove.length ? [db.riskFrameworkMapping.deleteMany({ where: { id: { in: remove.map((mapping) => mapping.id) } } })] : []),
    ...add.map((frameworkControlId) => db.riskFrameworkMapping.create({ data: { riskId: risk.id, frameworkControlId, mappedBy: session.user.id } })),
    db.auditEvent.create({ data: { tenantId: session.user.tenantId, riskId: risk.id, actorId: session.user.id, action: "UPDATE", entityType: "RiskFrameworkMapping", entityId: risk.id, summary: `Updated framework mappings for ${risk.reference}`, changes: `${add.length} added, ${remove.length} removed` } }),
  ]);
  revalidatePath(`/app/risks/${risk.id}`); revalidatePath("/app/frameworks"); return { success: true };
}

export async function frameworkPermission() { const session = await requireRole(Object.values(Role)); return canManageFramework(session.user.role); }