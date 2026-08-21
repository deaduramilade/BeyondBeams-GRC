"use client";

import { useMemo, useState } from "react";
import { Check, Search, ShieldCheck, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type FrameworkControlOption = { id: string; controlId: string; title: string; description: string; category: string; framework: { name: string; version: string } };

const relevance: Record<string, string[]> = {
  CYBERSECURITY: ["access", "identity", "vulnerab", "monitor", "logging", "threat", "incident", "secure"],
  COMPLIANCE: ["risk", "polic", "regulat", "audit", "integrity"],
  OPERATIONAL: ["resilience", "recovery", "continuity", "change", "control"],
  STRATEGIC: ["govern", "context", "risk management", "objectives"],
  FINANCIAL: ["payment", "market", "risk", "integrity", "resilience"],
  PEOPLE: ["workforce", "training", "awareness", "access"],
  THIRD_PARTY: ["supplier", "vendor", "cloud", "third", "exit"],
  RESILIENCE: ["recovery", "continuity", "incident", "availability", "resilience"],
  PRIVACY: ["privacy", "data", "ephi", "confidential", "access"],
};

export function FrameworkControlPicker({ controls, initialIds = [], category, compact = false }: { controls: FrameworkControlOption[]; initialIds?: string[]; category?: string; compact?: boolean }) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(() => new Set(initialIds));
  const keywords = relevance[category ?? ""] ?? [];
  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    return controls.filter((control) => !term || `${control.framework.name} ${control.controlId} ${control.title} ${control.description} ${control.category}`.toLowerCase().includes(term));
  }, [controls, query]);
  const suggested = (control: FrameworkControlOption) => keywords.some((word) => `${control.title} ${control.description} ${control.category}`.toLowerCase().includes(word));
  return <div className="space-y-3">
    <label className="flex items-center gap-2"><Search className="size-4 text-muted-foreground"/><span className="sr-only">Search controls</span><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search control ID, title or requirement" className="h-9"/></label>
    <div className={cn("overflow-y-auto rounded-md border bg-background", compact ? "max-h-80" : "max-h-[460px]")}>
      {visible.map((control) => { const active = selected.has(control.id); const relevant = suggested(control); return <label key={control.id} className={cn("flex cursor-pointer gap-3 border-b p-3 last:border-b-0 hover:bg-accent/40", active && "bg-accent/60")}>
        <input type="checkbox" name="controlIds" value={control.id} checked={active} onChange={() => setSelected((current) => { const next = new Set(current); if (next.has(control.id)) next.delete(control.id); else next.add(control.id); return next; })} className="sr-only"/>
        <span className={cn("mt-0.5 grid size-5 shrink-0 place-items-center rounded border", active ? "border-primary bg-primary text-primary-foreground" : "border-input")}><Check className={cn("size-3.5", !active && "opacity-0")}/></span>
        <span className="min-w-0 flex-1"><span className="flex flex-wrap items-center gap-2"><span className="text-[10px] font-bold uppercase text-primary">{control.framework.name} · {control.controlId}</span>{relevant && <span className="inline-flex items-center gap-1 rounded bg-teal-500/10 px-1.5 py-0.5 text-[9px] font-bold uppercase text-teal-600 dark:text-teal-300"><Sparkles className="size-2.5"/>Relevant</span>}</span><span className="mt-1 block text-xs font-bold">{control.title}</span><span className="mt-1 block text-[11px] leading-5 text-muted-foreground">{control.description}</span></span>
      </label>; })}
      {!visible.length && <div className="grid place-items-center gap-2 p-8 text-center text-xs text-muted-foreground"><ShieldCheck className="size-6"/>No enabled controls match this search.</div>}
    </div>
    <p className="text-[11px] text-muted-foreground">{selected.size} control{selected.size === 1 ? "" : "s"} selected. Relevant controls are highlighted from the current risk category.</p>
  </div>;
}