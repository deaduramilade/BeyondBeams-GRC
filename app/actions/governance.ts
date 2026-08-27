"use server";

import type { ControlEffectiveness, Prisma, RiskStatus, TreatmentActionStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { appendAuditEvent } from "@/lib/audit";
import { requirePermission } from "@/lib/authz";
import { db } from "@/lib/db";
import { sendNotificationEmail } from "@/lib/email";
import { isAppetiteResolution, isValidControlEffectiveness, isValidControlImplementation, requiresApprovedInherentAssessment } from "@/lib/phase2-policy";
import { canTransition, transitionRequirements } from "@/lib/risk-lifecycle";

const id = z.string().cuid();
const text = z.string().trim().min(3).max(5000);
const optionalText = z.string().trim().max(5000).optional();
const actionStatuses = ["NOT_STARTED", "IN_PROGRESS", "BLOCKED", "COMPLETED", "CANCELLED"] as const;

function refresh(riskId?: string) {
  ["/app/governance", "/app/assessments", "/app/treatments", "/app/controls", "/app/reviews", "/app/evidence"].forEach((path) => revalidatePath(path));
  if (riskId) revalidatePath(`/app/risks/${riskId}`);
}

export async function createAssessment(input: unknown) {
  const session = await requirePermission("risk:update");
  const parsed = z.object({ riskId: id, type: z.enum(["INHERENT", "RESIDUAL"]), likelihood: z.coerce.number().int().min(1).max(5), impact: z.coerce.number().int().min(1).max(5), rationale: text }).safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid assessment." };
  const tenantId = session.user.tenantId;
  const risk = await db.risk.findFirst({ where: { id: parsed.data.riskId, tenantId, deletedAt: null }, select: { id: true } });
  if (!risk) return { error: "Risk not found." };
  const inherent = parsed.data.type === "INHERENT" || Boolean(await db.assessment.findFirst({ where: { tenantId, riskId: risk.id, type: "INHERENT", status: "APPROVED" } }));
  if (!requiresApprovedInherentAssessment(parsed.data.type, inherent)) return { error: "Approve an inherent assessment before creating a residual assessment." };
  const assessment = await db.$transaction(async (tx: Prisma.TransactionClient) => {
    const latest = await tx.assessment.findFirst({ where: { tenantId, riskId: risk.id, type: parsed.data.type }, orderBy: { revision: "desc" } });
    const created = await tx.assessment.create({ data: { ...parsed.data, tenantId, revision: (latest?.revision ?? 0) + 1, score: parsed.data.likelihood * parsed.data.impact, authorId: session.user.id } });
    await appendAuditEvent(tx, { tenantId, actorId: session.user.id, action: "CREATE", riskId: risk.id, entityType: "Assessment", entityId: created.id, summary: `Created ${created.type.toLowerCase()} assessment revision ${created.revision}`, afterJson: JSON.stringify({ status: created.status, likelihood: created.likelihood, impact: created.impact, score: created.score, rationale: created.rationale }) });
    return created;
  });
  refresh(risk.id);
  return { success: true, id: assessment.id };
}

export async function submitAssessment(assessmentId: string) {
  const session = await requirePermission("risk:update");
  const tenantId = session.user.tenantId;
  const current = await db.assessment.findFirst({ where: { id: assessmentId, tenantId, status: { in: ["DRAFT", "REJECTED"] } } });
  if (!current) return { error: "Only a draft or rejected assessment can be submitted." };
  await db.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.assessment.update({ where: { id: current.id }, data: { status: "SUBMITTED", submittedAt: new Date(), decidedById: null, decidedAt: null, decisionReason: null } });
    await appendAuditEvent(tx, { tenantId, actorId: session.user.id, action: "UPDATE", riskId: current.riskId, entityType: "Assessment", entityId: current.id, summary: `Submitted assessment revision ${current.revision}`, beforeJson: JSON.stringify({ status: current.status }), afterJson: JSON.stringify({ status: "SUBMITTED" }) });
  });
  refresh(current.riskId);
  return { success: true };
}

export async function decideAssessment(assessmentId: string, decision: "APPROVED" | "REJECTED", reason: string) {
  const session = await requirePermission("assessment:approve");
  const rationale = text.safeParse(reason);
  if (!rationale.success) return { error: "A decision rationale is required." };
  const tenantId = session.user.tenantId;
  const current = await db.assessment.findFirst({ where: { id: assessmentId, tenantId, status: "SUBMITTED" } });
  if (!current) return { error: "Submitted assessment not found." };
  if (current.authorId === session.user.id) return { error: "The assessment author cannot decide their own assessment." };
  await db.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.assessment.update({ where: { id: current.id }, data: { status: decision, decidedById: session.user.id, decidedAt: new Date(), decisionReason: rationale.data } });
    if (decision === "APPROVED") {
      const prior = await tx.assessment.findMany({ where: { tenantId, riskId: current.riskId, type: current.type, status: "APPROVED", id: { not: current.id } }, select: { id: true, revision: true } });
      await tx.assessment.updateMany({ where: { id: { in: prior.map((item) => item.id) } }, data: { status: "SUPERSEDED" } });
      for (const item of prior) await appendAuditEvent(tx, { tenantId, actorId: session.user.id, action: "UPDATE", riskId: current.riskId, entityType: "Assessment", entityId: item.id, summary: `Superseded assessment revision ${item.revision}`, afterJson: JSON.stringify({ status: "SUPERSEDED", supersededById: current.id }) });
      await tx.risk.update({ where: { id: current.riskId }, data: current.type === "INHERENT" ? { inherentLikelihood: current.likelihood, inherentImpact: current.impact, inherentScore: current.score, version: { increment: 1 } } : { residualLikelihood: current.likelihood, residualImpact: current.impact, residualScore: current.score, version: { increment: 1 } } });
    }
    await appendAuditEvent(tx, { tenantId, actorId: session.user.id, action: "UPDATE", riskId: current.riskId, entityType: "Assessment", entityId: current.id, summary: `${decision === "APPROVED" ? "Approved" : "Rejected"} assessment revision ${current.revision}`, beforeJson: JSON.stringify({ status: current.status }), afterJson: JSON.stringify({ status: decision, decidedById: session.user.id }), reason: rationale.data });
  });
  refresh(current.riskId);
  return { success: true };
}

export async function transitionRisk(riskId: string, to: RiskStatus, reason: string) {
  const session = await requirePermission("risk:update");
  const tenantId = session.user.tenantId;
  const risk = await db.risk.findFirst({ where: { id: riskId, tenantId, deletedAt: null }, include: { treatmentPlans: { where: { status: "APPROVED" }, select: { id: true } } } });
  if (!risk || !canTransition(risk.status, to)) return { error: "This lifecycle transition is not allowed." };
  const requirement = transitionRequirements(risk, to, reason);
  if (requirement) return { error: requirement };
  await db.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.risk.update({ where: { id: risk.id }, data: { status: to, version: { increment: 1 } } });
    await appendAuditEvent(tx, { tenantId, actorId: session.user.id, action: "UPDATE", riskId: risk.id, entityType: "Risk", entityId: risk.id, summary: `Transitioned ${risk.reference} from ${risk.status} to ${to}`, beforeJson: JSON.stringify({ status: risk.status, version: risk.version }), afterJson: JSON.stringify({ status: to, version: risk.version + 1 }), reason });
  });
  refresh(risk.id);
  return { success: true };
}

export async function createTreatment(input: unknown) {
  const session = await requirePermission("treatment:manage");
  const parsed = z.object({ riskId: id, strategy: z.enum(["ACCEPT", "MITIGATE", "TRANSFER", "AVOID"]), summary: text, targetDate: z.coerce.date() }).safeParse(input);
  if (!parsed.success) return { error: "Invalid treatment." };
  const tenantId = session.user.tenantId;
  const risk = await db.risk.findFirst({ where: { id: parsed.data.riskId, tenantId, deletedAt: null } });
  if (!risk) return { error: "Risk not found." };
  const plan = await db.$transaction(async (tx: Prisma.TransactionClient) => {
    const created = await tx.treatmentPlan.create({ data: { ...parsed.data, tenantId, createdById: session.user.id } });
    await appendAuditEvent(tx, { tenantId, actorId: session.user.id, action: "CREATE", riskId: risk.id, entityType: "TreatmentPlan", entityId: created.id, summary: `Created ${created.strategy.toLowerCase()} treatment plan`, afterJson: JSON.stringify({ summary: created.summary, targetDate: created.targetDate, status: created.status }) });
    return created;
  });
  refresh(risk.id);
  return { success: true, id: plan.id };
}

export async function decideTreatment(planId: string, status: "APPROVED" | "REJECTED", rationale: string) {
  const session = await requirePermission("treatment:approve");
  const tenantId = session.user.tenantId;
  const plan = await db.treatmentPlan.findFirst({ where: { id: planId, tenantId, status: "PENDING" } });
  if (!plan || rationale.trim().length < 10) return { error: "A pending plan and decision rationale are required." };
  if (plan.createdById === session.user.id) return { error: "The plan creator cannot approve their own plan." };
  await db.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.treatmentPlan.update({ where: { id: plan.id }, data: { status } });
    await tx.approvalDecision.create({ data: { treatmentPlanId: plan.id, kind: plan.strategy === "ACCEPT" ? "RISK_ACCEPTANCE" : "TREATMENT", status, rationale, decidedById: session.user.id } });
    if (status === "APPROVED") await tx.risk.update({ where: { id: plan.riskId }, data: { treatment: plan.strategy, status: plan.strategy === "ACCEPT" ? "ACCEPTED" : "TREATMENT", version: { increment: 1 } } });
    await appendAuditEvent(tx, { tenantId, actorId: session.user.id, action: "UPDATE", riskId: plan.riskId, entityType: "TreatmentPlan", entityId: plan.id, summary: `${status === "APPROVED" ? "Approved" : "Rejected"} ${plan.strategy.toLowerCase()} plan`, beforeJson: JSON.stringify({ status: plan.status }), afterJson: JSON.stringify({ status }), reason: rationale });
  });
  refresh(plan.riskId);
  return { success: true };
}

export async function createTreatmentAction(input: unknown) {
  const session = await requirePermission("treatment:manage");
  const parsed = z.object({ treatmentPlanId: id, title: text, description: text, ownerId: id, dueDate: z.coerce.date(), priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).default("MEDIUM") }).safeParse(input);
  if (!parsed.success) return { error: "Invalid treatment action." };
  const tenantId = session.user.tenantId;
  const [plan, owner] = await Promise.all([db.treatmentPlan.findFirst({ where: { id: parsed.data.treatmentPlanId, tenantId } }), db.user.findFirst({ where: { id: parsed.data.ownerId, tenantId } })]);
  if (!plan || !owner) return { error: "The plan and owner must belong to this workspace." };
  const action = await db.$transaction(async (tx: Prisma.TransactionClient) => {
    const created = await tx.treatmentAction.create({ data: { ...parsed.data, tenantId } });
    await tx.treatmentActionHistory.create({ data: { tenantId, treatmentActionId: created.id, actorId: session.user.id, toStatus: created.status, note: "Action created" } });
    await appendAuditEvent(tx, { tenantId, actorId: session.user.id, action: "CREATE", riskId: plan.riskId, entityType: "TreatmentAction", entityId: created.id, summary: `Created treatment action ${created.title}`, afterJson: JSON.stringify({ ownerId: created.ownerId, dueDate: created.dueDate, status: created.status }) });
    return created;
  });
  refresh(plan.riskId);
  return { success: true, id: action.id };
}

export async function updateTreatmentAction(actionId: string, status: TreatmentActionStatus, note: string) {
  const session = await requirePermission("treatment:manage");
  if (!actionStatuses.includes(status)) return { error: "Invalid action status." };
  const tenantId = session.user.tenantId;
  const action = await db.treatmentAction.findFirst({ where: { id: actionId, tenantId }, include: { treatmentPlan: true } });
  if (!action) return { error: "Treatment action not found." };
  if (status === "COMPLETED" && note.trim().length < 3) return { error: "Completion notes or linked evidence are required." };
  await db.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.treatmentAction.update({ where: { id: action.id }, data: { status, completedAt: status === "COMPLETED" ? new Date() : null } });
    await tx.treatmentActionHistory.create({ data: { tenantId, treatmentActionId: action.id, actorId: session.user.id, fromStatus: action.status, toStatus: status, note } });
    await appendAuditEvent(tx, { tenantId, actorId: session.user.id, action: "UPDATE", riskId: action.treatmentPlan.riskId, entityType: "TreatmentAction", entityId: action.id, summary: `Updated treatment action ${action.title} to ${status}`, beforeJson: JSON.stringify({ status: action.status }), afterJson: JSON.stringify({ status }), reason: note });
  });
  refresh(action.treatmentPlan.riskId);
  return { success: true, residualReassessmentAvailable: status === "COMPLETED" };
}

export async function escalateOverdueActions(asOf = new Date()) {
  const session = await requirePermission("treatment:manage");
  const tenantId = session.user.tenantId;
  const actions = await db.treatmentAction.findMany({ where: { tenantId, dueDate: { lt: asOf }, status: { in: ["NOT_STARTED", "IN_PROGRESS", "BLOCKED"] } }, include: { owner: true, treatmentPlan: { include: { risk: true } } } });
  for (const action of actions) {
    await db.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.treatmentAction.update({ where: { id: action.id }, data: { escalatedAt: asOf, escalationLevel: { increment: 1 } } });
      await appendAuditEvent(tx, { tenantId, actorId: session.user.id, action: "UPDATE", riskId: action.treatmentPlan.riskId, entityType: "TreatmentAction", entityId: action.id, summary: `Escalated overdue action ${action.title}`, afterJson: JSON.stringify({ escalationLevel: action.escalationLevel + 1, escalatedAt: asOf }) });
    });
    if (action.owner.assignmentEmailsEnabled) await sendNotificationEmail({ tenantId, userId: action.owner.id, recipient: action.owner.email, type: "ACTION_OVERDUE", subject: `Overdue action: ${action.title}`, eyebrow: "Treatment escalation", heading: "Treatment action is overdue", paragraphs: [`${action.title} for ${action.treatmentPlan.risk.reference} is overdue and requires an update.`], cta: { label: "Open treatments", url: `${process.env.AUTH_URL ?? "http://localhost:3000"}/app/treatments` }, relatedEntityType: "TreatmentAction", relatedEntityId: action.id, dedupeKey: `overdue:${action.id}:${asOf.toISOString().slice(0, 10)}` });
  }
  refresh();
  return { success: true, count: actions.length };
}

export async function upsertControlProfile(input: unknown) {
  const session = await requirePermission("control:manage");
  const parsed = z.object({ frameworkControlId: id, ownerId: id.optional(), implementationStatus: z.string(), effectiveness: z.string(), frequency: z.string().trim().max(100).optional(), notes: optionalText }).safeParse(input);
  if (!parsed.success || !isValidControlImplementation(parsed.data.implementationStatus) || !isValidControlEffectiveness(parsed.data.effectiveness)) return { error: "Invalid control profile." };
  const tenantId = session.user.tenantId;
  const [control, owner] = await Promise.all([db.frameworkControl.findFirst({ where: { id: parsed.data.frameworkControlId, framework: { tenantSelections: { some: { tenantId, enabled: true } } } } }), parsed.data.ownerId ? db.user.findFirst({ where: { id: parsed.data.ownerId, tenantId } }) : null]);
  if (!control || (parsed.data.ownerId && !owner)) return { error: "The control and owner must belong to this workspace." };
  const existing = await db.controlProfile.findUnique({ where: { tenantId_frameworkControlId: { tenantId, frameworkControlId: control.id } } });
  const profile = await db.$transaction(async (tx: Prisma.TransactionClient) => {
    const saved = await tx.controlProfile.upsert({ where: { tenantId_frameworkControlId: { tenantId, frameworkControlId: control.id } }, create: { ...parsed.data, tenantId, effectiveness: parsed.data.effectiveness as ControlEffectiveness }, update: { ...parsed.data, effectiveness: parsed.data.effectiveness as ControlEffectiveness } });
    await appendAuditEvent(tx, { tenantId, actorId: session.user.id, action: existing ? "UPDATE" : "CREATE", entityType: "ControlProfile", entityId: saved.id, summary: `${existing ? "Updated" : "Created"} control profile ${control.controlId}`, beforeJson: existing ? JSON.stringify(existing) : undefined, afterJson: JSON.stringify({ ownerId: saved.ownerId, implementationStatus: saved.implementationStatus, effectiveness: saved.effectiveness, frequency: saved.frequency }) });
    return saved;
  });
  refresh();
  return { success: true, id: profile.id };
}

export async function recordControlTest(input: unknown) {
  const session = await requirePermission("control:manage");
  const parsed = z.object({ controlProfileId: id, testDate: z.coerce.date(), result: z.enum(["NOT_TESTED", "PASS", "PARTIAL", "FAIL"]), notes: optionalText, evidenceId: id.optional() }).safeParse(input);
  if (!parsed.success) return { error: "Invalid control test result." };
  const tenantId = session.user.tenantId;
  const [profile, evidence] = await Promise.all([db.controlProfile.findFirst({ where: { id: parsed.data.controlProfileId, tenantId }, include: { frameworkControl: true } }), parsed.data.evidenceId ? db.evidence.findFirst({ where: { id: parsed.data.evidenceId, tenantId } }) : null]);
  if (!profile || (parsed.data.evidenceId && !evidence)) return { error: "Control and evidence links must belong to this workspace." };
  const test = await db.$transaction(async (tx: Prisma.TransactionClient) => {
    const created = await tx.controlTest.create({ data: { ...parsed.data, tenantId, testerId: session.user.id } });
    await tx.controlProfile.update({ where: { id: profile.id }, data: { lastTestedAt: parsed.data.testDate, effectiveness: parsed.data.result === "PASS" ? "EFFECTIVE" : parsed.data.result === "PARTIAL" ? "PARTIALLY_EFFECTIVE" : parsed.data.result === "FAIL" ? "INEFFECTIVE" : "NOT_ASSESSED" } });
    await appendAuditEvent(tx, { tenantId, actorId: session.user.id, action: "CREATE", entityType: "ControlTest", entityId: created.id, summary: `Recorded ${created.result.toLowerCase()} test for ${profile.frameworkControl.controlId}`, afterJson: JSON.stringify({ testDate: created.testDate, result: created.result, evidenceId: created.evidenceId }) });
    return created;
  });
  refresh();
  return { success: true, id: test.id };
}

export async function createEvidence(input: unknown) {
  const session = await requirePermission("evidence:manage");
  const parsed = z.object({ title: text, description: optionalText, storageKey: z.string().max(300).optional(), fileName: z.string().max(255).optional(), mimeType: z.string().max(120).optional(), sizeBytes: z.coerce.number().int().nonnegative().optional(), checksum: z.string().max(128).optional(), validFrom: z.coerce.date().optional(), expiresAt: z.coerce.date().optional(), retentionUntil: z.coerce.date().optional(), accessLevel: z.enum(["WORKSPACE", "RESTRICTED"]).default("WORKSPACE"), riskId: id.optional(), treatmentPlanId: id.optional(), treatmentActionId: id.optional(), controlProfileId: id.optional() }).safeParse(input);
  if (!parsed.success) return { error: "Invalid evidence metadata." };
  if (!parsed.data.riskId && !parsed.data.treatmentPlanId && !parsed.data.treatmentActionId && !parsed.data.controlProfileId) return { error: "Evidence must be linked to a risk, treatment plan, action, or control." };
  const tenantId = session.user.tenantId;
  const [risk, plan, action, control] = await Promise.all([parsed.data.riskId ? db.risk.findFirst({ where: { id: parsed.data.riskId, tenantId, deletedAt: null } }) : null, parsed.data.treatmentPlanId ? db.treatmentPlan.findFirst({ where: { id: parsed.data.treatmentPlanId, tenantId } }) : null, parsed.data.treatmentActionId ? db.treatmentAction.findFirst({ where: { id: parsed.data.treatmentActionId, tenantId } }) : null, parsed.data.controlProfileId ? db.controlProfile.findFirst({ where: { id: parsed.data.controlProfileId, tenantId } }) : null]);
  if ((parsed.data.riskId && !risk) || (parsed.data.treatmentPlanId && !plan) || (parsed.data.treatmentActionId && !action) || (parsed.data.controlProfileId && !control)) return { error: "Evidence links must belong to this workspace." };
  const actionPlan = action ? await db.treatmentPlan.findFirst({ where: { id: action.treatmentPlanId, tenantId }, select: { riskId: true } }) : null;
  const auditRiskId = risk?.id ?? plan?.riskId ?? actionPlan?.riskId;
  const evidence = await db.$transaction(async (tx: Prisma.TransactionClient) => {
    const created = await tx.evidence.create({ data: { ...parsed.data, tenantId, uploadedById: session.user.id } });
    await appendAuditEvent(tx, { tenantId, actorId: session.user.id, action: "CREATE", riskId: auditRiskId, entityType: "Evidence", entityId: created.id, summary: `Registered evidence ${created.title}`, afterJson: JSON.stringify({ accessLevel: created.accessLevel, retentionUntil: created.retentionUntil, riskId: created.riskId, treatmentActionId: created.treatmentActionId, controlProfileId: created.controlProfileId }) });
    return created;
  });
  refresh(auditRiskId);
  return { success: true, id: evidence.id };
}

export async function createScoringPolicy(input: unknown) {
  const session = await requirePermission("settings:manage");
  const parsed = z.object({ effectiveAt: z.coerce.date(), bands: z.array(z.object({ name: z.string().trim().min(1).max(50), min: z.coerce.number().int().min(1).max(25), max: z.coerce.number().int().min(1).max(25) })).min(1).max(10) }).safeParse(input);
  if (!parsed.success || parsed.data.bands.some((band) => band.min > band.max)) return { error: "Invalid scoring policy bands." };
  const tenantId = session.user.tenantId;
  const policy = await db.$transaction(async (tx: Prisma.TransactionClient) => {
    const latest = await tx.scoringPolicy.findFirst({ where: { tenantId }, orderBy: { version: "desc" } });
    const created = await tx.scoringPolicy.create({ data: { tenantId, version: (latest?.version ?? 0) + 1, effectiveAt: parsed.data.effectiveAt, bandsJson: JSON.stringify(parsed.data.bands), createdById: session.user.id } });
    await appendAuditEvent(tx, { tenantId, actorId: session.user.id, action: "CREATE", entityType: "ScoringPolicy", entityId: created.id, summary: `Created scoring policy version ${created.version}`, afterJson: JSON.stringify({ version: created.version, effectiveAt: created.effectiveAt, bands: parsed.data.bands }), reason: "New policy applies prospectively; historical scores are unchanged." });
    return created;
  });
  refresh();
  return { success: true, id: policy.id };
}

export async function recordRiskReview(input: unknown) {
  const session = await requirePermission("risk:update");
  const parsed = z.object({ riskId: id, scheduledFor: z.coerce.date(), outcome: z.enum(["CONTINUE", "REASSESS", "CLOSE", "ESCALATE"]), notes: text, nextReviewDate: z.coerce.date() }).safeParse(input);
  if (!parsed.success) return { error: "Invalid review outcome." };
  const tenantId = session.user.tenantId;
  const risk = await db.risk.findFirst({ where: { id: parsed.data.riskId, tenantId, deletedAt: null } });
  if (!risk) return { error: "Risk not found." };
  await db.$transaction(async (tx: Prisma.TransactionClient) => {
    const review = await tx.riskReview.create({ data: { tenantId, riskId: risk.id, reviewerId: session.user.id, scheduledFor: parsed.data.scheduledFor, completedAt: new Date(), outcome: parsed.data.outcome, notes: parsed.data.notes, reassessmentRequested: parsed.data.outcome === "REASSESS" } });
    await tx.risk.update({ where: { id: risk.id }, data: { nextReviewDate: parsed.data.nextReviewDate, status: parsed.data.outcome === "CLOSE" ? "CLOSED" : parsed.data.outcome === "ESCALATE" || parsed.data.outcome === "REASSESS" ? "IN_REVIEW" : risk.status, version: { increment: 1 } } });
    await appendAuditEvent(tx, { tenantId, actorId: session.user.id, action: "CREATE", riskId: risk.id, entityType: "RiskReview", entityId: review.id, summary: `Recorded ${parsed.data.outcome.toLowerCase()} review outcome for ${risk.reference}`, afterJson: JSON.stringify({ outcome: review.outcome, nextReviewDate: parsed.data.nextReviewDate, reassessmentRequested: review.reassessmentRequested }), reason: parsed.data.notes });
  });
  refresh(risk.id);
  return { success: true };
}

export async function createAppetiteStatement(input: unknown) {
  const session = await requirePermission("appetite:manage");
  const parsed = z.object({ name: text, category: z.enum(["CYBERSECURITY", "COMPLIANCE", "OPERATIONAL", "STRATEGIC", "FINANCIAL", "PEOPLE", "THIRD_PARTY", "RESILIENCE", "PRIVACY"]).optional(), taxonomyItemId: id.optional(), maximumScore: z.coerce.number().int().min(1).max(25), rationale: text, effectiveFrom: z.coerce.date() }).safeParse(input);
  if (!parsed.success) return { error: "Invalid appetite statement." };
  const tenantId = session.user.tenantId;
  if (parsed.data.taxonomyItemId && !await db.taxonomyItem.findFirst({ where: { id: parsed.data.taxonomyItemId, tenantId, active: true } })) return { error: "Taxonomy context must belong to this workspace." };
  const statement = await db.$transaction(async (tx: Prisma.TransactionClient) => {
    const created = await tx.appetiteStatement.create({ data: { ...parsed.data, tenantId } });
    await appendAuditEvent(tx, { tenantId, actorId: session.user.id, action: "CREATE", entityType: "AppetiteStatement", entityId: created.id, summary: `Created appetite statement ${created.name}`, afterJson: JSON.stringify({ maximumScore: created.maximumScore, effectiveFrom: created.effectiveFrom, category: created.category, taxonomyItemId: created.taxonomyItemId }) });
    return created;
  });
  refresh();
  return { success: true, id: statement.id };
}

export async function evaluateAppetite() {
  const session = await requirePermission("appetite:manage");
  const tenantId = session.user.tenantId;
  const [risks, statements] = await Promise.all([db.risk.findMany({ where: { tenantId, deletedAt: null, residualScore: { not: null } } }), db.appetiteStatement.findMany({ where: { tenantId, active: true } })]);
  let count = 0;
  for (const risk of risks) for (const statement of statements.filter((item) => !item.category || item.category === risk.category)) if ((risk.residualScore ?? 0) > statement.maximumScore) {
    const existing = await db.appetiteBreach.findFirst({ where: { tenantId, riskId: risk.id, appetiteStatementId: statement.id, status: "OPEN" } });
    if (!existing) await db.$transaction(async (tx: Prisma.TransactionClient) => {
      const breach = await tx.appetiteBreach.create({ data: { tenantId, riskId: risk.id, appetiteStatementId: statement.id, observedScore: risk.residualScore!, ownerId: risk.ownerId } });
      await appendAuditEvent(tx, { tenantId, actorId: session.user.id, action: "CREATE", riskId: risk.id, entityType: "AppetiteBreach", entityId: breach.id, summary: `Detected appetite breach for ${risk.reference}`, afterJson: JSON.stringify({ observedScore: breach.observedScore, maximumScore: statement.maximumScore }) });
    });
    count++;
  }
  refresh();
  return { success: true, count };
}

export async function resolveAppetiteBreach(breachId: string, status: "ACKNOWLEDGED" | "TREATING" | "ACCEPTED" | "RESOLVED", response: string) {
  const session = await requirePermission("appetite:manage");
  if (!isAppetiteResolution(status) || response.trim().length < 10) return { error: "A resolution status and rationale of at least 10 characters are required." };
  const tenantId = session.user.tenantId;
  const breach = await db.appetiteBreach.findFirst({ where: { id: breachId, tenantId } });
  if (!breach) return { error: "Appetite breach not found." };
  await db.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.appetiteBreach.update({ where: { id: breach.id }, data: { status, response, acknowledgedAt: status === "ACKNOWLEDGED" ? new Date() : breach.acknowledgedAt, resolvedAt: status === "RESOLVED" ? new Date() : null } });
    await appendAuditEvent(tx, { tenantId, actorId: session.user.id, action: "UPDATE", riskId: breach.riskId, entityType: "AppetiteBreach", entityId: breach.id, summary: `Updated appetite breach to ${status}`, beforeJson: JSON.stringify({ status: breach.status }), afterJson: JSON.stringify({ status, response }), reason: response });
  });
  refresh(breach.riskId);
  return { success: true };
}

export async function createTaxonomyItem(input: unknown) {
  const session = await requirePermission("taxonomy:manage");
  const parsed = z.object({ type: z.enum(["RISK_CATEGORY", "BUSINESS_UNIT", "OBJECTIVE", "RISK_SOURCE", "REGULATORY_DOMAIN", "TAG"]), name: text, description: z.string().max(1000).optional() }).safeParse(input);
  if (!parsed.success) return { error: "Invalid taxonomy item." };
  const tenantId = session.user.tenantId;
  const item = await db.$transaction(async (tx: Prisma.TransactionClient) => {
    const created = await tx.taxonomyItem.create({ data: { ...parsed.data, tenantId } });
    await appendAuditEvent(tx, { tenantId, actorId: session.user.id, action: "CREATE", entityType: "TaxonomyItem", entityId: created.id, summary: `Created ${created.type.toLowerCase()} taxonomy item ${created.name}`, afterJson: JSON.stringify({ type: created.type, name: created.name }) });
    return created;
  });
  refresh();
  return { success: true, id: item.id };
}