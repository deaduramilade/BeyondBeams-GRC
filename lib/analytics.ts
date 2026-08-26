import { db } from "@/lib/db";

export type HeatMapCell = { likelihood: number; impact: number; count: number; riskIds: string[] };
export type PortfolioAnalytics = {
  generatedAt: string;
  activeRiskCount: number;
  totalExposure: number;
  averageExposure: number;
  appetiteBreachCount: number;
  overdueReviewCount: number;
  openTreatmentCount: number;
  treatmentActionCount: number;
  overdueActionCount: number;
  controlProfileCount: number;
  effectiveControlCount: number;
  treatmentCoveragePercent: number;
  controlEffectivenessPercent: number;
  levelDistribution: Record<string, number>;
  categoryDistribution: Record<string, number>;
  heatMap: HeatMapCell[];
  reconciliation: { registerCount: number; scoredRiskCount: number; unscoredRiskCount: number; residualCount: number; inherentOnlyCount: number };
};

export function buildHeatMap(risks: Array<{ id: string; inherentLikelihood: number; inherentImpact: number; residualLikelihood: number | null; residualImpact: number | null }>, mode: "INHERENT" | "RESIDUAL" = "RESIDUAL") {
  const cells: HeatMapCell[] = Array.from({ length: 25 }, (_, index) => ({ likelihood: Math.floor(index / 5) + 1, impact: (index % 5) + 1, count: 0, riskIds: [] }));
  for (const risk of risks) {
    const useResidual = mode === "RESIDUAL" && risk.residualLikelihood !== null && risk.residualImpact !== null;
    const likelihood = useResidual ? risk.residualLikelihood : risk.inherentLikelihood;
    const impact = useResidual ? risk.residualImpact : risk.inherentImpact;
    if (likelihood === null || impact === null || likelihood < 1 || likelihood > 5 || impact < 1 || impact > 5) continue;
    const cell = cells[(likelihood - 1) * 5 + impact - 1];
    cell.count += 1;
    cell.riskIds.push(risk.id);
  }
  return cells;
}

export function levelForScore(score: number) {
  if (score >= 20) return "Critical";
  if (score >= 15) return "High";
  if (score >= 7) return "Moderate";
  return "Low";
}

export function calculatePortfolioAnalytics(input: {
  risks: Array<{ id: string; category: string; inherentLikelihood: number; inherentImpact: number; inherentScore: number; residualLikelihood: number | null; residualImpact: number | null; residualScore: number | null; nextReviewDate: Date }>;
  appetiteBreachCount: number;
  openTreatmentCount: number;
  treatmentActionCount: number;
  overdueActionCount: number;
  controlProfileCount: number;
  effectiveControlCount: number;
  asOf?: Date;
}): PortfolioAnalytics {
  const asOf = input.asOf ?? new Date();
  const activeRiskCount = input.risks.length;
  const scoredRisks = input.risks.filter((risk) => (risk.residualScore ?? risk.inherentScore) >= 0);
  const totalExposure = input.risks.reduce((sum, risk) => sum + (risk.residualScore ?? risk.inherentScore), 0);
  const residualCount = input.risks.filter((risk) => risk.residualScore !== null).length;
  const treatmentCoveragePercent = activeRiskCount === 0 ? 0 : Math.round((input.openTreatmentCount / activeRiskCount) * 100);
  const controlEffectivenessPercent = input.controlProfileCount === 0 ? 0 : Math.round((input.effectiveControlCount / input.controlProfileCount) * 100);
  const levelDistribution: Record<string, number> = {};
  const categoryDistribution: Record<string, number> = {};
  for (const risk of input.risks) {
    const score = risk.residualScore ?? risk.inherentScore;
    const level = levelForScore(score);
    levelDistribution[level] = (levelDistribution[level] ?? 0) + 1;
    categoryDistribution[risk.category] = (categoryDistribution[risk.category] ?? 0) + 1;
  }
  return {
    generatedAt: asOf.toISOString(),
    activeRiskCount,
    totalExposure,
    averageExposure: activeRiskCount === 0 ? 0 : Math.round((totalExposure / activeRiskCount) * 10) / 10,
    appetiteBreachCount: input.appetiteBreachCount,
    overdueReviewCount: input.risks.filter((risk) => risk.nextReviewDate < asOf).length,
    openTreatmentCount: input.openTreatmentCount,
    treatmentActionCount: input.treatmentActionCount,
    overdueActionCount: input.overdueActionCount,
    controlProfileCount: input.controlProfileCount,
    effectiveControlCount: input.effectiveControlCount,
    treatmentCoveragePercent,
    controlEffectivenessPercent,
    levelDistribution,
    categoryDistribution,
    heatMap: buildHeatMap(input.risks),
    reconciliation: { registerCount: activeRiskCount, scoredRiskCount: scoredRisks.length, unscoredRiskCount: activeRiskCount - scoredRisks.length, residualCount, inherentOnlyCount: activeRiskCount - residualCount },
  };
}

export async function getPortfolioAnalytics(tenantId: string, asOf = new Date()) {
  const [risks, appetiteBreachCount, openTreatmentCount, treatmentActionCount, overdueActionCount, controlProfileCount, effectiveControlCount] = await Promise.all([
    db.risk.findMany({ where: { tenantId, deletedAt: null }, select: { id: true, category: true, inherentLikelihood: true, inherentImpact: true, inherentScore: true, residualLikelihood: true, residualImpact: true, residualScore: true, nextReviewDate: true } }),
    db.appetiteBreach.count({ where: { tenantId, status: { in: ["OPEN", "ACKNOWLEDGED", "TREATING"] } } }),
    db.treatmentPlan.count({ where: { tenantId, status: "APPROVED" } }),
    db.treatmentAction.count({ where: { tenantId, status: { not: "COMPLETED" } } }),
    db.treatmentAction.count({ where: { tenantId, status: { in: ["NOT_STARTED", "IN_PROGRESS", "BLOCKED"] }, dueDate: { lt: asOf } } }),
    db.controlProfile.count({ where: { tenantId } }),
    db.controlProfile.count({ where: { tenantId, effectiveness: "EFFECTIVE" } }),
  ]);
  return calculatePortfolioAnalytics({ risks, appetiteBreachCount, openTreatmentCount, treatmentActionCount, overdueActionCount, controlProfileCount, effectiveControlCount, asOf });
}
