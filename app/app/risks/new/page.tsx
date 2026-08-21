import { db } from "@/lib/db";
import { requireRole, writeRoles } from "@/lib/authz";
import { PageHeader } from "@/components/page-header";
import { RiskForm } from "@/components/risk-form";
import { ensureComplianceCatalog } from "@/lib/compliance";

export default async function NewRiskPage() {
  const session = await requireRole(writeRoles);
  await ensureComplianceCatalog(session.user.tenantId);
  const [users, references] = await Promise.all([
    db.user.findMany({ where: { tenantId: session.user.tenantId }, select: { id: true, name: true } }),
    db.complianceReference.findMany({ where: { tenantId: session.user.tenantId }, orderBy: { framework: "asc" } }),
  ]);
  return <><PageHeader eyebrow="Risk register" title="Add a new risk" description="Describe the uncertain event, assess its initial exposure, and review worldwide obligations in context."/><RiskForm users={users} references={references}/></>;
}