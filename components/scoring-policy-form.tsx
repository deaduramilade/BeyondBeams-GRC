"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, LoaderCircle, Plus, Trash2 } from "lucide-react";
import { createScoringPolicy } from "@/app/actions/governance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Band = { name: string; min: string; max: string };

export function ScoringPolicyForm({ allowed = true }: { allowed?: boolean }) {
  const router = useRouter();
  const [bands, setBands] = useState<Band[]>([{ name: "", min: "", max: "" }]);
  const [effectiveAt, setEffectiveAt] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage("");
    const parsed = bands
      .filter((band) => band.name.trim() && band.min.trim() && band.max.trim())
      .map((band) => ({ name: band.name.trim(), min: Number(band.min), max: Number(band.max) }));
    const result = await createScoringPolicy({ effectiveAt: effectiveAt || undefined, bands: parsed });
    setMessage(result.error ?? "Saved successfully."); setBusy(false);
    if (!result.error) { setBands([{ name: "", min: "", max: "" }]); setEffectiveAt(""); router.refresh(); }
  }
  function updateBand(index: number, key: keyof Band, value: string) { setBands((current) => current.map((band, i) => i === index ? { ...band, [key]: value } : band)); }
  return <form onSubmit={submit} className="grid gap-3"><fieldset disabled={!allowed || busy} className="grid gap-3">
    <div className="grid gap-1.5"><Label htmlFor="effectiveAt">Effective from</Label><Input id="effectiveAt" type="date" value={effectiveAt} onChange={(event) => setEffectiveAt(event.target.value)} required /></div>
    <div className="grid gap-2">{bands.map((band, index) => <div key={index} className="grid grid-cols-[1fr_64px_64px_36px] items-end gap-2"><div className="grid gap-1"><Label htmlFor={`band-name-${index}`}>Band name</Label><Input id={`band-name-${index}`} value={band.name} onChange={(event) => updateBand(index, "name", event.target.value)} placeholder="e.g. Low" /></div><div className="grid gap-1"><Label htmlFor={`band-min-${index}`}>Min</Label><Input id={`band-min-${index}`} type="number" min={1} max={25} value={band.min} onChange={(event) => updateBand(index, "min", event.target.value)} /></div><div className="grid gap-1"><Label htmlFor={`band-max-${index}`}>Max</Label><Input id={`band-max-${index}`} type="number" min={1} max={25} value={band.max} onChange={(event) => updateBand(index, "max", event.target.value)} /></div><Button type="button" variant="ghost" size="icon" aria-label={`Remove band ${index + 1}`} disabled={bands.length === 1} onClick={() => setBands((current) => current.filter((_, i) => i !== index))}><Trash2 className="size-4" /></Button></div>)}</div>
    <Button type="button" variant="outline" disabled={bands.length >= 10} onClick={() => setBands((current) => [...current, { name: "", min: "", max: "" }])}><Plus className="size-4" />Add band</Button>
    <Button disabled={busy || !allowed} title={allowed ? undefined : "Publishing a scoring policy requires settings management permission."}>{busy ? <LoaderCircle className="size-4 animate-spin" /> : <Check className="size-4" />}{allowed ? "Publish policy" : "Publish unavailable"}</Button>
  </fieldset>{!allowed && <p className="text-xs text-muted-foreground" role="note">Publishing a scoring policy requires settings management permission.</p>}{message && <p role="status" aria-live="polite" className="text-xs text-muted-foreground">{message}</p>}</form>;
}