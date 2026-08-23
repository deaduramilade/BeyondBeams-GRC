import { notFound } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireRole, writeRoles } from "@/lib/authz";
import { PageHeader } from "@/components/page-header";
import { RiskForm } from "@/components/risk-form";
import { ensureComplianceCatalog } from "@/lib/compliance";
import { enabledControls, ensureTenantFrameworks } from "@/lib/frameworks";

export default async function EditRiskPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireRole(writeRoles);
  const { id } = await params;
  await ensureComplianceCatalog(session.user.tenantId);
  await ensureTenantFrameworks(session.user.tenantId);
  const [risk, users, references, controls] = await Promise.all([
    db.risk.findFirst({ where: { id, tenantId: session.user.tenantId, deletedAt: null }, include: { frameworkMappings: { select: { frameworkControlId: true } } } }),
    db.user.findMany({ where: { tenantId: session.user.tenantId }, select: { id: true, name: true } }),
    db.complianceReference.findMany({ where: { tenantId: session.user.tenantId }, orderBy: { framework: "asc" } }),
    enabledControls(session.user.tenantId),
  ]);
  if (!risk) notFound();
  return <><PageHeader eyebrow={risk.reference} title="Edit risk" description="Update the assessment and review the obligations triggered by its scope."/><RiskForm users={users} references={references} controls={controls} mappedControlIds={risk.frameworkMappings.map((mapping: Prisma.RiskFrameworkMappingGetPayload<{ select: { frameworkControlId: true } }>) => mapping.frameworkControlId)} risk={{ ...risk, nextReviewDate: risk.nextReviewDate.toISOString().slice(0, 10) }}/></>;
}