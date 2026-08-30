import { PageHeader } from "@/components/page-header";
import { ScoringPolicyForm } from "@/components/scoring-policy-form";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { requireSession } from "@/lib/authz";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/utils";
import { uiCapabilities } from "@/lib/ui-capabilities";

export default async function ScoringPolicyPage() {
  const session = await requireSession(); const tenantId = session.user.tenantId;
  const [policies] = await Promise.all([
    db.scoringPolicy.findMany({ where: { tenantId }, include: { createdBy: { select: { name: true } } }, orderBy: { version: "desc" }, take: 50 }),
  ]);
  const capabilities = uiCapabilities(session.user.role);
  return <><PageHeader eyebrow="Governance settings" title="Scoring policy" description="Versioned score-band definitions. New policies apply prospectively; historical scores are never rewritten."/><div className="grid gap-5 xl:grid-cols-[380px_1fr]"><Card><CardHeader><h2 className="text-sm font-bold">New policy version</h2><p className="mt-1 text-xs text-muted-foreground">Bands must cover ascending non-overlapping ranges within 1-25.</p></CardHeader><CardContent><ScoringPolicyForm allowed={capabilities["settings:manage"]}/></CardContent></Card><Card><CardHeader><h2 className="text-sm font-bold">Policy history</h2></CardHeader><CardContent className="p-0"><div className="divide-y">{policies.map((policy) => <div key={policy.id} className="p-4 text-xs"><div className="flex flex-wrap items-center justify-between gap-3"><p className="font-semibold">Version {policy.version}{policy.active ? "" : " · superseded"}</p><div className="flex gap-2"><Badge className={policy.active ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600" : "border-border bg-muted text-muted-foreground"}>{policy.active ? "Active" : "Historic"}</Badge><span className="text-muted-foreground">Effective {formatDate(policy.effectiveAt)}</span></div></div><p className="mt-2 font-mono text-muted-foreground">{policy.bandsJson}</p><p className="mt-2 text-muted-foreground">Created by {policy.createdBy.name}</p></div>)}{!policies.length && <p className="p-5 text-xs text-muted-foreground">No scoring policies defined. The fixed 1-5 multiplication matrix applies until a versioned policy is published.</p>}</div></CardContent></Card></div></>;
}