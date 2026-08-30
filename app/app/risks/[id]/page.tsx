import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { notFound } from "next/navigation";
import { Building2, Calendar, Compass, Edit3, ExternalLink, Globe2, Shield, UserRound } from "lucide-react";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/authz";
import { enabledControls, ensureTenantFrameworks } from "@/lib/frameworks";
import { uiCapabilities } from "@/lib/ui-capabilities";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RiskBadge } from "@/components/risk-badge";
import { RiskFrameworkMappings } from "@/components/risk-framework-mappings";
import { formatDate, formatEnum } from "@/lib/utils";

export default async function RiskDetail({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession(); const { id } = await params;
  await ensureTenantFrameworks(session.user.tenantId);
  const [risk, controls] = await Promise.all([
    db.risk.findFirst({
      where: { id, tenantId: session.user.tenantId, deletedAt: null },
      include: {
        owner: true,
        businessUnit: true,
        objective: true,
        riskSource: true,
        regulatoryDomain: true,
        complianceLinks: { include: { reference: true } },
        frameworkMappings: {
          include: {
            frameworkControl: { include: { framework: true } },
            reviewedBy: { select: { name: true } },
          },
          orderBy: { mappedAt: "asc" },
        },
        auditEvents: { include: { actor: true }, orderBy: { createdAt: "desc" } },
      },
    }),
    enabledControls(session.user.tenantId),
  ]);
  if (!risk) notFound();
  const capabilities = uiCapabilities(session.user.role);
  const editable = capabilities["risk:update"];
  return <>
    <div className="mb-7 flex flex-col justify-between gap-4 border-b pb-7 sm:flex-row sm:items-end"><div><Link href="/app/risks" className="text-xs font-semibold text-primary">← Risk register</Link><p className="mt-6 text-[10px] font-bold uppercase text-muted-foreground">{risk.reference}</p><h1 className="mt-2 max-w-4xl font-display text-3xl sm:text-4xl">{risk.title}</h1><div className="mt-4 flex flex-wrap gap-2"><Badge>{formatEnum(risk.category)}</Badge><Badge>{formatEnum(risk.status)}</Badge><Badge>{formatEnum(risk.treatment)}</Badge></div></div>{editable && <Button asChild variant="outline"><Link href={`/app/risks/${id}/edit`}><Edit3 className="size-4"/>Edit risk</Link></Button>}</div>
    <div className="grid items-start gap-5 xl:grid-cols-[1fr_360px]"><div className="space-y-5">
      <Card><CardHeader><h2 className="text-sm font-bold">Risk description</h2></CardHeader><CardContent><p className="text-sm leading-7 text-muted-foreground">{risk.description}</p></CardContent></Card>
      <Card><CardHeader><h2 className="text-sm font-bold">Mapped framework controls</h2><p className="mt-1 text-xs text-muted-foreground">Controls from this organisation’s enabled frameworks that treat, evidence, or govern the risk with structured applicability review decisions.</p></CardHeader><CardContent><RiskFrameworkMappings riskId={risk.id} mappings={risk.frameworkMappings} controls={controls} editable={capabilities["mapping:manage"]}/></CardContent></Card>
      <Card><CardHeader><h2 className="text-sm font-bold">Triggered obligations & regulatory guidance</h2><p className="mt-1 text-xs text-muted-foreground">Automatically linked from category and risk-statement context. Confirm applicability against the official source.</p></CardHeader><CardContent className="divide-y">{risk.complianceLinks.map((link: Prisma.RiskComplianceLinkGetPayload<{ include: { reference: true } }>) => <article key={link.id} className="py-5 first:pt-0"><div className="flex justify-between gap-3"><div><p className="text-[10px] font-bold uppercase text-primary">{link.reference.framework} · {link.reference.reference}</p><h3 className="mt-1 text-sm font-bold">{link.reference.title}</h3></div><a href={link.reference.sourceUrl} target="_blank" rel="noreferrer" className="text-primary"><ExternalLink className="size-4"/><span className="sr-only">Official source</span></a></div><p className="mt-3 text-xs italic leading-6 text-muted-foreground">“{link.reference.excerpt}”</p>{link.reference.metric && <p className="mt-3 rounded-md bg-muted p-3 text-xs"><strong>Metric:</strong> {link.reference.metric}</p>}<p className="mt-2 text-[10px] text-muted-foreground">{link.rationale}</p></article>)}{!risk.complianceLinks.length && <p className="pb-5 text-sm text-muted-foreground">Re-save this risk to generate compliance linkages.</p>}</CardContent></Card>
      <Card><CardHeader><h2 className="text-sm font-bold">Change history</h2></CardHeader><CardContent>{risk.auditEvents.map((event: Prisma.AuditEventGetPayload<{ include: { actor: true } }>) => <div key={event.id} className="relative border-l pb-6 pl-6 last:pb-0"><span className="absolute -left-1.5 top-0 size-3 rounded-full border-2 border-card bg-primary"/><p className="text-sm font-semibold">{event.summary}</p><p className="mt-1 text-xs text-muted-foreground">{event.actor.name} · {formatDate(event.createdAt)}</p></div>)}</CardContent></Card>
    </div><aside className="space-y-5"><Card><CardHeader><h2 className="text-sm font-bold">Current assessment</h2></CardHeader><CardContent className="space-y-5"><Assessment label="Inherent exposure" likelihood={risk.inherentLikelihood} impact={risk.inherentImpact} score={risk.inherentScore}/><div className="border-t"/><Assessment label="Residual exposure" likelihood={risk.residualLikelihood} impact={risk.residualImpact} score={risk.residualScore}/></CardContent></Card><Card><CardHeader><h2 className="text-sm font-bold">Accountability & context</h2></CardHeader><CardContent className="space-y-4 pt-1"><Meta icon={UserRound} label="Risk owner" value={risk.owner.name}/><Meta icon={Calendar} label="Next review" value={formatDate(risk.nextReviewDate)}/><Meta icon={Building2} label="Business unit" value={risk.businessUnit?.name ?? "General / Unassigned"}/><Meta icon={Compass} label="Strategic objective" value={risk.objective?.name ?? "Unassigned"}/><Meta icon={Shield} label="Risk source" value={risk.riskSource?.name ?? "Unassigned"}/><Meta icon={Globe2} label="Regulatory domain" value={risk.regulatoryDomain?.name ?? "Unassigned"}/></CardContent></Card></aside></div>
  </>;
}

function Assessment({ label, likelihood, impact, score }: { label: string; likelihood: number | null; impact: number | null; score: number | null }) { return <div><div className="mb-3 flex items-center justify-between"><p className="text-xs font-semibold">{label}</p><RiskBadge score={score}/></div><div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground"><p className="rounded-md bg-muted p-3">Likelihood <strong className="float-right text-foreground">{likelihood ?? "-"}</strong></p><p className="rounded-md bg-muted p-3">Impact <strong className="float-right text-foreground">{impact ?? "-"}</strong></p></div></div>; }
function Meta({ icon: Icon, label, value }: { icon: typeof Calendar; label: string; value: string }) { return <div className="flex gap-3"><Icon className="mt-0.5 size-4 text-primary"/><div><p className="text-[10px] uppercase text-muted-foreground">{label}</p><p className="mt-1 text-sm font-semibold">{value}</p></div></div>; }