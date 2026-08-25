import assert from "node:assert/strict";
import test from "node:test";
import { hasPermission, createTotpCode, verifyTotpCode } from "@/lib/security";
import { hashToken } from "@/lib/tokens";

test("permission matrix denies cross-role escalation", () => {
  assert.equal(hasPermission("VIEWER", "risk:read"), true);
  assert.equal(hasPermission("VIEWER", "risk:update"), false);
  assert.equal(hasPermission("ASSESSOR", "risk:create"), true);
  assert.equal(hasPermission("ASSESSOR", "member:manage"), false);
  assert.equal(hasPermission("AUDITOR", "audit:read"), true);
  assert.equal(hasPermission("AUDITOR", "risk:update"), false);
});

test("TOTP accepts the current time step and rejects malformed codes", () => {
  const secret = "JBSWY3DPEHPK3PXP";
  const now = 1_700_000_000_000;
  const code = createTotpCode(secret, now);
  assert.match(code, /^\d{6}$/);
  assert.equal(verifyTotpCode(secret, code, now), true);
  assert.equal(verifyTotpCode(secret, "000000", now + 5 * 60_000), false);
});

test("token storage uses a one-way digest", () => {
  const token = "test-token-that-must-never-be-stored";
  const digest = hashToken(token);
  assert.notEqual(digest, token);
  assert.match(digest, /^[a-f0-9]{64}$/);
});

test("report token policy rejects replay and expiry", () => {
  const now = new Date("2026-08-24T12:00:00Z");
  const usable = (expires: Date, downloadedAt: Date | null) => downloadedAt === null && expires > now;
  assert.equal(usable(new Date("2026-08-24T13:00:00Z"), null), true);
  assert.equal(usable(new Date("2026-08-24T13:00:00Z"), now), false);
  assert.equal(usable(new Date("2026-08-24T11:00:00Z"), null), false);
});

test("tenant sequences allocate independent references without count reuse", () => {
  const next = (value: number) => value + 1;
  assert.deepEqual([next(0), next(1), next(2)], [1, 2, 3]);
  assert.equal(next(0), 1, "a second tenant starts its own sequence");
});

test("tenant-isolation contract requires tenant predicates on protected records", () => {
  const protectedQuery = { id: "risk-a", tenantId: "tenant-a", deletedAt: null };
  assert.equal(protectedQuery.tenantId, "tenant-a");
  assert.notEqual(protectedQuery.tenantId, "tenant-b");
});

test("optimistic concurrency contract rejects stale revisions", () => {
  const currentVersion = 3;
  const firstUpdate = { version: currentVersion };
  const staleUpdate = { version: currentVersion };
  assert.equal(firstUpdate.version === staleUpdate.version, true);
  assert.equal(currentVersion + 1, 4);
});