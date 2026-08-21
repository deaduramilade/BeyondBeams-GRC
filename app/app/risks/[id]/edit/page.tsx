import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireRole, writeRoles } from "@/lib/authz";
import { PageHeader } from "@/components/page-header";
import { RiskForm } from "@/components/risk-form";
import { ensureComplianceCatalog } from "@/lib/compliance";

export default async function EditRiskPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireRole(writeRoles);
  const { id } = await params;
  await ensureComplianceCatalog(session.user.tenantId);
  const [risk, users, references] = await Promise.all([
    db.risk.findFirst({ where: { id, tenantId: session.user.tenantId, deletedAt: null } }),
    db.user.findMany({ where: { tenantId: session.user.tenantId }, select: { id: true, name: true } }),
    db.complianceReference.findMany({ where: { tenantId: session.user.tenantId }, orderBy: { framework: "asc" } }),
  ]);
  if (!risk) notFound();
  return <><PageHeader eyebrow={risk.reference} title="Edit risk" description="Update the assessment and review the obligations triggered by its scope."/><RiskForm users={users} references={references} risk={{ ...risk, nextReviewDate: risk.nextReviewDate.toISOString().slice(0, 10) }}/></>;
}