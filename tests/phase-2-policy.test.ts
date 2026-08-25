import assert from "node:assert/strict";
import test from "node:test";
import { isAppetiteResolution, isValidControlEffectiveness, isValidControlImplementation, requiresApprovedInherentAssessment } from "@/lib/phase2-policy";

test("residual assessments require approved inherent context", () => {
  assert.equal(requiresApprovedInherentAssessment("INHERENT", false), true);
  assert.equal(requiresApprovedInherentAssessment("RESIDUAL", true), true);
  assert.equal(requiresApprovedInherentAssessment("RESIDUAL", false), false);
});

test("control policy accepts only known implementation and effectiveness states", () => {
  assert.equal(isValidControlImplementation("IMPLEMENTED"), true);
  assert.equal(isValidControlImplementation("UNKNOWN"), false);
  assert.equal(isValidControlEffectiveness("EFFECTIVE"), true);
  assert.equal(isValidControlEffectiveness("UNKNOWN"), false);
});

test("appetite resolution requires a workflow state", () => {
  assert.equal(isAppetiteResolution("ACKNOWLEDGED"), true);
  assert.equal(isAppetiteResolution("RESOLVED"), true);
  assert.equal(isAppetiteResolution("OPEN"), false);
});
