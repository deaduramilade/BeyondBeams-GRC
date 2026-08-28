import { PageHeader } from "@/components/page-header";
import { ControlProfileForm, ControlTestForm } from "@/components/lifecycle-forms";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { requireSession } from "@/lib/authz";
import { db } from "@/lib/db";
import { formatDate, formatEnum } from "@/lib/utils";
import { uiCapabilities } from "@/lib/ui-capabilities";

export default async function ControlsPage() {
  const session = await requireSession(); const tenantId = session.user.tenantId;
  const [controls, profiles, evidence, users] = await Promise.all([
    db.frameworkControl.findMany({ where: { framework: { tenantSelections: { some: { tenantId, enabled: true } } } }, select: { id: true, controlId: true, title: true }, orderBy: { controlId: "asc" }, take: 200 }),
    db.controlProfile.findMany({ where: { tenantId }, include: { frameworkControl: true, owner: { select: { name: true } }, tests: { orderBy: { testDate: "desc" }, take: 5 } }, orderBy: { updatedAt: "desc" } }),
    db.evidence.findMany({ where: { tenantId }, select: { id: true, title: true }, orderBy: { title: "asc" } }),
    db.user.findMany({ where: { tenantId }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  const capabilities = uiCapabilities(session.user.role);
  const controlOptions = controls.map((control) => ({ value: control.id, label: `${control.controlId} · ${control.title}` })); const profileOptions = profiles.map((profile) => ({ value: profile.id, label: `${profile.frameworkControl.controlId} · ${profile.frameworkControl.title}` })); const userOptions = users.map((user) => ({ value: user.id, label: user.name })); const evidenceOptions = evidence.map((item) => ({ value: item.id, label: item.title }));
  return <><PageHeader eyebrow="Control assurance" title="Control profiles and test history" description="Assign accountable owners, record implementation and effectiveness, and preserve dated test results with optional evidence."/><div className="grid gap-5 xl:grid-cols-2"><Card><CardHeader><h2 className="text-sm font-bold">Control profile</h2></CardHeader><CardContent><ControlProfileForm allowed={capabilities["control:manage"]} controls={controlOptions} users={userOptions}/></CardContent></Card><Card><CardHeader><h2 className="text-sm font-bold">Record control test</h2></CardHeader><CardContent>{profiles.length ? <ControlTestForm allowed={capabilities["control:manage"]} profiles={profileOptions} evidence={evidenceOptions}/> : <p className="text-sm text-muted-foreground">Create a control profile before recording a test.</p>}</CardContent></Card></div><div className="mt-5 grid gap-3">{profiles.map((profile) => <Card key={profile.id}><CardContent className="grid gap-3 p-5 md:grid-cols-[1fr_auto]"><div><p className="text-[10px] font-bold uppercase text-primary">{profile.frameworkControl.controlId}</p><h2 className="mt-1 text-sm font-bold">{profile.frameworkControl.title}</h2><p className="mt-1 text-xs text-muted-foreground">Owner: {profile.owner?.name ?? "Unassigned"} · {formatEnum(profile.implementationStatus)} · {formatEnum(profile.effectiveness)}</p></div><div className="text-right text-xs text-muted-foreground"><Badge>{profile.tests.length} recent test(s)</Badge>{profile.lastTestedAt && <p className="mt-2">Last tested {formatDate(profile.lastTestedAt)}</p>}</div></CardContent></Card>)}</div></>;
}