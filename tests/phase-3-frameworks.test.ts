import assert from "node:assert/strict";
import test from "node:test";
import { frameworkCatalog, frameworkChangelog, planFrameworkLimit, planMappingLimit } from "@/lib/frameworks";
import { gapAnalysisPdf, gapAnalysisWorkbook, riskCsv, riskPdf, riskWorkbook } from "@/lib/reporting";
import { calculatePortfolioAnalytics } from "@/lib/analytics";

test("framework catalogue carries complete governance metadata and disclaimers", () => {
  assert.equal(frameworkCatalog.length >= 5, true);

  const expectedNames = [
    "ISO 27001",
    "NIST Cybersecurity Framework",
    "SOC 2",
    "Healthcare (HIPAA Security Rule)",
    "Fintech & Payments",
  ];

  for (const name of expectedNames) {
    const item = frameworkCatalog.find((f) => f.name === name);
    assert.ok(item, `Catalogue missing ${name}`);
    assert.ok(item.version, `${name} missing version`);
    assert.ok(item.description, `${name} missing description`);
    assert.ok(item.sourceUrl?.startsWith("https://"), `${name} missing valid sourceUrl`);
    assert.ok(item.contentOwner, `${name} missing contentOwner`);
    assert.ok(item.applicability, `${name} missing applicability disclaimer`);
    assert.ok(item.publicationDate instanceof Date, `${name} missing publicationDate`);
    assert.ok(item.lastReviewedAt instanceof Date, `${name} missing lastReviewedAt`);
    assert.equal(item.controls.length > 0, true, `${name} missing controls`);
  }
});

test("framework changelog records version history and authoritative sources", () => {
  assert.equal(frameworkChangelog.length >= 5, true);

  for (const entry of frameworkChangelog) {
    assert.ok(entry.frameworkName, "Entry missing frameworkName");
    assert.ok(entry.version, "Entry missing version");
    assert.ok(entry.releasedAt, "Entry missing releasedAt");
    assert.ok(entry.sourceAuthority, "Entry missing sourceAuthority");
    assert.ok(entry.summary.length > 20, "Entry missing detailed summary");
  }
});

test("framework and mapping limits enforce documented tier budgets", () => {
  assert.equal(planFrameworkLimit.FREE, 1);
  assert.equal(planFrameworkLimit.BASIC, 2);
  assert.equal(planFrameworkLimit.PROFESSIONAL, 5);
  assert.equal(planFrameworkLimit.PREMIUM, 5);

  assert.equal(planMappingLimit.FREE, 25);
  assert.equal(planMappingLimit.BASIC, 100);
  assert.equal(Number.isFinite(planMappingLimit.PROFESSIONAL), false);
  assert.equal(Number.isFinite(planMappingLimit.PREMIUM), false);
});

test("portfolio analytics calculates taxonomy distributions with human-readable joins", () => {
  const analytics = calculatePortfolioAnalytics({
    risks: [
      {
        id: "r-1",
        category: "OPERATIONAL",
        businessUnit: { name: "Payments Engineering" },
        objective: { name: "99.99% Core Uptime" },
        inherentLikelihood: 4,
        inherentImpact: 4,
        inherentScore: 16,
        residualLikelihood: 2,
        residualImpact: 3,
        residualScore: 6,
        nextReviewDate: new Date("2026-10-01"),
      },
      {
        id: "r-2",
        category: "SECURITY",
        businessUnit: { name: "Security Operations" },
        objective: { name: "Zero Uncontained Breaches" },
        inherentLikelihood: 5,
        inherentImpact: 4,
        inherentScore: 20,
        residualLikelihood: 3,
        residualImpact: 4,
        residualScore: 12,
        nextReviewDate: new Date("2026-11-01"),
      },
      {
        id: "r-3",
        category: "FINANCIAL",
        businessUnit: { name: "Payments Engineering" },
        objective: null,
        inherentLikelihood: 3,
        inherentImpact: 2,
        inherentScore: 6,
        residualLikelihood: null,
        residualImpact: null,
        residualScore: null,
        nextReviewDate: new Date("2026-07-01"),
      },
    ],
    appetiteBreachCount: 1,
    openTreatmentCount: 2,
    treatmentActionCount: 3,
    overdueActionCount: 0,
    controlProfileCount: 4,
    effectiveControlCount: 3,
    asOf: new Date("2026-08-30"),
  });

  assert.equal(analytics.activeRiskCount, 3);
  assert.equal(analytics.businessUnitDistribution?.["Payments Engineering"], 2);
  assert.equal(analytics.businessUnitDistribution?.["Security Operations"], 1);
  assert.equal(analytics.objectiveDistribution?.["99.99% Core Uptime"], 1);
  assert.equal(analytics.objectiveDistribution?.["Zero Uncontained Breaches"], 1);
  assert.equal(analytics.overdueReviewCount, 1);
});
