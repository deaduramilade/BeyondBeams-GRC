import assert from "node:assert/strict";
import test from "node:test";
import { uiCapabilities } from "@/lib/ui-capabilities";

test("governance UI capabilities match the server permission contract for every role", () => {
  const expected = {
    OWNER: { riskUpdate: true, assessmentApprove: true, treatment: true, control: true, evidence: true },
    RISK_MANAGER: { riskUpdate: true, assessmentApprove: true, treatment: true, control: true, evidence: true },
    ASSESSOR: { riskUpdate: true, assessmentApprove: false, treatment: true, control: true, evidence: true },
    VIEWER: { riskUpdate: false, assessmentApprove: false, treatment: false, control: false, evidence: false },
    AUDITOR: { riskUpdate: false, assessmentApprove: false, treatment: false, control: false, evidence: false },
  } as const;

  for (const [role, values] of Object.entries(expected)) {
    const capabilities = uiCapabilities(role);
    assert.deepEqual({
      riskUpdate: capabilities["risk:update"],
      assessmentApprove: capabilities["assessment:approve"],
      treatment: capabilities["treatment:manage"],
      control: capabilities["control:manage"],
      evidence: capabilities["evidence:manage"],
    }, values, role);
  }
});

test("unknown roles fail closed for UI controls", () => {
  const capabilities = uiCapabilities("UNKNOWN");
  assert.equal(Object.values(capabilities).some(Boolean), false);
});