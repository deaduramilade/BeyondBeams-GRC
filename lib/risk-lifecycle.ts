import type { RiskStatus } from "@prisma/client";

export const lifecycleTransitions: Record<RiskStatus, RiskStatus[]> = {
  DRAFT: ["OPEN"], OPEN: ["IN_REVIEW", "CLOSED", "ARCHIVED"], IN_REVIEW: ["OPEN", "TREATMENT", "ACCEPTED", "ARCHIVED"],
  TREATMENT: ["IN_MONITORING", "IN_REVIEW"], IN_MONITORING: ["IN_REVIEW", "CLOSED"],
  ACCEPTED: ["IN_REVIEW", "CLOSED"], CLOSED: ["OPEN", "ARCHIVED"], ARCHIVED: ["OPEN"],
};

export function canTransition(from: RiskStatus, to: RiskStatus) { return lifecycleTransitions[from].includes(to); }

export function transitionRequirements(risk: { treatment: string; ownerId: string; nextReviewDate: Date; treatmentPlans: { id: string }[] }, to: RiskStatus, reason: string) {
  if (["CLOSED", "ARCHIVED"].includes(to) && reason.trim().length < 10) return "A decision rationale of at least 10 characters is required.";
  if (["TREATMENT", "ACCEPTED"].includes(to) && !risk.ownerId) return "An owner is required before this transition.";
  if (to === "TREATMENT" && risk.treatmentPlans.length === 0) return "An approved treatment plan is required before entering treatment.";
  if (to === "IN_MONITORING" && risk.nextReviewDate.getTime() <= Date.now()) return "Set a future review date before starting monitoring.";
  return null;
}