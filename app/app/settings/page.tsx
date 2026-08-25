import { Role } from "@prisma/client";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { NotificationSettings } from "@/components/notification-settings";
import { EmailReportForm } from "@/components/email-report-form";
import { MfaSettings } from "@/components/mfa-settings";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/authz";

export default async function Settings() {
  const session = await requireSession();
  const [user, tenant] = await Promise.all([
    db.user.findUniqueOrThrow({ where: { id: session.user.id }, select: { email: true, reviewEmailsEnabled: true, assignmentEmailsEnabled: true, exportEmailsEnabled: true, mfaEnabled: true } }),
    db.tenant.findUniqueOrThrow({ where: { id: session.user.tenantId }, select: { reviewRemindersEnabled: true, reviewReminderCadence: true, plan: true } }),
  ]);
  return <><PageHeader eyebrow="Workspace administration" title="Settings" description="Manage secure workspace controls and notifications."/><div className="grid gap-5"><Card><CardContent className="grid gap-5 pt-5 sm:grid-cols-3">{[["Authentication",user.mfaEnabled?"Password and authenticator MFA":"Credentials enabled"],["Data boundary","All records scoped to session tenant"],["Plan",`${tenant.plan} workspace`]].map(([label,value])=><div key={label}><p className="text-xs font-bold">{label}</p><p className="mt-2 text-xs text-muted-foreground">{value}</p></div>)}</CardContent></Card><MfaSettings enabled={user.mfaEnabled} eligible={true}/><NotificationSettings user={user} tenant={tenant} owner={session.user.role===Role.OWNER}/><Card><CardHeader><div><h2 className="text-sm font-bold">Email a report</h2><p className="mt-1 text-xs text-muted-foreground">Generate a quota-controlled export and send a single-use link that expires after 24 hours.</p></div></CardHeader><CardContent><EmailReportForm email={user.email}/></CardContent></Card></div></>;
}