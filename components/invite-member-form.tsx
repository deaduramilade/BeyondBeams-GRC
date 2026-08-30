"use client";
import { useState } from "react";
import { Role } from "@prisma/client";
import { inviteMember } from "@/app/actions/memberships";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatEnum } from "@/lib/utils";

const roles = [Role.OWNER, Role.RISK_MANAGER, Role.ASSESSOR, Role.VIEWER, Role.AUDITOR];

export function InviteMemberForm({ allowed = true, disabledReason }: { allowed?: boolean; disabledReason?: string }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ error?: string; message?: string; localUrl?: string }>({});

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    const form = event.currentTarget;
    const data = new FormData(form);
    const response = await inviteMember({ email: String(data.get("email")), role: String(data.get("role")) as Role });
    setResult(response);
    if (response.success) form.reset();
    setBusy(false);
  }

  return (
    <form onSubmit={submit} className="grid gap-4 sm:grid-cols-[1fr_190px_auto]">
      <fieldset disabled={!allowed || busy} className="contents">
        <div className="space-y-2">
          <Label htmlFor="invite-email">Email address</Label>
          <Input id="invite-email" name="email" type="email" placeholder="colleague@company.com" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="invite-role">Assigned role</Label>
          <select id="invite-role" name="role" className="h-10 w-full rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
            {roles.map((role) => <option key={role} value={role}>{formatEnum(role)}</option>)}
          </select>
        </div>
        <Button disabled={busy || !allowed} title={!allowed ? disabledReason : undefined} className="self-end">
          {busy ? "Creating…" : allowed ? "Send invitation" : "Invitation unavailable"}
        </Button>
      </fieldset>
      {!allowed && <p className="text-xs text-muted-foreground sm:col-span-3" role="note">{disabledReason ?? "Member invitations require member management permission."}</p>}
      {(result.error || result.message) && (
        <div role={result.error ? "alert" : "status"} className={`sm:col-span-3 rounded-md p-3 text-sm ${result.error ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"}`}>
          {result.error ?? result.message}
          {result.localUrl && <><br /><a href={result.localUrl} className="break-all underline">Open local invitation</a></>}
        </div>
      )}
    </form>
  );
}