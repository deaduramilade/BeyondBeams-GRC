import { db } from "@/lib/db";
import { requireRole, writeRoles } from "@/lib/authz";
import { PageHeader } from "@/components/page-header";
import { RiskForm } from "@/components/risk-form";
import { ensureComplianceCatalog } from "@/lib/compliance";
import { enabledControls, ensureTenantFrameworks } from "@/lib/frameworks";

export default async function NewRiskPage() {
  const session = await requireRole(writeRoles);
  await ensureComplianceCatalog(session.user.tenantId);
  await ensureTenantFrameworks(session.user.tenantId);
  const [users, references, controls] = await Promise.all([
    db.user.findMany({ where: { tenantId: session.user.tenantId }, select: { id: true, name: true } }),
    db.complianceReference.findMany({ where: { tenantId: session.user.tenantId }, orderBy: { framework: "asc" } }),
    enabledControls(session.user.tenantId),
  ]);
  return <><PageHeader eyebrow="Risk register" title="Add a new risk" description="Describe the uncertain event, assess its initial exposure, and review worldwide obligations in context."/><RiskForm users={users} references={references} controls={controls}/></>;
}