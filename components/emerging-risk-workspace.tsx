"use client";

import { useState, useTransition } from "react";
import { ArrowUpRight, LoaderCircle, Radar, Save, XCircle } from "lucide-react";
import { createEmergingRisk, settleEmergingRisk } from "@/app/actions/workflows";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";

const field="min-h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring";
type Emerging={id:string;title:string;hypothesis:string;indicators:string;cadence:string;horizon:string;status:string;nextReviewDate:Date;settlementDecision:string|null};
export function EmergingRiskWorkspace({ users, items, allowed = true, disabledReason }: { users: { id: string; name: string }[]; items: Emerging[]; allowed?: boolean; disabledReason?: string }) {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState("");
  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    start(async () => {
      const result = await createEmergingRisk({
        title: String(form.get("title")),
        hypothesis: String(form.get("hypothesis")),
        indicators: String(form.get("indicators")),
        cadence: String(form.get("cadence")) as "WEEKLY",
        horizon: String(form.get("horizon")) as "0-3 MONTHS",
        ownerId: String(form.get("ownerId")),
        nextReviewDate: new Date(`${form.get("nextReviewDate")}T12:00:00`),
      });
      setMessage("error" in result ? result.error ?? "Unable to save." : "Monitoring case created with an audit event.");
    });
  }
  return (
    <div className="grid items-start gap-5 xl:grid-cols-[420px_1fr]">
      <Card>
        <CardHeader>
          <Radar className="size-5 text-primary" />
          <h2 className="mt-4 text-sm font-bold">Flag an emerging risk</h2>
          <p className="mt-1 text-xs text-muted-foreground">Capture a hypothesis and observable signals before the exposure is fully understood.</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="grid gap-4">
            <fieldset disabled={!allowed || pending} className="grid gap-4">
              <F label="Risk signal"><Input name="title" required /></F>
              <F label="Emerging-risk hypothesis"><textarea name="hypothesis" rows={4} required className={`${field} py-3`} /></F>
              <F label="Early-warning indicators"><textarea name="indicators" rows={4} required placeholder="One measurable indicator per line" className={`${field} py-3`} /></F>
              <div className="grid grid-cols-2 gap-3">
                <F label="Cadence">
                  <select name="cadence" className={field}>
                    {["WEEKLY", "MONTHLY", "QUARTERLY"].map((x) => <option key={x}>{x}</option>)}
                  </select>
                </F>
                <F label="Time horizon">
                  <select name="horizon" className={field}>
                    {["0-3 MONTHS", "3-12 MONTHS", "1-3 YEARS", "3+ YEARS"].map((x) => <option key={x}>{x}</option>)}
                  </select>
                </F>
              </div>
              <F label="Owner">
                <select name="ownerId" className={field}>
                  {users.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                </select>
              </F>
              <F label="Next monitoring review"><Input name="nextReviewDate" type="date" required /></F>
              <Button disabled={pending || !allowed} title={!allowed ? disabledReason : undefined}>
                {pending ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />}
                {allowed ? "Start monitoring" : "Monitoring unavailable"}
              </Button>
            </fieldset>
            {!allowed && <p className="text-xs text-muted-foreground" role="note">{disabledReason ?? "Emerging risk management requires risk update permission."}</p>}
            {message && <p className="text-xs text-muted-foreground">{message}</p>}
          </form>
        </CardContent>
      </Card>
      <div className="space-y-3">
        {items.map((item) => <EmergingItem key={item.id} item={item} allowed={allowed} disabledReason={disabledReason} />)}
      </div>
    </div>
  );
}

function EmergingItem({ item, allowed = true, disabledReason }: { item: Emerging; allowed?: boolean; disabledReason?: string }) {
  const [pending, start] = useTransition();
  const [decision, setDecision] = useState("");
  const active = item.status === "MONITORING";
  const settle = (promote: boolean) => start(async () => { await settleEmergingRisk(item.id, decision, promote); });
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase text-primary">{item.horizon} · {item.cadence}</p>
            <h2 className="mt-1 text-base font-bold">{item.title}</h2>
          </div>
          <span className="rounded-full bg-muted px-2 py-1 text-[10px] font-bold">{item.status}</span>
        </div>
        <p className="mt-4 text-sm leading-6 text-muted-foreground">{item.hypothesis}</p>
        <div className="mt-4 rounded-md bg-muted p-3">
          <p className="text-[10px] font-bold uppercase text-muted-foreground">Early-warning indicators</p>
          <p className="mt-2 whitespace-pre-line text-xs">{item.indicators}</p>
        </div>
        <p className="mt-3 text-[10px] text-muted-foreground">Next review: {formatDate(item.nextReviewDate)}</p>
        {active ? (
          <div className="mt-5 border-t pt-4">
            <Label className="text-xs font-semibold">Settlement rationale</Label>
            <textarea value={decision} onChange={(e) => setDecision(e.target.value)} rows={3} className={`${field} mt-2 py-3`} placeholder="Record evidence and the decision rationale…" disabled={!allowed} />
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" disabled={pending || decision.length < 10 || !allowed} title={!allowed ? disabledReason : undefined} onClick={() => settle(true)}>
                <ArrowUpRight className="size-4" />Promote to register
              </Button>
              <Button size="sm" variant="outline" disabled={pending || decision.length < 10 || !allowed} title={!allowed ? disabledReason : undefined} onClick={() => settle(false)}>
                <XCircle className="size-4" />Settle without promotion
              </Button>
            </div>
            {!allowed && <p className="mt-2 text-xs text-muted-foreground" role="note">{disabledReason ?? "Emerging risk settlement requires risk update permission."}</p>}
          </div>
        ) : item.settlementDecision && (
          <p className="mt-4 border-t pt-4 text-xs text-muted-foreground"><strong className="text-foreground">Settlement:</strong> {item.settlementDecision}</p>
        )}
      </CardContent>
    </Card>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-2"><Label className="text-xs font-semibold">{label}</Label>{children}</div>;
}