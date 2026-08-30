import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import path from "node:path";
import { after, before, test } from "node:test";
import { Role, type PrismaClient } from "@prisma/client";
import { activeMembershipWhere, deleteTenantRisk, tenantRiskWhere, updateTenantRisk } from "@/lib/tenant-access";
import { tokenIsUsable } from "@/lib/token-policy";
import { hasPermission, permissionMatrix, type Permission } from "@/lib/security";
import { uiCapabilities } from "@/lib/ui-capabilities";
import { writeRoles, deleteRoles } from "@/lib/authz";
import { auditExportRoles, exportRoles } from "@/lib/reporting";
import { canManageFramework } from "@/lib/frameworks";
import { backoffDelayMs, claimJobs, completeJob, enqueueJob, failJob, isDue, runDueJobs } from "@/lib/jobs";
import { addMonths, canTransitionReassessment, isScheduleDue, nextReviewDateFrom, scheduleFromOutcome, shouldRequestReassessment } from "@/lib/review-workflow";

const testDbFile = "file:./test-phase-2-integration.db";
const testDbPath = path.join(process.cwd(), "prisma", "test-phase-2-integration.db");

// The Prisma client reads DATABASE_URL at construction time, so it must be
// loaded (dynamically) only after the environment override below.
let db!: PrismaClient;

function pushSchema() {
  execFileSync(process.execPath, [
    path.join(process.cwd(), "node_modules", "prisma", "build", "index.js"),
    "db", "push", "--schema", "prisma/schema.prisma", "--skip-generate",
  ], { env: { ...process.env, DATABASE_URL: testDbFile }, stdio: "pipe" });
}

const tenants = { a: { id: "tenant-a", name: "Alpha", slug: "alpha" }, b: { id: "tenant-b", name: "Beta", slug: "beta" } };
const users = {
  owner: { id: "user-owner", tenantId: "tenant-a", email: "owner@alpha.test", name: "Owner" },
  manager: { id: "user-manager", tenantId: "tenant-a", email: "manager@alpha.test", name: "Manager" },
  assessor: { id: "user-assessor", tenantId: "tenant-a", email: "assessor@alpha.test", name: "Assessor" },
  viewer: { id: "user-viewer", tenantId: "tenant-a", email: "viewer@alpha.test", name: "Viewer" },
  auditor: { id: "user-auditor", tenantId: "tenant-a", email: "auditor@alpha.test", name: "Auditor" },
  pending: { id: "user-pending", tenantId: "tenant-a", email: "pending@alpha.test", name: "Pending" },
  expired: { id: "user-expired", tenantId: "tenant-a", email: "expired@alpha.test", name: "Expired" },
  otherOwner: { id: "user-b-owner", tenantId: "tenant-b", email: "owner@beta.test", name: "Beta Owner" },
};
const risks = { active: { id: "risk-a", reference: "RISK-001" }, deleted: { id: "risk-a-deleted", reference: "RISK-002" }, otherTenant: { id: "risk-b", reference: "RISK-B-001" } };

async function seed() {
  await db.tenant.createMany({ data: Object.values(tenants) });
  await db.user.createMany({
    data: Object.values(users).map((user) => ({ id: user.id, tenantId: user.tenantId, email: user.email, name: user.name, passwordHash: "not-a-real-hash" })),
  });
  await db.membership.createMany({
    data: [
      { id: "membership-owner", tenantId: "tenant-a", userId: users.owner.id, role: Role.OWNER, acceptedAt: new Date("2026-01-01") },
      { id: "membership-manager", tenantId: "tenant-a", userId: users.manager.id, role: Role.RISK_MANAGER, acceptedAt: new Date("2026-01-01") },
      { id: "membership-assessor", tenantId: "tenant-a", userId: users.assessor.id, role: Role.ASSESSOR, acceptedAt: new Date("2026-01-01") },
      { id: "membership-viewer", tenantId: "tenant-a", userId: users.viewer.id, role: Role.VIEWER, acceptedAt: new Date("2026-01-01") },
      { id: "membership-auditor", tenantId: "tenant-a", userId: users.auditor.id, role: Role.AUDITOR, acceptedAt: new Date("2026-01-01") },
      { id: "membership-pending", tenantId: "tenant-a", userId: users.pending.id, role: Role.VIEWER, inviteToken: "invite-token-active", inviteExpires: new Date("2026-12-31"), acceptedAt: null },
      { id: "membership-expired", tenantId: "tenant-a", userId: users.expired.id, role: Role.VIEWER, inviteToken: "invite-token-expired", inviteExpires: new Date("2026-01-01"), acceptedAt: null },
      { id: "membership-b-owner", tenantId: "tenant-b", userId: users.otherOwner.id, role: Role.OWNER, acceptedAt: new Date("2026-01-01") },
    ],
  });
  const riskBase = { title: "Risk", description: "A seeded risk", category: "CYBERSECURITY" as const, inherentLikelihood: 3, inherentImpact: 3, inherentScore: 9, nextReviewDate: new Date("2026-12-31") };
  await db.risk.createMany({
    data: [
      { ...riskBase, id: risks.active.id, tenantId: "tenant-a", reference: risks.active.reference, ownerId: users.owner.id },
      { ...riskBase, id: risks.deleted.id, tenantId: "tenant-a", reference: risks.deleted.reference, ownerId: users.owner.id, deletedAt: new Date("2026-07-01") },
      { ...riskBase, id: risks.otherTenant.id, tenantId: "tenant-b", reference: risks.otherTenant.reference, ownerId: users.otherOwner.id },
    ],
  });
  await db.assessment.createMany({
    data: [
      { id: "assessment-a", tenantId: "tenant-a", riskId: risks.active.id, type: "INHERENT", revision: 1, likelihood: 3, impact: 3, score: 9, rationale: "Seeded inherent assessment", status: "APPROVED", authorId: users.assessor.id },
      { id: "assessment-b", tenantId: "tenant-b", riskId: risks.otherTenant.id, type: "INHERENT", revision: 1, likelihood: 2, impact: 2, score: 4, rationale: "Cross-tenant assessment", status: "APPROVED", authorId: users.otherOwner.id },
    ],
  });
  await db.treatmentPlan.createMany({
    data: [
      { id: "plan-a", tenantId: "tenant-a", riskId: risks.active.id, strategy: "MITIGATE", summary: "Mitigate active risk", targetDate: new Date("2026-12-31"), status: "APPROVED", createdById: users.manager.id },
      { id: "plan-b", tenantId: "tenant-b", riskId: risks.otherTenant.id, strategy: "ACCEPT", summary: "Accept beta risk", targetDate: new Date("2026-12-31"), status: "APPROVED", createdById: users.otherOwner.id },
    ],
  });
  await db.treatmentAction.createMany({
    data: [
      { id: "action-a", tenantId: "tenant-a", treatmentPlanId: "plan-a", title: "Action A", description: "First action", ownerId: users.assessor.id, dueDate: new Date("2026-12-31"), status: "IN_PROGRESS" },
      { id: "action-b", tenantId: "tenant-b", treatmentPlanId: "plan-b", title: "Action B", description: "Beta action", ownerId: users.otherOwner.id, dueDate: new Date("2026-12-31"), status: "NOT_STARTED" },
    ],
  });
  await db.framework.createMany({
    data: [
      { id: "framework-iso", name: "ISO/IEC 27001:2022", version: "2022", description: "Information Security Management", industryTags: "General, Cloud" },
    ],
  });
  await db.frameworkControl.createMany({
    data: [
      { id: "control-a51", frameworkId: "framework-iso", controlId: "A.5.1", title: "Policies for information security", description: "Security policy definition", category: "Organizational" },
    ],
  });
  await db.tenantFramework.createMany({
    data: [
      { id: "tf-a", tenantId: "tenant-a", frameworkId: "framework-iso", enabled: true },
      { id: "tf-b", tenantId: "tenant-b", frameworkId: "framework-iso", enabled: false },
    ],
  });
  await db.controlProfile.createMany({
    data: [
      { id: "profile-a", tenantId: "tenant-a", frameworkControlId: "control-a51", ownerId: users.manager.id, implementationStatus: "IMPLEMENTED", effectiveness: "EFFECTIVE" },
      { id: "profile-b", tenantId: "tenant-b", frameworkControlId: "control-a51", ownerId: users.otherOwner.id, implementationStatus: "NOT_STARTED", effectiveness: "NOT_ASSESSED" },
    ],
  });
  await db.controlTest.createMany({
    data: [
      { id: "test-a", tenantId: "tenant-a", controlProfileId: "profile-a", testDate: new Date("2026-06-01"), result: "PASS", testerId: users.assessor.id, notes: "All controls verified" },
    ],
  });
  await db.evidence.createMany({
    data: [
      { id: "evidence-a", tenantId: "tenant-a", title: "Policy document", storageKey: "tenant-a/policy.pdf", uploadedById: users.assessor.id, status: "APPROVED", riskId: risks.active.id },
      { id: "evidence-b", tenantId: "tenant-b", title: "Beta evidence", storageKey: "tenant-b/proof.pdf", uploadedById: users.otherOwner.id, status: "DRAFT", riskId: risks.otherTenant.id },
    ],
  });
  await db.taxonomyItem.createMany({
    data: [
      { id: "taxonomy-a", tenantId: "tenant-a", type: "BUSINESS_UNIT", name: "Engineering", active: true },
      { id: "taxonomy-b", tenantId: "tenant-b", type: "BUSINESS_UNIT", name: "Beta Ops", active: true },
    ],
  });
  await db.appetiteStatement.createMany({
    data: [
      { id: "appetite-a", tenantId: "tenant-a", name: "Cyber Exposure Ceiling", maximumScore: 12, rationale: "Zero tolerance for critical exposures", effectiveFrom: new Date("2026-01-01"), active: true },
      { id: "appetite-b", tenantId: "tenant-b", name: "Beta Appetite", maximumScore: 16, rationale: "Beta workspace appetite", effectiveFrom: new Date("2026-01-01"), active: true },
    ],
  });
  await db.exportHistory.createMany({
    data: [
      { id: "export-valid", tenantId: "tenant-a", generatedById: users.owner.id, reportType: "RISK_REGISTER", format: "CSV", fileName: "risk-register.csv", status: "COMPLETED", downloadTokenHash: "hash-valid", downloadExpires: new Date("2026-12-31"), downloadedAt: null },
      { id: "export-consumed", tenantId: "tenant-a", generatedById: users.owner.id, reportType: "RISK_REGISTER", format: "CSV", fileName: "risk-register.csv", status: "COMPLETED", downloadTokenHash: "hash-consumed", downloadExpires: new Date("2026-12-31"), downloadedAt: new Date("2026-08-01") },
      { id: "export-expired", tenantId: "tenant-a", generatedById: users.owner.id, reportType: "RISK_REGISTER", format: "CSV", fileName: "risk-register.csv", status: "COMPLETED", downloadTokenHash: "hash-expired", downloadExpires: new Date("2026-01-01"), downloadedAt: null },
    ],
  });
}

before(async () => {
  process.env.DATABASE_URL = testDbFile;
  db = (await import("@/lib/db")).db;
  pushSchema();
  await seed();
});

after(async () => {
  await db.$disconnect();
  if (existsSync(testDbPath)) rmSync(testDbPath, { force: true });
});

const now = new Date("2026-08-27T12:00:00Z");

test("active membership resolves only accepted, token-free memberships for every role", async () => {
  const expectedRoles: Array<[string, Role]> = [
    [users.owner.id, Role.OWNER],
    [users.manager.id, Role.RISK_MANAGER],
    [users.assessor.id, Role.ASSESSOR],
    [users.viewer.id, Role.VIEWER],
    [users.auditor.id, Role.AUDITOR],
  ];
  for (const [userId, role] of expectedRoles) {
    const membership = await db.membership.findFirst({ where: activeMembershipWhere(userId, "tenant-a") });
    assert.ok(membership, `expected an active membership for ${role}`);
    assert.equal(membership.role, role);
  }
  for (const user of [users.pending, users.expired]) {
    const membership = await db.membership.findFirst({ where: activeMembershipWhere(user.id, "tenant-a") });
    assert.equal(membership, null, `${user.id} must not resolve an active session`);
  }
});

test("permission matrix and UI capabilities enforce strict boundary contracts for all 5 roles", () => {
  const expectedRolePermissions: Record<Role, Permission[]> = {
    OWNER: [
      "risk:create", "risk:update", "risk:delete", "risk:read",
      "framework:manage", "mapping:manage", "member:manage", "audit:read",
      "report:export", "settings:manage", "assessment:approve", "treatment:manage",
      "treatment:approve", "control:manage", "evidence:manage", "appetite:manage", "taxonomy:manage",
    ],
    RISK_MANAGER: [
      "risk:create", "risk:update", "risk:delete", "risk:read",
      "framework:manage", "mapping:manage", "audit:read", "report:export",
      "assessment:approve", "treatment:manage", "treatment:approve", "control:manage",
      "evidence:manage", "appetite:manage", "taxonomy:manage",
    ],
    ASSESSOR: [
      "risk:create", "risk:update", "risk:read",
      "mapping:manage", "treatment:manage", "control:manage", "evidence:manage",
    ],
    VIEWER: [
      "risk:read",
    ],
    AUDITOR: [
      "risk:read", "audit:read", "report:export",
    ],
  };

  const allPermissions: Permission[] = [
    "risk:create", "risk:update", "risk:delete", "risk:read",
    "framework:manage", "mapping:manage", "member:manage", "audit:read",
    "report:export", "settings:manage", "assessment:approve", "treatment:manage",
    "treatment:approve", "control:manage", "evidence:manage", "appetite:manage", "taxonomy:manage",
  ];

  for (const [role, allowed] of Object.entries(expectedRolePermissions) as [Role, Permission[]][]) {
    for (const permission of allPermissions) {
      const expected = allowed.includes(permission);
      assert.equal(hasPermission(role, permission), expected, `${role} ${permission} must be ${expected}`);
    }

    const capabilities = uiCapabilities(role);
    for (const permission of allPermissions) {
      assert.equal(capabilities[permission], allowed.includes(permission), `uiCapabilities(${role})[${permission}] must match hasPermission`);
    }
  }

  // Server role group definitions
  assert.deepEqual(writeRoles, [Role.OWNER, Role.RISK_MANAGER, Role.ASSESSOR]);
  assert.deepEqual(deleteRoles, [Role.OWNER, Role.RISK_MANAGER]);
  assert.deepEqual(auditExportRoles, ["OWNER", "AUDITOR", "RISK_MANAGER"]);
  assert.deepEqual(exportRoles, ["OWNER", "RISK_MANAGER", "ASSESSOR", "VIEWER", "AUDITOR"]);
  assert.equal(canManageFramework(Role.OWNER), true);
  assert.equal(canManageFramework(Role.RISK_MANAGER), true);
  assert.equal(canManageFramework(Role.ASSESSOR), false);
  assert.equal(canManageFramework(Role.VIEWER), false);
  assert.equal(canManageFramework(Role.AUDITOR), false);
});

test("risk predicates exclude cross-tenant records and soft-deleted rows at the database level", async () => {
  assert.equal(await db.risk.findFirst({ where: tenantRiskWhere("tenant-a", risks.otherTenant.id) }), null);
  assert.equal(await db.risk.findFirst({ where: tenantRiskWhere("tenant-b", risks.active.id) }), null);
  assert.equal(await db.risk.findFirst({ where: tenantRiskWhere("tenant-a", risks.deleted.id) }), null);
  const activeRisks = await db.risk.findMany({ where: tenantRiskWhere("tenant-a") });
  assert.deepEqual(activeRisks.map((risk) => risk.id), [risks.active.id]);
  assert.equal(await db.risk.findFirst({ where: tenantRiskWhere("tenant-a", "does-not-exist") }), null);
});

test("tenant-scoped risk mutations are no-ops for cross-tenant and soft-deleted targets", async () => {
  assert.equal((await updateTenantRisk(db, "tenant-a", risks.otherTenant.id, "attempted")).count, 0);
  assert.equal((await updateTenantRisk(db, "tenant-a", risks.deleted.id, "attempted")).count, 0);
  assert.equal((await updateTenantRisk(db, "tenant-a", "does-not-exist", "attempted")).count, 0);
  assert.equal((await deleteTenantRisk(db, "tenant-a", risks.otherTenant.id)).count, 0);
  const unchanged = await db.risk.findFirst({ where: { id: risks.otherTenant.id } });
  assert.equal(unchanged?.title, "Risk");
});

test("cross-tenant isolation covers all Phase 2 entities (assessments, plans, actions, controls, tests, evidence, appetite, taxonomy)", async () => {
  // Assessments
  assert.equal(await db.assessment.findFirst({ where: { id: "assessment-b", tenantId: "tenant-a" } }), null);
  assert.equal(await db.assessment.findFirst({ where: { id: "assessment-a", tenantId: "tenant-b" } }), null);
  assert.equal(await db.assessment.findFirst({ where: { id: "does-not-exist", tenantId: "tenant-a" } }), null);

  // Treatment Plans & Actions
  assert.equal(await db.treatmentPlan.findFirst({ where: { id: "plan-b", tenantId: "tenant-a" } }), null);
  assert.equal(await db.treatmentPlan.findFirst({ where: { id: "plan-a", tenantId: "tenant-b" } }), null);
  assert.equal(await db.treatmentAction.findFirst({ where: { id: "action-b", tenantId: "tenant-a" } }), null);
  assert.equal(await db.treatmentAction.findFirst({ where: { id: "action-a", tenantId: "tenant-b" } }), null);

  // Control Profiles & Tests
  assert.equal(await db.controlProfile.findFirst({ where: { id: "profile-b", tenantId: "tenant-a" } }), null);
  assert.equal(await db.controlProfile.findFirst({ where: { id: "profile-a", tenantId: "tenant-b" } }), null);
  assert.equal(await db.controlTest.findFirst({ where: { id: "test-a", tenantId: "tenant-b" } }), null);

  // Evidence
  assert.equal(await db.evidence.findFirst({ where: { id: "evidence-b", tenantId: "tenant-a" } }), null);
  assert.equal(await db.evidence.findFirst({ where: { id: "evidence-a", tenantId: "tenant-b" } }), null);

  // Taxonomy & Appetite Statements
  assert.equal(await db.taxonomyItem.findFirst({ where: { id: "taxonomy-b", tenantId: "tenant-a" } }), null);
  assert.equal(await db.taxonomyItem.findFirst({ where: { id: "taxonomy-a", tenantId: "tenant-b" } }), null);
  assert.equal(await db.appetiteStatement.findFirst({ where: { id: "appetite-b", tenantId: "tenant-a" } }), null);
  assert.equal(await db.appetiteStatement.findFirst({ where: { id: "appetite-a", tenantId: "tenant-b" } }), null);
});

test("soft-deleted risks are protected from new child attachments and mutations", async () => {
  const deletedRisk = await db.risk.findFirst({ where: { id: risks.deleted.id, tenantId: "tenant-a" } });
  assert.ok(deletedRisk?.deletedAt !== null, "risk must be soft deleted");

  // tenantRiskWhere excludes it
  assert.equal(await db.risk.findFirst({ where: tenantRiskWhere("tenant-a", risks.deleted.id) }), null);

  // updateMany and deleteMany are no-ops
  const updateResult = await db.risk.updateMany({ where: tenantRiskWhere("tenant-a", risks.deleted.id), data: { title: "Mutated" } });
  assert.equal(updateResult.count, 0);

  const deleteResult = await db.risk.updateMany({ where: tenantRiskWhere("tenant-a", risks.deleted.id), data: { deletedAt: new Date() } });
  assert.equal(deleteResult.count, 0);
});

test("invalid identifiers return null across all queries safely", async () => {
  const invalidIds = ["", "invalid-cuid-123", "nonexistent-id-999999", "null", "undefined"];
  for (const id of invalidIds) {
    assert.equal(await db.risk.findFirst({ where: { id, tenantId: "tenant-a", deletedAt: null } }), null);
    assert.equal(await db.assessment.findFirst({ where: { id, tenantId: "tenant-a" } }), null);
    assert.equal(await db.treatmentPlan.findFirst({ where: { id, tenantId: "tenant-a" } }), null);
    assert.equal(await db.treatmentAction.findFirst({ where: { id, tenantId: "tenant-a" } }), null);
    assert.equal(await db.controlProfile.findFirst({ where: { id, tenantId: "tenant-a" } }), null);
    assert.equal(await db.evidence.findFirst({ where: { id, tenantId: "tenant-a" } }), null);
    assert.equal(await db.taxonomyItem.findFirst({ where: { id, tenantId: "tenant-a" } }), null);
    assert.equal(await db.reviewSchedule.findFirst({ where: { id, tenantId: "tenant-a" } }), null);
    assert.equal(await db.reassessmentRequest.findFirst({ where: { id, tenantId: "tenant-a" } }), null);
  }
});

test("single-use download tokens are validated against database state for valid, consumed, and expired rows", async () => {
  const valid = await db.exportHistory.findUniqueOrThrow({ where: { id: "export-valid" } });
  const consumed = await db.exportHistory.findUniqueOrThrow({ where: { id: "export-consumed" } });
  const expired = await db.exportHistory.findUniqueOrThrow({ where: { id: "export-expired" } });
  assert.equal(tokenIsUsable(valid.downloadExpires, valid.downloadedAt !== null, now), true);
  assert.equal(tokenIsUsable(consumed.downloadExpires, consumed.downloadedAt !== null, now), false);
  assert.equal(tokenIsUsable(expired.downloadExpires, expired.downloadedAt !== null, now), false);
  assert.equal(tokenIsUsable(valid.downloadExpires, true, now), false, "a replayed token is consumed after first use");
});

test("invitation tokens are usable only while unexpired and unconsumed", async () => {
  const pending = await db.membership.findUniqueOrThrow({ where: { id: "membership-pending" } });
  const expired = await db.membership.findUniqueOrThrow({ where: { id: "membership-expired" } });
  assert.equal(tokenIsUsable(pending.inviteExpires, pending.acceptedAt !== null, now), true);
  assert.equal(tokenIsUsable(expired.inviteExpires, expired.acceptedAt !== null, now), false);
  assert.equal(tokenIsUsable(pending.inviteExpires, true, now), false);
});

test("audit events are tenant-scoped and link to their source entity", async () => {
  await db.auditEvent.create({ data: { tenantId: "tenant-a", riskId: risks.active.id, actorId: users.owner.id, action: "UPDATE", entityType: "Risk", entityId: risks.active.id, summary: "Integration test event" } });
  assert.equal(await db.auditEvent.count({ where: { tenantId: "tenant-a", entityId: risks.active.id } }), 1);
  assert.equal(await db.auditEvent.count({ where: { tenantId: "tenant-b", entityId: risks.active.id } }), 0);
});

test("jobs: enqueue, claim only due work, and never double-claim", async () => {
  await db.job.deleteMany({ where: { tenantId: "tenant-a" } });
  await enqueueJob(db, { tenantId: "tenant-a", type: "REVIEW_REMINDER", payload: { riskId: risks.active.id }, runAfter: now });
  await enqueueJob(db, { tenantId: "tenant-a", type: "REVIEW_REMINDER", payload: { riskId: risks.active.id }, runAfter: new Date(now.getTime() + 60_000) });
  const claimed = await claimJobs(db, { tenantId: "tenant-a", now, workerId: "worker-test" });
  assert.equal(claimed.length, 1);
  assert.equal(claimed[0].lockedBy, "worker-test");
  const again = await claimJobs(db, { tenantId: "tenant-a", now, workerId: "worker-second" });
  assert.equal(again.length, 0, "a claimed job must not be handed to a second worker");
  const pending = await db.job.findFirst({ where: { tenantId: "tenant-a", status: "QUEUED" } });
  assert.equal(isDue(pending!, now), false, "future-dated jobs stay queued");
});

test("jobs: failed work retries with backoff and becomes terminal FAILED at max attempts", async () => {
  await db.job.deleteMany({ where: { tenantId: "tenant-a" } });
  const job = await enqueueJob(db, { tenantId: "tenant-a", type: "NOTIFICATION_DELIVERY", payload: { id: "message-1" }, maxAttempts: 2, runAfter: now });
  const first = await claimJobs(db, { tenantId: "tenant-a", now, workerId: "worker-backoff" });
  assert.equal(first.length, 1);
  await failJob(db, first[0].id, "provider rejected");
  const retried = await db.job.findUnique({ where: { id: job.id } });
  assert.equal(retried?.status, "QUEUED");
  assert.ok((retried?.runAfter.getTime() ?? 0) > now.getTime(), "retry is deferred by backoff");
  assert.equal(retried?.attempts, 1);
  assert.equal(backoffDelayMs(1), 1000);
  assert.equal(backoffDelayMs(4), 8000);
  const second = await claimJobs(db, { tenantId: "tenant-a", now: new Date(Date.now() + 120_000), workerId: "worker-backoff" });
  assert.equal(second.length, 1);
  await failJob(db, second[0].id, "provider rejected again");
  const terminal = await db.job.findUnique({ where: { id: job.id } });
  assert.equal(terminal?.status, "FAILED");
  assert.equal(terminal?.error, "provider rejected again");
});

test("jobs: runDueJobs completes successful handlers and runs are tenant-isolated", async () => {
  await db.job.deleteMany({ where: { tenantId: "tenant-a" } });
  await enqueueJob(db, { tenantId: "tenant-a", type: "REPORT_EXPORT", payload: { exportId: "export-a" }, runAfter: now });
  await enqueueJob(db, { tenantId: "tenant-b", type: "REPORT_EXPORT", payload: { exportId: "export-b" }, runAfter: now });
  const result = await runDueJobs(db, async ({ payload }) => ({ ok: (payload as { exportId: string }).exportId }), { tenantId: "tenant-a", now, workerId: "worker-run" });
  assert.equal(result.processed, 1, "only this tenant's due jobs are processed");
  assert.equal((await db.job.count({ where: { tenantId: "tenant-a", status: "COMPLETED", payloadJson: JSON.stringify({ exportId: "export-a" }) } })), 1);
  const otherPending = await db.job.findFirst({ where: { tenantId: "tenant-b", status: "QUEUED" } });
  assert.equal(isDue(otherPending!, now), true);
});

test("jobs: a throwing handler is requeued with an error attached, never lost", async () => {
  await db.job.deleteMany({ where: { tenantId: "tenant-a" } });
  await enqueueJob(db, { tenantId: "tenant-a", type: "REPORT_EXPORT", payload: { exportId: "explode" }, maxAttempts: 3, runAfter: now });
  const result = await runDueJobs(db, async () => { throw new Error("boom"); }, { tenantId: "tenant-a", now, workerId: "worker-fail" });
  assert.ok(result.results.some((item) => item.status === "RETRY"));
  const job = await db.job.findFirst({ where: { tenantId: "tenant-a", status: "QUEUED", payloadJson: JSON.stringify({ exportId: "explode" }) } });
  assert.equal(job?.error, "boom");
});

test("review workflow: scheduling, reassessment transitions, and outcome side effects are deterministic", async () => {
  assert.equal(shouldRequestReassessment("REASSESS"), true);
  assert.equal(shouldRequestReassessment("CONTINUE"), false);
  const next = nextReviewDateFrom(now, 3);
  assert.equal(next.getMonth(), 10, "August + 3 months is November (0-indexed)");
  assert.equal(canTransitionReassessment("OPEN", "IN_PROGRESS"), true);
  assert.equal(canTransitionReassessment("COMPLETED", "IN_PROGRESS"), false);
  assert.equal(canTransitionReassessment("OPEN", "COMPLETED"), false);
  const closed = scheduleFromOutcome({ active: true, cadenceMonths: 3 }, "CLOSE", new Date("2027-01-01"), now);
  assert.equal(closed.active, false);
  const reassess = scheduleFromOutcome(null, "REASSESS", new Date("2027-01-01"), now);
  assert.equal(reassess.active, true);
  assert.ok(reassess.nextDueAt.getTime() <= now.getTime() + 32 * 24 * 60 * 60 * 1000);
  assert.equal(isScheduleDue({ active: false, nextDueAt: new Date("2026-01-01") }, now), false);
  assert.equal(isScheduleDue({ active: true, nextDueAt: new Date("2026-01-01") }, now), true);
  assert.deepEqual(addMonths(new Date("2026-01-31"), 1).toISOString().slice(0, 10), "2026-02-28");
});

test("review workflow: recording a REASSESS outcome creates an open request and upserts the schedule", async () => {
  await db.$transaction(async (tx) => {
    await tx.riskReview.create({ data: { id: "review-reassess", tenantId: "tenant-a", riskId: risks.active.id, reviewerId: users.manager.id, scheduledFor: now, completedAt: now, outcome: "REASSESS", notes: "Drivers changed; full reassessment required.", reassessmentRequested: true } });
    await tx.risk.update({ where: { id: risks.active.id }, data: { nextReviewDate: new Date("2026-09-27"), status: "IN_REVIEW", version: { increment: 1 } } });
    await tx.reassessmentRequest.create({ data: { tenantId: "tenant-a", riskId: risks.active.id, requestedById: users.manager.id, reason: "Drivers changed; full reassessment required.", status: "OPEN" } });
    await tx.reviewSchedule.upsert({ where: { riskId: risks.active.id }, create: { tenantId: "tenant-a", riskId: risks.active.id, cadenceMonths: 3, nextDueAt: new Date("2026-09-27"), createdById: users.manager.id, lastRunAt: now }, update: { nextDueAt: new Date("2026-09-27"), active: true, lastRunAt: now } });
  });
  const request = await db.reassessmentRequest.findFirst({ where: { tenantId: "tenant-a", riskId: risks.active.id, status: "OPEN" } });
  assert.ok(request);
  const schedule = await db.reviewSchedule.findFirst({ where: { tenantId: "tenant-a", riskId: risks.active.id } });
  assert.equal(schedule?.cadenceMonths, 3);
  assert.equal(await db.reassessmentRequest.count({ where: { tenantId: "tenant-b" } }), 0);
});