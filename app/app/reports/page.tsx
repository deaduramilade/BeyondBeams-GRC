import { db } from "@/lib/db";
import { requireSession } from "@/lib/authz";
import { exportAllowance } from "@/lib/reporting";
import { PageHeader } from "@/components/page-header";
import { ReportCentre } from "@/components/report-centre";

export default async function ReportsPage() {
  const session = await requireSession();
  const tenantId = session.user.tenantId;
  const now = new Date();

  const [tenant, allowance, user, activeRisks, openTreatments, effectiveControls, overdueRisks, overdueActions] =
    await Promise.all([
      db.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { name: true, plan: true } }),
      exportAllowance(tenantId, "PDF", "RISK_REGISTER"),
      db.user.findUniqueOrThrow({ where: { id: session.user.id }, select: { email: true } }),
      db.risk.findMany({
        where: { tenantId, deletedAt: null },
        select: { id: true, residualScore: true, inherentScore: true },
      }),
      db.treatmentPlan.count({ where: { tenantId, status: "APPROVED" } }),
      db.controlProfile.count({ where: { tenantId, effectiveness: "EFFECTIVE" } }),
      db.risk.count({ where: { tenantId, deletedAt: null, nextReviewDate: { lt: now } } }),
      db.treatmentAction.count({
        where: { tenantId, status: { in: ["NOT_STARTED", "IN_PROGRESS", "BLOCKED"] }, dueDate: { lt: now } },
      }),
    ]);

  const scoredRisks = activeRisks.filter((r) => r.residualScore !== null || r.inherentScore > 0);

  return (
    <>
      <PageHeader
        eyebrow="Intelligence & reporting"
        title="Report centre"
        description="Generate board-ready risk presentations, compliance gap analyses, operational summaries, and audit ledgers in PDF, Excel, or CSV format."
      />
      <ReportCentre
        allowance={allowance}
        userEmail={user.email}
        reconciliation={{
          activeRiskCount: activeRisks.length,
          scoredRiskCount: scoredRisks.length,
          openTreatmentCount: openTreatments,
          effectiveControlCount: effectiveControls,
          overdueItemCount: overdueRisks + overdueActions,
        }}
      />
    </>
  );
}
