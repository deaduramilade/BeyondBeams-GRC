"use client";

import { useState } from "react";
import { ShieldCheck, Smartphone, MailCheck, Cloud } from "lucide-react";
import { beginMfaSetup, confirmMfa } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function SecurityOnboarding({ email }: { email: string }) {
  const [uri, setUri] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function begin() { setBusy(true); setError(""); const result = await beginMfaSetup(); if ("error" in result && result.error) setError(result.error); else if ("uri" in result && typeof result.uri === "string") setUri(result.uri); else setError("Setup failed."); setBusy(false); }
  async function confirm() { setBusy(true); setError(""); const result = await confirmMfa(code); if ("error" in result) { setError(result.error ?? "Invalid code."); setBusy(false); return; } window.location.href = "/app"; }
  return <main className="grid min-h-screen place-items-center bg-[#071c2f] p-5 text-white">
    <section className="w-full max-w-3xl overflow-hidden rounded-xl border border-white/10 bg-[#0a2540] shadow-2xl shadow-black/30">
      <div className="border-b border-white/10 p-6 sm:p-8"><div className="flex size-11 items-center justify-center rounded-lg bg-primary text-primary-foreground"><ShieldCheck className="size-5"/></div><p className="mt-6 text-xs font-bold uppercase tracking-[.16em] text-primary">Required security setup</p><h1 className="mt-2 font-display text-3xl sm:text-4xl">Secure your workspace before continuing</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">This guided setup cannot be skipped. Your email is verified during account access, Cloudflare Turnstile protects public authentication forms, and your authenticator becomes the second factor for future password sign-ins.</p></div>
      <div className="grid gap-px bg-white/10 sm:grid-cols-3">{[[MailCheck,"Email identity",email],[Cloud,"Cloudflare", "Human validation on public access"],[Smartphone,"Authenticator","Required for future sign-in"]].map(([Icon,title,text])=>{const I=Icon as typeof MailCheck;return <div className="bg-[#0a2540] p-5" key={String(title)}><I className="size-4 text-primary"/><p className="mt-3 text-xs font-bold">{String(title)}</p><p className="mt-1 text-xs leading-5 text-slate-500">{String(text)}</p></div>})}</div>
      <div className="p-6 sm:p-8">{!uri ? <Button onClick={begin} disabled={busy}>Start authenticator setup</Button> : <div className="grid gap-4"><div><p className="text-sm font-bold">1. Add this setup URI to your authenticator</p><p className="mt-2 break-all rounded-md bg-black/20 p-4 font-mono text-xs text-teal-100">{uri}</p></div><div className="max-w-xs"><Label htmlFor="onboarding-code">2. Enter the current 6-digit code</Label><Input id="onboarding-code" className="mt-2 bg-white text-slate-950" value={code} onChange={(event)=>setCode(event.target.value.replace(/\D/g, "").slice(0,6))} inputMode="numeric" autoComplete="one-time-code"/><Button className="mt-3 w-full" onClick={confirm} disabled={busy || code.length !== 6}>Verify and enter workspace</Button></div></div>}{error&&<p role="alert" className="mt-4 text-sm text-red-300">{error}</p>}</div>
    </section>
  </main>;
}