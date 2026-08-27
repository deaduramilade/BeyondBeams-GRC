import assert from "node:assert/strict";
import test from "node:test";
import { activeMembershipWhere, deleteTenantRisk, tenantRiskWhere, updateTenantRisk } from "@/lib/tenant-access";
import { tokenIsUsable } from "@/lib/token-policy";
import { hasPermission } from "@/lib/security";

test("all roles enforce the documented permission boundaries", () => {
  const expected = {
    OWNER: [true, true, true, true, true, true],
    RISK_MANAGER: [true, true, true, true, true, false],
    ASSESSOR: [true, true, false, false, false, false],
    VIEWER: [true, false, false, false, false, false],
    AUDITOR: [true, false, false, true, true, false],
  } as const;
  for (const [role, permissions] of Object.entries(expected)) {
    assert.deepEqual([
      hasPermission(role, "risk:read"), hasPermission(role, "risk:update"),
      hasPermission(role, "risk:delete"), hasPermission(role, "audit:read"),
      hasPermission(role, "report:export"), hasPermission(role, "member:manage"),
    ], permissions, role);
  }
});

test("active membership requires acceptance and no invitation token", () => {
  assert.deepEqual(activeMembershipWhere("user-a", "tenant-a"), {
    userId: "user-a", tenantId: "tenant-a", acceptedAt: { not: null }, inviteToken: null,
  });
});

test("risk predicates include tenant and exclude soft-deleted records", () => {
  assert.deepEqual(tenantRiskWhere("tenant-a", "risk-a"), { tenantId: "tenant-a", deletedAt: null, id: "risk-a" });
});

test("tenant risk mutations cannot affect another tenant", async () => {
  const calls: Array<{ where: unknown; data: unknown }> = [];
  const fakeDb = { risk: {
    updateMany: async (args: { where: unknown; data: unknown }) => { calls.push(args); return { count: 0 }; },
  } } as never;
  assert.equal((await updateTenantRisk(fakeDb, "tenant-a", "risk-b", "changed")).count, 0);
  assert.equal((await deleteTenantRisk(fakeDb, "tenant-a", "risk-b")).count, 0);
  assert.equal(calls.every(({ where }) => JSON.stringify(where).includes("tenant-a")), true);
  assert.equal(calls.every(({ where }) => JSON.stringify(where).includes('"deletedAt":null')), true);
});

test("single-use token policy rejects expired and consumed tokens", () => {
  const now = new Date("2026-08-27T12:00:00Z");
  assert.equal(tokenIsUsable(new Date("2026-08-27T13:00:00Z"), false, now), true);
  assert.equal(tokenIsUsable(new Date("2026-08-27T13:00:00Z"), true, now), false);
  assert.equal(tokenIsUsable(new Date("2026-08-27T11:00:00Z"), false, now), false);
  assert.equal(tokenIsUsable(null, false, now), false);
});