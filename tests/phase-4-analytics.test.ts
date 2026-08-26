import assert from "node:assert/strict";
import test from "node:test";
import { buildHeatMap, calculatePortfolioAnalytics, levelForScore } from "@/lib/analytics";

const date = new Date("2026-08-26T12:00:00.000Z");

test("score bands are deterministic and explicit", () => {
  assert.equal(levelForScore(1), "Low");
  assert.equal(levelForScore(7), "Moderate");
  assert.equal(levelForScore(15), "High");
  assert.equal(levelForScore(20), "Critical");
});

test("heat map places inherent and residual risks in stable cells", () => {
  const risks = [{ id: "risk-1", inherentLikelihood: 2, inherentImpact: 3, residualLikelihood: 1, residualImpact: 2 }, { id: "risk-2", inherentLikelihood: 4, inherentImpact: 4, residualLikelihood: null, residualImpact: null }];
  assert.equal(buildHeatMap(risks, "INHERENT").find((cell) => cell.likelihood === 2 && cell.impact === 3)?.riskIds[0], "risk-1");
  assert.equal(buildHeatMap(risks, "RESIDUAL").find((cell) => cell.likelihood === 1 && cell.impact === 2)?.count, 1);
  assert.equal(buildHeatMap(risks, "RESIDUAL").find((cell) => cell.likelihood === 4 && cell.impact === 4)?.riskIds[0], "risk-2");
});

test("portfolio analytics reconciles empty and populated registers", () => {
  const empty = calculatePortfolioAnalytics({ risks: [], appetiteBreachCount: 0, openTreatmentCount: 0, treatmentActionCount: 0, overdueActionCount: 0, controlProfileCount: 0, effectiveControlCount: 0, asOf: date });
  assert.equal(empty.averageExposure, 0);
  assert.equal(empty.reconciliation.unscoredRiskCount, 0);
  const populated = calculatePortfolioAnalytics({ risks: [{ id: "risk-1", category: "CYBERSECURITY", inherentLikelihood: 4, inherentImpact: 4, inherentScore: 16, residualLikelihood: 2, residualImpact: 3, residualScore: 6, nextReviewDate: new Date("2026-08-25T12:00:00.000Z") }], appetiteBreachCount: 1, openTreatmentCount: 1, treatmentActionCount: 2, overdueActionCount: 1, controlProfileCount: 2, effectiveControlCount: 1, asOf: date });
  assert.equal(populated.totalExposure, 6);
  assert.equal(populated.overdueReviewCount, 1);
  assert.equal(populated.treatmentCoveragePercent, 100);
  assert.equal(populated.controlEffectivenessPercent, 50);
  assert.equal(populated.levelDistribution.Low, 1);
});
