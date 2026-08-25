import type { RiskStatus } from "@prisma/client";

export const lifecycleTransitions: Record<RiskStatus, RiskStatus[]> = {
  DRAFT: ["OPEN"], OPEN: ["IN_REVIEW", "CLOSED"], IN_REVIEW: ["OPEN", "TREATMENT", "ACCEPTED"],
  TREATMENT: ["IN_MONITORING", "IN_REVIEW"], IN_MONITORING: ["IN_REVIEW", "CLOSED"],
  ACCEPTED: ["IN_REVIEW", "CLOSED"], CLOSED: ["OPEN"],
};

export function canTransition(from: RiskStatus, to: RiskStatus) { return lifecycleTransitions[from].includes(to); }