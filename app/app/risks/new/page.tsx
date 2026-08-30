import { db } from "@/lib/db";
import { requireRole, writeRoles } from "@/lib/authz";
import { uiCapabilities } from "@/lib/ui-capabilities";
import { PageHeader } from "@/components/page-header";
import { RiskForm } from "@/components/risk-form";
import { ensureComplianceCatalog } from "@/lib/compliance";
import { enabledControls, ensureTenantFrameworks } from "@/lib/frameworks";

export default async function NewRiskPage() {
  const session = await requireRole(writeRoles);
  const capabilities = uiCapabilities(session.user.role);
  await ensureComplianceCatalog(session.user.tenantId);
  await ensureTenantFrameworks(session.user.tenantId);
  const [users, references, controls, taxonomy] = await Promise.all([
    db.user.findMany({ where: { tenantId: session.user.tenantId }, select: { id: true, name: true } }),
    db.complianceReference.findMany({ where: { tenantId: session.user.tenantId }, orderBy: { framework: "asc" } }),
    enabledControls(session.user.tenantId),
    db.taxonomyItem.findMany({ where: { tenantId: session.user.tenantId, active: true }, orderBy: [{ type: "asc" }, { sortOrder: "asc" }, { name: "asc" }] }),
  ]);
  return <><PageHeader eyebrow="Risk register" title="Add a new risk" description="Describe the uncertain event, assess its initial exposure, and record the organisational context that makes the risk meaningful."/><RiskForm users={users} references={references} controls={controls} taxonomy={taxonomy} allowed={capabilities["risk:create"]} disabledReason="Creating risks requires risk create permission."/></>;
}