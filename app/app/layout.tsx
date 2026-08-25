import { requireSession } from "@/lib/authz";
import { AppShell } from "@/components/app-shell";
import { SecurityOnboarding } from "@/components/security-onboarding";
import { db } from "@/lib/db";
export default async function ProtectedLayout({ children }: { children: React.ReactNode }) { const session = await requireSession(); const security = await db.user.findFirst({ where: { id: session.user.id, tenantId: session.user.tenantId }, select: { securityOnboardingCompletedAt: true } }); if (!security?.securityOnboardingCompletedAt) return <SecurityOnboarding email={session.user.email ?? "your verified email"}/>; return <AppShell user={session.user}>{children}</AppShell>; }