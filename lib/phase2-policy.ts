import type { AppetiteBreachStatus, ControlEffectiveness } from "@prisma/client";

export function requiresApprovedInherentAssessment(type: "INHERENT" | "RESIDUAL", hasApprovedInherent: boolean) {
  return type !== "RESIDUAL" || hasApprovedInherent;
}

export function isValidControlImplementation(value: string) {
  return ["NOT_STARTED", "IN_PROGRESS", "IMPLEMENTED", "NOT_APPLICABLE"].includes(value);
}

export function isAppetiteResolution(status: AppetiteBreachStatus) {
  return ["ACKNOWLEDGED", "TREATING", "ACCEPTED", "RESOLVED"].includes(status);
}

export function isValidControlEffectiveness(value: string): value is ControlEffectiveness {
  return ["NOT_ASSESSED", "INEFFECTIVE", "PARTIALLY_EFFECTIVE", "EFFECTIVE"].includes(value);
}
