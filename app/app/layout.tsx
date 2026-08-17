import { requireSession } from "@/lib/authz";
import { AppShell } from "@/components/app-shell";
export default async function ProtectedLayout({ children }: { children: React.ReactNode }) { const session = await requireSession(); return <AppShell user={session.user}>{children}</AppShell>; }