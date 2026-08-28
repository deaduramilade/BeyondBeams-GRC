export type ReviewOutcomeValue = "CONTINUE" | "REASSESS" | "CLOSE" | "ESCALATE";
export type ReassessmentStatusValue = "OPEN" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";

export const reassessmentTransitions: Record<ReassessmentStatusValue, ReassessmentStatusValue[]> = {
  OPEN: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

/** Advance a review date by calendar months, clamping the day to the target month. */
export function addMonths(date: Date, months: number) {
  const result = new Date(date);
  const targetMonth = result.getMonth() + months;
  result.setMonth(targetMonth, 1);
  const lastDay = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
  result.setDate(Math.min(date.getDate(), lastDay));
  return result;
}

/** The next review date for a recurring schedule. */
export function nextReviewDateFrom(now: Date, cadenceMonths: number) {
  const safe = Math.max(1, Math.min(24, Math.round(cadenceMonths || 3)));
  return addMonths(now, safe);
}

export function isScheduleDue(schedule: { active: boolean; nextDueAt: Date }, now = new Date()) {
  return schedule.active && schedule.nextDueAt.getTime() <= now.getTime();
}

/** A recorded review outcome updates the schedule's next due date. */
export function scheduleFromOutcome(
  schedule: { active: boolean; cadenceMonths: number } | null,
  outcome: ReviewOutcomeValue,
  nextReviewDate: Date,
  now = new Date(),
) {
  if (outcome === "CLOSE") return { active: false, nextDueAt: nextReviewDate, lastRunAt: now };
  if (outcome === "REASSESS") return { active: true, nextDueAt: addMonths(now, 1), lastRunAt: now, cadenceMonths: schedule?.cadenceMonths ?? 3 };
  return { active: true, nextDueAt: nextReviewDate, lastRunAt: now };
}

/** A REASSESS outcome must produce an actionable reassessment request. */
export function shouldRequestReassessment(outcome: ReviewOutcomeValue) {
  return outcome === "REASSESS";
}

export function canTransitionReassessment(current: ReassessmentStatusValue, next: ReassessmentStatusValue) {
  return reassessmentTransitions[current]?.includes(next) ?? false;
}

export function openReassessmentWhere(tenantId: string) {
  return { tenantId, status: "OPEN" as const };
}