"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RiskCategory, RiskStatus, RiskTreatment } from "@prisma/client";
import { LoaderCircle, Save, ShieldCheck } from "lucide-react";
import { createRisk, updateRisk } from "@/app/actions/risks";
import { syncRiskControlMappings } from "@/app/actions/frameworks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ComplianceBrowser } from "@/components/compliance-browser";
import { FrameworkControlPicker, type FrameworkControlOption } from "@/components/framework-control-picker";
import { formatEnum, riskLevel } from "@/lib/utils";

type Taxonomy = { id: string; type: string; name: string };
type EditableRisk = { id: string; version: number; title: string; description: string; category: RiskCategory; ownerId: string; businessUnitId: string | null; objectiveId: string | null; riskSourceId: string | null; regulatoryDomainId: string | null; inherentLikelihood: number; inherentImpact: number; residualLikelihood: number | null; residualImpact: number | null; treatment: RiskTreatment; status: RiskStatus; nextReviewDate: string };
type Ref = { id: string; framework: string; jurisdiction: string; reference: string; title: string; excerpt: string; metric: string | null; sourceUrl: string; industry: string };
const cls = "h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring";

export function RiskForm({ users, risk, references = [], controls = [], taxonomy = [], mappedControlIds = [], allowed = true, disabledReason }: { users: { id: string; name: string }[]; risk?: EditableRisk; references?: Ref[]; controls?: FrameworkControlOption[]; taxonomy?: Taxonomy[]; mappedControlIds?: string[]; allowed?: boolean; disabledReason?: string }) {
  const router = useRouter(); const [pending, start] = useTransition(); const [error, setError] = useState("");
  const [category, setCategory] = useState<RiskCategory>(risk?.category ?? RiskCategory.CYBERSECURITY);
  const [inherent, setInherent] = useState<(number | null)[]>([risk?.inherentLikelihood ?? 3, risk?.inherentImpact ?? 3]);
  const [residual, setResidual] = useState<(number | null)[]>([risk?.residualLikelihood ?? null, risk?.residualImpact ?? null]);
  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    const input = { title: String(form.get("title")), description: String(form.get("description")), category: form.get("category") as RiskCategory, ownerId: String(form.get("ownerId")), businessUnitId: String(form.get("businessUnitId") || "") || null, objectiveId: String(form.get("objectiveId") || "") || null, riskSourceId: String(form.get("riskSourceId") || "") || null, regulatoryDomainId: String(form.get("regulatoryDomainId") || "") || null, inherentLikelihood: Number(form.get("inherentLikelihood")), inherentImpact: Number(form.get("inherentImpact")), residualLikelihood: form.get("residualLikelihood") ? Number(form.get("residualLikelihood")) : null, residualImpact: form.get("residualImpact") ? Number(form.get("residualImpact")) : null, treatment: form.get("treatment") as RiskTreatment, status: form.get("status") as RiskStatus, nextReviewDate: new Date(`${form.get("nextReviewDate")}T12:00:00`) };
    const controlIds = form.getAll("controlIds").map(String);
    start(async () => {
      const result = risk ? await updateRisk(risk.id, input, risk.version) : await createRisk(input);
      if ("error" in result) { setError(result.error ?? "Unable to save this risk."); return; }
      const riskId = risk?.id ?? ("id" in result ? result.id : "");
      const mapping = await syncRiskControlMappings(riskId, controlIds);
      if ("error" in mapping) { setError(`Risk saved, but controls were not updated: ${mapping.error}`); return; }
      router.push(`/app/risks/${riskId}`); router.refresh();
    });
  }
  return <form onSubmit={submit} className="grid items-start gap-5 xl:grid-cols-[1fr_430px]">
    <fieldset disabled={!allowed || pending} className="grid gap-5">
      <Card><CardHeader><h2 className="text-sm font-bold">Risk statement</h2><p className="mt-1 text-xs text-muted-foreground">Name the uncertain event and explain its potential effect.</p></CardHeader><CardContent className="grid gap-5"><Field label="Risk title"><Input name="title" required minLength={3} defaultValue={risk?.title}/></Field><Field label="Description"><textarea name="description" required minLength={10} defaultValue={risk?.description} rows={5} className={`${cls} h-auto py-3`}/></Field><div className="grid gap-4 sm:grid-cols-2"><Field label="Category"><select name="category" value={category} onChange={(event) => setCategory(event.target.value as RiskCategory)} className={cls}>{Object.values(RiskCategory).map((value) => <option key={value} value={value}>{formatEnum(value)}</option>)}</select></Field><Field label="Risk owner"><select name="ownerId" defaultValue={risk?.ownerId ?? users[0]?.id} className={cls}>{users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}</select></Field></div><div className="grid gap-4 sm:grid-cols-2"><TaxonomySelect type="BUSINESS_UNIT" label="Business unit" taxonomy={taxonomy} value={risk?.businessUnitId}/><TaxonomySelect type="OBJECTIVE" label="Objective" taxonomy={taxonomy} value={risk?.objectiveId}/><TaxonomySelect type="RISK_SOURCE" label="Risk source" taxonomy={taxonomy} value={risk?.riskSourceId}/><TaxonomySelect type="REGULATORY_DOMAIN" label="Regulatory domain" taxonomy={taxonomy} value={risk?.regulatoryDomainId}/></div></CardContent></Card>
      <Score title="Inherent assessment" description="Exposure before treatments and controls." values={inherent} change={setInherent} names={["inherentLikelihood", "inherentImpact"]}/>
      <Score title="Residual assessment" description="Expected exposure after treatments operate." values={residual} change={setResidual} names={["residualLikelihood", "residualImpact"]} optional/>
      <Card><CardHeader><h2 className="text-sm font-bold">Treatment and review</h2></CardHeader><CardContent className="grid gap-4 sm:grid-cols-3"><SelectField label="Treatment" name="treatment" values={Object.values(RiskTreatment)} value={risk?.treatment}/><SelectField label="Status" name="status" values={Object.values(RiskStatus)} value={risk?.status}/><Field label="Next review"><Input type="date" name="nextReviewDate" required defaultValue={risk?.nextReviewDate ?? new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)}/></Field></CardContent></Card>
      {error && <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
      {!allowed && <p className="text-xs text-muted-foreground" role="note">{disabledReason ?? "You do not have permission to modify this risk."}</p>}
      <div className="flex justify-end"><Button type="submit" disabled={pending || !allowed} title={!allowed ? (disabledReason ?? "You do not have permission to modify this risk.") : undefined}>{pending ? <LoaderCircle className="size-4 animate-spin"/> : <Save className="size-4"/>}{allowed ? (pending ? "Saving" : "Save risk") : "Save unavailable"}</Button></div>
    </fieldset>
    <aside className="space-y-5 xl:sticky xl:top-24">
      <Card><CardHeader><div className="flex items-center gap-2"><ShieldCheck className="size-4 text-primary"/><h2 className="text-sm font-bold">Framework controls</h2></div><p className="mt-1 text-xs text-muted-foreground">Search enabled frameworks and select every control that treats or evidences this risk.</p></CardHeader><CardContent>{controls.length ? <FrameworkControlPicker key={category} controls={controls} initialIds={mappedControlIds} category={category} compact/> : <p className="rounded-md border border-dashed p-5 text-xs text-muted-foreground">No frameworks are enabled. An Owner or Risk Manager can enable one in Frameworks & Compliance.</p>}</CardContent></Card>
      <ComplianceBrowser references={references}/>
    </aside>
  </form>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div className="space-y-2"><Label className="text-xs font-semibold">{label}</Label>{children}</div>; }
function SelectField({ label, name, values, value }: { label: string; name: string; values: string[]; value?: string }) { return <Field label={label}><select name={name} defaultValue={value} className={cls}>{values.map((item) => <option key={item} value={item}>{formatEnum(item)}</option>)}</select></Field>; }
function TaxonomySelect({ type, label, taxonomy, value }: { type: string; label: string; taxonomy: Taxonomy[]; value?: string | null }) { const items = taxonomy.filter((item) => item.type === type); return <Field label={label}><select name={type === "BUSINESS_UNIT" ? "businessUnitId" : type === "OBJECTIVE" ? "objectiveId" : type === "RISK_SOURCE" ? "riskSourceId" : "regulatoryDomainId"} defaultValue={value ?? ""} className={cls}><option value="">Not specified</option>{items.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>; }
function Score({ title, description, values, change, names, optional }: { title: string; description: string; values: (number | null)[]; change: (value: (number | null)[]) => void; names: string[]; optional?: boolean }) { const score = values[0] && values[1] ? values[0] * values[1] : null; return <Card><CardHeader><div className="flex justify-between gap-4"><div><h2 className="text-sm font-bold">{title}</h2><p className="mt-1 text-xs text-muted-foreground">{description}</p></div><div className="text-right"><p className="font-display text-3xl text-primary">{score ?? "-"}</p><p className="text-[10px] text-muted-foreground">{riskLevel(score)}</p></div></div></CardHeader><CardContent className="grid grid-cols-2 gap-4">{["Likelihood", "Impact"].map((label, index) => <Field key={label} label={label}><select name={names[index]} value={values[index] ?? ""} required={!optional} onChange={(event) => { const next = [...values]; next[index] = event.target.value ? Number(event.target.value) : null; change(next); }} className={cls}>{optional && <option value="">Not assessed</option>}{[1, 2, 3, 4, 5].map((number) => <option key={number} value={number}>{number} - {index === 0 ? ["Rare", "Unlikely", "Possible", "Likely", "Almost certain"][number - 1] : ["Minimal", "Minor", "Moderate", "Major", "Severe"][number - 1]}</option>)}</select></Field>)}</CardContent></Card>; }