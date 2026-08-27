import { db } from "@/lib/db";
import { requireSession, writeRoles } from "@/lib/authz";
import { PageHeader } from "@/components/page-header";
import { WorkflowForm } from "@/components/workflow-form";
import { moduleDefinitions } from "@/lib/modules";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";

export default async function AuditTrail() {
  const session = await requireSession();
  const events = await db.auditEvent.findMany({ where: { tenantId: session.user.tenantId }, include: { actor: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 100 });
  const definition = moduleDefinitions.audit;
  return <><PageHeader eyebrow="Audit & assurance" title="Assurance planning and audit trail" description="Plan independent assurance work and review the tenant-scoped history of material system activity."/><div className="space-y-5">
    {writeRoles.includes(session.user.role) && <WorkflowForm module="audit" definition={{ titleLabel: definition.titleLabel, detailsLabel: definition.detailsLabel, outcomeLabel: definition.outcomeLabel, defaultOutcome: definition.defaultOutcome }} userName={session.user.name ?? "Workspace owner"}/>} 
    <Card><CardContent className="divide-y pt-5">{events.map((event) => <div key={event.id} className="grid gap-2 py-4 sm:grid-cols-[130px_1fr_180px]"><p className="text-[10px] font-bold text-primary">{event.action} · {event.entityType}</p><div><p className="text-sm font-semibold">{event.summary}</p>{event.changes && <p className="mt-1 text-xs text-muted-foreground">{typeof event.changes === "string" ? event.changes : JSON.stringify(event.changes)}</p>}</div><p className="text-xs text-muted-foreground sm:text-right">{event.actor.name}<br/>{formatDate(event.createdAt)}</p></div>)}</CardContent></Card>
  </div></>;
}