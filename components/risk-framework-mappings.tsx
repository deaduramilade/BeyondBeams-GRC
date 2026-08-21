"use client";

import { useState, useTransition } from "react";
import { LoaderCircle, Plus, Search, ShieldCheck, Trash2 } from "lucide-react";
import { addRiskControlMapping, removeRiskControlMapping } from "@/app/actions/frameworks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { FrameworkControlOption } from "@/components/framework-control-picker";

type Mapping = { id: string; notes: string | null; frameworkControl: FrameworkControlOption };

export function RiskFrameworkMappings({ riskId, mappings, controls, editable }: { riskId: string; mappings: Mapping[]; controls: FrameworkControlOption[]; editable: boolean }) {
  const [query, setQuery] = useState(""); const [error, setError] = useState(""); const [pending, start] = useTransition();
  const mapped = new Set(mappings.map((mapping) => mapping.frameworkControl.id));
  const available = controls.filter((control) => !mapped.has(control.id) && (!query.trim() || `${control.framework.name} ${control.controlId} ${control.title} ${control.description}`.toLowerCase().includes(query.toLowerCase()))).slice(0, 8);
  function add(controlId: string) { start(async () => { const result = await addRiskControlMapping(riskId, controlId); if ("error" in result) setError(result.error ?? "Unable to add this mapping."); }); }
  function remove(mappingId: string) { start(async () => { const result = await removeRiskControlMapping(mappingId); if ("error" in result) setError(result.error ?? "Unable to remove this mapping."); }); }
  return <div className="space-y-4">
    {mappings.length ? <div className="divide-y rounded-md border">{mappings.map((mapping) => <article key={mapping.id} className="flex gap-3 p-4"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary"/><div className="min-w-0 flex-1"><p className="text-[10px] font-bold uppercase text-primary">{mapping.frameworkControl.framework.name} · {mapping.frameworkControl.controlId}</p><p className="mt-1 text-sm font-bold">{mapping.frameworkControl.title}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{mapping.frameworkControl.description}</p></div>{editable && <Button type="button" variant="ghost" size="icon" disabled={pending} onClick={() => remove(mapping.id)} aria-label={`Remove ${mapping.frameworkControl.controlId}`} title="Remove mapping"><Trash2 className="size-4"/></Button>}</article>)}</div> : <p className="rounded-md border border-dashed p-6 text-center text-xs text-muted-foreground">No framework controls mapped to this risk.</p>}
    {editable && <div className="rounded-md border bg-muted/30 p-3"><label className="flex items-center gap-2"><Search className="size-4 text-muted-foreground"/><span className="sr-only">Search enabled controls</span><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find an enabled control to map" className="h-9 bg-background"/></label>{query && <div className="mt-2 divide-y rounded-md border bg-background">{available.map((control) => <div key={control.id} className="flex items-center gap-3 p-3"><div className="min-w-0 flex-1"><p className="text-[10px] font-bold uppercase text-primary">{control.framework.name} · {control.controlId}</p><p className="truncate text-xs font-semibold">{control.title}</p></div><Button type="button" size="icon" variant="ghost" disabled={pending} onClick={() => add(control.id)} aria-label={`Map ${control.controlId}`} title="Add mapping">{pending ? <LoaderCircle className="size-4 animate-spin"/> : <Plus className="size-4"/>}</Button></div>)}{!available.length && <p className="p-4 text-center text-xs text-muted-foreground">No available controls match.</p>}</div>}</div>}
    {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
  </div>;
}