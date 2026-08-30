import assert from "node:assert/strict";
import test from "node:test";
import { formatLogEntry, redactSensitive } from "@/lib/logger";
import { metrics, recordLoginAttempt, recordReportGeneration, recordJobExecution, recordNotificationDelivery } from "@/lib/metrics";
import { runTenantRetentionCleanup } from "@/lib/retention";

test("logger: redacts sensitive keys, tokens, and credentials recursively", () => {
  const payload = {
    userId: "usr-123",
    authToken: "raw_secret_bearer_token_xyz",
    password: "SuperSecretPassword123!",
    apiSecret: "sk_live_1234567890",
    nested: {
      invitationUrl: "https://grc.example.com/invite/tok_abc",
      downloadUrl: "https://grc.example.com/api/reports/download/tok_xyz",
      magicLink: "https://grc.example.com/magic-link?token=abc",
      safeField: "safe value",
    },
  };

  const redacted = redactSensitive(payload);

  assert.equal((redacted as Record<string, unknown>).authToken, "[REDACTED]");
  assert.equal((redacted as Record<string, unknown>).password, "[REDACTED]");
  assert.equal((redacted as Record<string, unknown>).apiSecret, "[REDACTED]");
  assert.equal((redacted as { nested: Record<string, unknown> }).nested.safeField, "safe value");

  // Output formatted JSON entry
  const json = formatLogEntry("info", "Test operation", payload);
  const parsed = JSON.parse(json);
  assert.equal(parsed.level, "info");
  assert.equal(parsed.authToken, "[REDACTED]");
  assert.equal(parsed.password, "[REDACTED]");
});

test("metrics: records operation counters and aggregates snapshot correctly", () => {
  metrics.reset();

  recordLoginAttempt("SUCCESS", "CREDENTIALS");
  recordLoginAttempt("FAILURE", "MAGIC_LINK");
  recordReportGeneration("RISK_REGISTER", "PDF", true);
  recordReportGeneration("GAP_ANALYSIS", "XLSX", false);
  recordJobExecution("REPORT_EXPORT", "COMPLETED");
  recordNotificationDelivery("EXPORT_DELIVERY", "SENT");

  const snapshot = metrics.getSnapshot();

  assert.ok(snapshot.uptimeSeconds >= 0);
  assert.equal(snapshot.counters['auth_login_attempts_total{method="CREDENTIALS",status="SUCCESS"}'], 1);
  assert.equal(snapshot.counters['auth_login_attempts_total{method="MAGIC_LINK",status="FAILURE"}'], 1);
  assert.equal(snapshot.counters['report_generations_total{format="PDF",status="SUCCESS",type="RISK_REGISTER"}'], 1);
  assert.equal(snapshot.counters['job_executions_total{status="COMPLETED",type="REPORT_EXPORT"}'], 1);
  assert.equal(snapshot.counters['notification_deliveries_total{status="SENT",type="EXPORT_DELIVERY"}'], 1);
});

test("retention engine: preserves soft-deleted records when legalHold is active", async () => {
  let riskDeleted = false;
  let reportsPurged = false;

  const fakeDb = {
    tenant: {
      findUnique: async () => ({
        id: "tenant-hold",
        name: "Acme Legal Corp",
        legalHold: true,
        retentionDays: 30,
      }),
    },
    exportHistory: {
      findMany: async () => [{ id: "exp-1", storageKey: "reports/tenant-hold/exp-1.pdf" }],
      updateMany: async () => { reportsPurged = true; return { count: 1 }; },
    },
    verificationToken: {
      count: async () => 2,
      deleteMany: async () => ({ count: 2 }),
    },
    risk: {
      findMany: async () => [{ id: "r-deleted" }],
      deleteMany: async () => { riskDeleted = true; return { count: 1 }; },
    },
    auditEvent: {
      create: async () => ({ id: "audit-1" }),
    },
  } as never;

  const result = await runTenantRetentionCleanup(fakeDb, "tenant-hold", { dryRun: false });

  assert.equal(result.legalHold, true);
  assert.equal(result.purgedReports, 1);
  assert.equal(result.purgedTokens, 2);
  assert.equal(result.purgedSoftDeletedRisks, 0); // Preserved due to legal hold
  assert.equal(riskDeleted, false); // Risk was not deleted
  assert.equal(reportsPurged, true);
});

test("retention engine: purges soft-deleted records when legalHold is off and window expired", async () => {
  let riskDeleted = false;

  const fakeDb = {
    tenant: {
      findUnique: async () => ({
        id: "tenant-clean",
        name: "Standard Tenant",
        legalHold: false,
        retentionDays: 30,
      }),
    },
    exportHistory: {
      findMany: async () => [],
      updateMany: async () => ({ count: 0 }),
    },
    verificationToken: {
      count: async () => 0,
      deleteMany: async () => ({ count: 0 }),
    },
    risk: {
      findMany: async () => [{ id: "r-deleted-old" }],
      deleteMany: async () => { riskDeleted = true; return { count: 1 }; },
    },
    auditEvent: {
      create: async () => ({ id: "audit-2" }),
    },
  } as never;

  const result = await runTenantRetentionCleanup(fakeDb, "tenant-clean", { dryRun: false });

  assert.equal(result.legalHold, false);
  assert.equal(result.purgedSoftDeletedRisks, 1);
  assert.equal(riskDeleted, true);
});
