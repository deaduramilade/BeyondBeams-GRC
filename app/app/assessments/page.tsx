import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { AssessmentCreateForm } from "@/components/lifecycle-forms";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { requireSession } from "@/lib/authz";
import { db } from "@/lib/db";
import { formatDate, formatEnum } from "@/lib/utils";

export default async function AssessmentsPage() {
  const session = await requireSession(); const tenantId = session.user.tenantId;
  const [assessments, risks] = await Promise.all([
    db.assessment.findMany({ where: { tenantId }, include: { risk: { select: { reference: true, title: true } }, author: { select: { name: true } }, decidedBy: { select: { name: true } } }, orderBy: [{ riskId: "asc" }, { type: "asc" }, { revision: "desc" }] }),
    db.risk.findMany({ where: { tenantId, deletedAt: null }, select: { id: true, reference: true, title: true }, orderBy: { reference: "asc" } }),
  ]);
  return <><PageHeader eyebrow="Governed lifecycle" title="Assessment register" description="Versioned inherent and residual assessments with explicit submission, independent decision, and superseding history."/><div className="grid gap-5 xl:grid-cols-[360px_1fr]"><Card><CardHeader><h2 className="text-sm font-bold">Create assessment draft</h2><p className="mt-1 text-xs text-muted-foreground">Residual assessments require an approved inherent assessment.</p></CardHeader><CardContent><AssessmentCreateForm risks={risks.map((risk) => ({ value: risk.id, label: `${risk.reference} · ${risk.title}` }))}/></CardContent></Card><Card><CardHeader><h2 className="text-sm font-bold">Assessment history</h2></CardHeader><CardContent className="p-0"><div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead className="border-b bg-muted/30 text-muted-foreground"><tr><th className="p-4">Risk</th><th className="p-4">Type</th><th className="p-4">Revision</th><th className="p-4">Score</th><th className="p-4">Status</th><th className="p-4">Author</th><th className="p-4">Created</th></tr></thead><tbody className="divide-y">{assessments.map((assessment) => <tr key={assessment.id} className="hover:bg-muted/20"><td className="p-4"><Link className="font-semibold text-primary" href={`/app/assessments/${assessment.id}`}>{assessment.risk.reference}</Link><p className="mt-1 text-muted-foreground">{assessment.risk.title}</p></td><td className="p-4">{formatEnum(assessment.type)}</td><td className="p-4">v{assessment.revision}</td><td className="p-4 font-semibold">{assessment.score}</td><td className="p-4"><Badge>{formatEnum(assessment.status)}</Badge></td><td className="p-4">{assessment.author.name}</td><td className="p-4">{formatDate(assessment.createdAt)}</td></tr>)}</tbody></table>{!assessments.length && <p className="p-8 text-center text-sm text-muted-foreground">No assessments recorded in this workspace.</p>}</div></CardContent></Card></div></>;
}