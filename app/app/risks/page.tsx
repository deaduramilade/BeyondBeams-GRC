import Link from "next/link";
import { Plus } from "lucide-react";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/authz";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { RiskTable } from "@/components/risk-table";
export default async function RisksPage() { const session = await requireSession(); const risks = await db.risk.findMany({ where: { tenantId: session.user.tenantId, deletedAt: null }, include: { owner: { select: { name: true } } }, orderBy: { updatedAt: "desc" } }); return <><PageHeader eyebrow="Governance workspace" title="Risk register" description={`${risks.length} active risks across your organisation.`} action={<Button asChild><Link href="/app/risks/new"><Plus className="size-4"/>Add risk</Link></Button>}/><RiskTable risks={risks.map(r => ({ ...r, nextReviewDate: r.nextReviewDate.toISOString(), updatedAt: r.updatedAt.toISOString() }))}/></>; }