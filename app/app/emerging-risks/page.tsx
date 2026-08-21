import { db } from "@/lib/db";
import { requireRole, writeRoles } from "@/lib/authz";
import { PageHeader } from "@/components/page-header";
import { EmergingRiskWorkspace } from "@/components/emerging-risk-workspace";

export default async function EmergingRisksPage() {
  const session = await requireRole(writeRoles);
  const [users, items] = await Promise.all([
    db.user.findMany({ where: { tenantId: session.user.tenantId }, select: { id: true, name: true } }),
    db.emergingRisk.findMany({ where: { tenantId: session.user.tenantId }, orderBy: { createdAt: "desc" } }),
  ]);
  return <><PageHeader eyebrow="Horizon scanning" title="Emerging risk detection & settlement" description="Monitor weak signals, define early-warning indicators, and formally settle or promote each hypothesis with a complete audit trail."/><EmergingRiskWorkspace users={users} items={items}/></>;
}