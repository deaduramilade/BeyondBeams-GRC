import { Role } from "@prisma/client";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/authz";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { InviteMemberForm } from "@/components/invite-member-form";
import { formatDate, formatEnum } from "@/lib/utils";

export default async function Roles() {
  const session = await requireSession();
  const canInvite = session.user.role === Role.OWNER || session.user.role === Role.RISK_MANAGER;
  const members = await db.membership.findMany({ where: { tenantId: session.user.tenantId }, include: { user: true }, orderBy: { createdAt: "asc" } });
  return <><PageHeader eyebrow="Access governance" title="People and roles" description="Manage active members and tenant-scoped invitations with least-privilege roles."/><div className="space-y-5">
    {canInvite && <Card><CardHeader><div><h2 className="text-sm font-bold">Invite a team member</h2><p className="mt-1 text-xs text-muted-foreground">Invitations expire after seven days and are delivered through the workspace email service.</p></div></CardHeader><CardContent><InviteMemberForm/></CardContent></Card>}
    <Card><CardHeader><h2 className="text-sm font-bold">Workspace access</h2></CardHeader><CardContent className="divide-y pt-0">{members.map((membership) => <div key={membership.id} className="flex flex-wrap items-center gap-4 py-4"><div className="grid size-9 place-items-center rounded-full bg-primary/10 text-xs font-bold text-primary">{membership.user ? membership.user.name.split(" ").map((part) => part[0]).join("").slice(0, 2) : "?"}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{membership.user?.name ?? membership.inviteEmail}</p><p className="truncate text-xs text-muted-foreground">{membership.user?.email ?? `Invited ${formatDate(membership.createdAt)}`}</p></div><span className={`rounded-sm px-2 py-1 text-[10px] font-bold ${membership.acceptedAt ? "bg-primary/10 text-primary" : "bg-amber-500/10 text-amber-600 dark:text-amber-300"}`}>{membership.acceptedAt ? formatEnum(membership.role) : `Pending · ${formatEnum(membership.role)}`}</span></div>)}</CardContent></Card>
  </div></>;
}