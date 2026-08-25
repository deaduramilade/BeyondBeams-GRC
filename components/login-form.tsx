"use client";
import Link from "next/link";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginForm() {
  const router = useRouter(); const [loading, setLoading] = useState(false); const [error, setError] = useState("");
  async function submit(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); setLoading(true); setError(""); const data = new FormData(event.currentTarget); const result = await signIn("credentials", { email: data.get("email"), password: data.get("password"), mfaCode: data.get("mfaCode"), redirect: false }); if (result?.error) { setError("The credentials or authenticator code are incorrect."); setLoading(false); } else { router.push("/app"); router.refresh(); } }
  const field = "border-white/10 bg-white/5 text-white";
  return <form onSubmit={submit} className="space-y-5"><div className="space-y-2"><Label htmlFor="email" className="text-xs text-slate-300">Email address</Label><Input id="email" name="email" type="email" autoComplete="email" required className={field}/></div><div className="space-y-2"><Label htmlFor="password" className="text-xs text-slate-300">Password</Label><Input id="password" name="password" type="password" autoComplete="current-password" required className={field}/></div><div className="space-y-2"><Label htmlFor="mfaCode" className="text-xs text-slate-300">Authenticator code</Label><Input id="mfaCode" name="mfaCode" inputMode="numeric" pattern="[0-9]{6}" autoComplete="one-time-code" placeholder="Required when MFA is enabled" className={field}/></div>{error&&<p role="alert" className="text-sm text-red-300">{error}</p>}<Button className="h-11 w-full" disabled={loading}>{loading&&<LoaderCircle className="size-4 animate-spin"/>}Sign in to workspace</Button><div className="grid gap-3 text-center text-xs sm:grid-cols-3"><Link href="/magic-link" className="text-primary hover:underline">Email link</Link><Link href="/reset-password" className="text-primary hover:underline">Reset password</Link><Link href="/register" className="text-primary hover:underline">Create workspace</Link></div></form>;
}