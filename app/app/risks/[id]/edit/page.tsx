import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/authz";
import { PageHeader } from "@/components/page-header";
import { RiskForm } from "@/components/risk-form";
export default async function EditRiskPage({ params }: { params: Promise<{ id: string }> }) { const session = await requireSession(); const { id } = await params; const [risk, users] = await Promise.all([db.risk.findFirst({ where: { id, tenantId: session.user.tenantId, deletedAt: null } }), db.user.findMany({ where: { tenantId: session.user.tenantId }, select: { id: true, name: true } })]); if (!risk) notFound(); return <><PageHeader eyebrow={risk.reference} title="Edit risk" description="Update the assessment, treatment decision, ownership, or review schedule."/><RiskForm users={users} risk={{ ...risk, nextReviewDate: risk.nextReviewDate.toISOString().slice(0,10) }}/></>; }