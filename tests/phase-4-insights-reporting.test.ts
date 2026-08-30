import assert from "node:assert/strict";
import test from "node:test";
import { backoffDelayMs, isDue, retryJob } from "@/lib/jobs";
import { LocalReportStorageAdapter } from "@/lib/report-storage";
import { hashToken } from "@/lib/tokens";
import { tokenIsUsable } from "@/lib/token-policy";
import { calculatePortfolioAnalytics } from "@/lib/analytics";

test("jobs: exponential backoff doubles delay and caps at one hour", () => {
  assert.equal(backoffDelayMs(1, 1000), 1000);
  assert.equal(backoffDelayMs(2, 1000), 2000);
  assert.equal(backoffDelayMs(3, 1000), 4000);
  assert.equal(backoffDelayMs(4, 1000), 8000);
  assert.equal(backoffDelayMs(20, 1000, 3600000), 3600000);
});

test("jobs: isDue accurately evaluates claimability against current time", () => {
  const now = new Date("2026-08-30T12:00:00Z");
  assert.equal(isDue({ status: "QUEUED", runAfter: new Date("2026-08-30T11:59:59Z") }, now), true);
  assert.equal(isDue({ status: "QUEUED", runAfter: new Date("2026-08-30T12:00:00Z") }, now), true);
  assert.equal(isDue({ status: "QUEUED", runAfter: new Date("2026-08-30T12:00:01Z") }, now), false);
  assert.equal(isDue({ status: "PROCESSING" as never, runAfter: new Date("2026-08-30T11:00:00Z") }, now), false);
});

test("jobs: retryJob resets failed work to QUEUED state within tenant boundary", async () => {
  const updated: Array<{ where: unknown; data: unknown }> = [];
  const fakeDb = {
    job: {
      findFirst: async (args: { where: { id: string; tenantId: string } }) => {
        if (args.where.id === "job-1" && args.where.tenantId === "tenant-a") {
          return { id: "job-1", tenantId: "tenant-a", type: "REPORT_EXPORT", status: "FAILED" };
        }
        return null;
      },
      update: async (args: { where: unknown; data: unknown }) => {
        updated.push(args);
        return { id: "job-1", status: "QUEUED" };
      },
    },
  } as never;

  const success = await retryJob(fakeDb, "job-1", "tenant-a");
  assert.ok(success);
  assert.equal(updated.length, 1);

  // Cross-tenant attempt returns null
  const crossTenant = await retryJob(fakeDb, "job-1", "tenant-b");
  assert.equal(crossTenant, null);
});

test("report storage adapter calculates SHA-256 checksum, size, and enforces tenant isolation", async () => {
  const storage = new LocalReportStorageAdapter();
  const data = Buffer.from("test report binary content for beyondbeams grc");

  const result = await storage.putReport({
    tenantId: "tenant-1",
    exportId: "export-101",
    fileName: "risk-register.csv",
    mimeType: "text/csv",
    data,
  });

  assert.ok(result.storageKey.startsWith("reports/tenant-1/"));
  assert.equal(result.sizeBytes, data.byteLength);
  assert.equal(result.checksum.length, 64); // SHA-256 hex length

  // Correct tenant retrieves report data
  const retrieved = await storage.getReport(result.storageKey, "tenant-1");
  assert.ok(retrieved);
  assert.equal(retrieved.toString(), data.toString());

  // Cross-tenant retrieval is strictly denied
  const denied = await storage.getReport(result.storageKey, "tenant-2");
  assert.equal(denied, null);

  // Cross-tenant deletion is strictly denied
  const deleteDenied = await storage.deleteReport(result.storageKey, "tenant-2");
  assert.equal(deleteDenied, false);

  // Correct tenant deletes report
  const deleted = await storage.deleteReport(result.storageKey, "tenant-1");
  assert.equal(deleted, true);
});

test("single-use report tokens reject expired and consumed tokens with one-way hashing", () => {
  const rawToken = "test_download_token_123456789";
  const hash1 = hashToken(rawToken);
  const hash2 = hashToken(rawToken);
  assert.equal(hash1, hash2);

  const now = new Date("2026-08-30T12:00:00Z");
  const validExpiry = new Date("2026-08-30T13:00:00Z");
  const expiredDate = new Date("2026-08-30T11:00:00Z");

  // Unconsumed and unexpired -> usable
  assert.equal(tokenIsUsable(validExpiry, false, now), true);

  // Consumed -> rejected
  assert.equal(tokenIsUsable(validExpiry, true, now), false);

  // Expired -> rejected
  assert.equal(tokenIsUsable(expiredDate, false, now), false);
});

test("analytics snapshot metrics reconcile counts, exposures, and distributions", () => {
  const analytics = calculatePortfolioAnalytics({
    risks: [
      {
        id: "r-1",
        category: "OPERATIONAL",
        businessUnit: { name: "Treasury" },
        objective: { name: "Liquidity Resilience" },
        inherentLikelihood: 5,
        inherentImpact: 4,
        inherentScore: 20,
        residualLikelihood: 3,
        residualImpact: 3,
        residualScore: 9,
        nextReviewDate: new Date("2026-09-15"),
      },
      {
        id: "r-2",
        category: "CYBERSECURITY",
        businessUnit: { name: "Infosec" },
        objective: { name: "Zero Breaches" },
        inherentLikelihood: 4,
        inherentImpact: 5,
        inherentScore: 20,
        residualLikelihood: null,
        residualImpact: null,
        residualScore: null,
        nextReviewDate: new Date("2026-08-01"), // overdue
      },
    ],
    appetiteBreachCount: 1,
    openTreatmentCount: 1,
    treatmentActionCount: 2,
    overdueActionCount: 1,
    controlProfileCount: 3,
    effectiveControlCount: 2,
    asOf: new Date("2026-08-30"),
  });

  assert.equal(analytics.activeRiskCount, 2);
  assert.equal(analytics.totalExposure, 29); // 9 (residual) + 20 (inherent fallback)
  assert.equal(analytics.reconciliation.residualCount, 1);
  assert.equal(analytics.reconciliation.inherentOnlyCount, 1);
  assert.equal(analytics.reconciliation.scoredRiskCount, 2);
  assert.equal(analytics.overdueReviewCount, 1);
  assert.equal(analytics.treatmentCoveragePercent, 50);
  assert.equal(analytics.controlEffectivenessPercent, 67);
  assert.equal(analytics.businessUnitDistribution?.["Treasury"], 1);
  assert.equal(analytics.businessUnitDistribution?.["Infosec"], 1);
});
