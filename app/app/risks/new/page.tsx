import { db } from "@/lib/db";
import { requireSession } from "@/lib/authz";
import { PageHeader } from "@/components/page-header";
import { RiskForm } from "@/components/risk-form";
export default async function NewRiskPage() { const session = await requireSession(); const users = await db.user.findMany({ where: { tenantId: session.user.tenantId }, select: { id: true, name: true } }); return <><PageHeader eyebrow="Risk register" title="Add a new risk" description="Describe the uncertain event, assess its initial exposure, and assign clear accountability."/><RiskForm users={users}/></>; }