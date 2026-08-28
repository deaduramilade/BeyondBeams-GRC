import { PageHeader } from "@/components/page-header";
import { EvidenceForm } from "@/components/lifecycle-forms";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { requireSession } from "@/lib/authz";
import { db } from "@/lib/db";
import { formatDate, formatEnum } from "@/lib/utils";
import { uiCapabilities } from "@/lib/ui-capabilities";

export default async function EvidencePage() {
  const session = await requireSession(); const tenantId = session.user.tenantId;
  const [risks, plans, actions, controls, evidence] = await Promise.all([
    db.risk.findMany({ where: { tenantId, deletedAt: null }, select: { id: true, reference: true, title: true } }),
    db.treatmentPlan.findMany({ where: { tenantId }, include: { risk: { select: { reference: true } } } }),
    db.treatmentAction.findMany({ where: { tenantId }, include: { treatmentPlan: { include: { risk: { select: { reference: true } } } } } }),
    db.controlProfile.findMany({ where: { tenantId }, include: { frameworkControl: true } }),
    db.evidence.findMany({ where: { tenantId }, include: { uploadedBy: { select: { name: true } }, risk: { select: { reference: true } }, treatmentPlan: { select: { id: true } }, treatmentAction: { select: { title: true } }, controlProfile: { include: { frameworkControl: true } } }, orderBy: { createdAt: "desc" }, take: 200 }),
  ]);
  const capabilities = uiCapabilities(session.user.role);
  return <><PageHeader eyebrow="Assurance evidence" title="Evidence metadata register" description="Register evidence relationships and governance metadata now. This local path does not claim private production storage, malware scanning, or signed delivery."/><div className="grid gap-5 xl:grid-cols-[380px_1fr]"><Card><CardHeader><h2 className="text-sm font-bold">Register metadata</h2></CardHeader><CardContent><EvidenceForm allowed={capabilities["evidence:manage"]} risks={risks.map((risk) => ({ value: risk.id, label: `${risk.reference} · ${risk.title}` }))} plans={plans.map((plan) => ({ value: plan.id, label: `${plan.risk.reference} · ${plan.summary}` }))} actions={actions.map((action) => ({ value: action.id, label: `${action.treatmentPlan.risk.reference} · ${action.title}` }))} controls={controls.map((control) => ({ value: control.id, label: `${control.frameworkControl.controlId} · ${control.frameworkControl.title}` }))}/></CardContent></Card><Card><CardHeader><h2 className="text-sm font-bold">Workspace register</h2></CardHeader><CardContent className="p-0"><div className="divide-y">{evidence.map((item) => <div key={item.id} className="grid gap-2 p-4 text-xs md:grid-cols-[1fr_auto]"><div><p className="font-semibold">{item.title}</p><p className="mt-1 text-muted-foreground">{item.fileName ?? "Metadata only"} · added by {item.uploadedBy.name}</p><p className="mt-1 text-muted-foreground">Linked to {item.risk?.reference ?? item.treatmentAction?.title ?? item.controlProfile?.frameworkControl.controlId ?? "treatment plan"}</p></div><div className="text-right"><Badge>{formatEnum(item.status)}</Badge>{item.retentionUntil && <p className="mt-1 text-muted-foreground">Retain to {formatDate(item.retentionUntil)}</p>}</div></div>)}{!evidence.length && <p className="p-8 text-center text-sm text-muted-foreground">No evidence metadata registered.</p>}</div></CardContent></Card></div></>;
}