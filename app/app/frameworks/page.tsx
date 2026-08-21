import { Plan } from "@prisma/client";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/authz";
import { canManageFramework, ensureTenantFrameworks, planFrameworkLimit, planMappingLimit } from "@/lib/frameworks";
import { PageHeader } from "@/components/page-header";
import { FrameworkLibrary } from "@/components/framework-library";

export default async function FrameworksPage() {
  const session = await requireSession(); const tenantId = session.user.tenantId;
  await ensureTenantFrameworks(tenantId);
  const [tenant, frameworks, mappingCount, unmappedRisks] = await Promise.all([
    db.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { plan: true } }),
    db.framework.findMany({ include: { tenantSelections: { where: { tenantId }, select: { enabled: true } }, controls: { orderBy: { controlId: "asc" }, include: { mappings: { where: { risk: { tenantId, deletedAt: null } }, select: { risk: { select: { id: true, reference: true, title: true } } } } } } }, orderBy: { name: "asc" } }),
    db.riskFrameworkMapping.count({ where: { risk: { tenantId, deletedAt: null } } }),
    db.risk.findMany({ where: { tenantId, deletedAt: null, frameworkMappings: { none: {} } }, select: { id: true, reference: true, title: true }, orderBy: { residualScore: "desc" } }),
  ]);
  const items = frameworks.map((framework) => ({ ...framework, enabled: framework.tenantSelections[0]?.enabled ?? false }));
  const mappingLimit = planMappingLimit[tenant.plan];
  return <><PageHeader eyebrow="Frameworks & compliance" title="Control coverage, in one view" description="Enable the standards your organisation follows, browse their requirements, and trace each control to the risks it helps govern."/><FrameworkLibrary frameworks={items} canManage={canManageFramework(session.user.role)} plan={tenant.plan} frameworkLimit={planFrameworkLimit[tenant.plan]} enabledCount={items.filter((item) => item.enabled).length} mappingCount={mappingCount} mappingLimit={Number.isFinite(mappingLimit) ? mappingLimit : null} unmappedRisks={unmappedRisks}/></>;
}