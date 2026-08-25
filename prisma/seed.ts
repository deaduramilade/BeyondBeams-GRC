import { Plan, PrismaClient, RiskCategory, RiskStatus, RiskTreatment, Role } from "@prisma/client";
import { hash } from "bcryptjs";
import { randomBytes } from "node:crypto";
import { complianceCatalog, linkComplianceToRisk } from "../lib/compliance";
import { ensureTenantFrameworks, seedFrameworks } from "../lib/frameworks";

const db = new PrismaClient();
const risks = [
  ["Third-party data exposure", "A critical supplier may expose regulated customer data through weak access controls.", RiskCategory.THIRD_PARTY, 5, 5, 3, 4, RiskTreatment.MITIGATE, RiskStatus.TREATMENT],
  ["Regulatory reporting delay", "Incomplete source data may delay mandatory submissions and trigger supervisory action.", RiskCategory.COMPLIANCE, 4, 4, 2, 3, RiskTreatment.MITIGATE, RiskStatus.TREATMENT],
  ["Key person dependency", "Loss of specialist knowledge may interrupt financial close and assurance activities.", RiskCategory.PEOPLE, 3, 4, 2, 3, RiskTreatment.MITIGATE, RiskStatus.IN_MONITORING],
  ["Cloud service interruption", "A regional cloud outage may make customer operations unavailable beyond tolerance.", RiskCategory.RESILIENCE, 3, 5, 2, 3, RiskTreatment.MITIGATE, RiskStatus.IN_MONITORING],
  ["Revenue forecast volatility", "Rapid market changes may reduce forecast accuracy and investment capacity.", RiskCategory.STRATEGIC, 3, 3, 2, 2, RiskTreatment.ACCEPT, RiskStatus.ACCEPTED],
  ["Vendor concentration", "Dependence on one logistics provider may disrupt service during peak demand.", RiskCategory.THIRD_PARTY, 4, 3, 3, 2, RiskTreatment.TRANSFER, RiskStatus.TREATMENT],
  ["Privileged access drift", "Stale administrator privileges increase the chance of unauthorized system changes.", RiskCategory.CYBERSECURITY, 4, 5, 2, 3, RiskTreatment.MITIGATE, RiskStatus.OPEN],
  ["Customer privacy request backlog", "Delayed data requests may breach internal service-level commitments.", RiskCategory.PRIVACY, 3, 4, 2, 2, RiskTreatment.MITIGATE, RiskStatus.OPEN],
] as const;

async function main() {
  const demoPassword = process.env.SEED_DEMO_PASSWORD ?? randomBytes(24).toString("base64url");
  const passwordHash = await hash(demoPassword, 12);
  const tenant = await db.tenant.upsert({ where: { slug: "beyondbeams-demo" }, update: { plan: Plan.PROFESSIONAL }, create: { name: "BeyondBeams Demo", slug: "beyondbeams-demo", plan: Plan.PROFESSIONAL } });
  const user = await db.user.upsert({ where: { email: "owner@beyondbeams.com" }, update: { passwordHash, tenantId: tenant.id, translatorUses: 0, paidPlan: false }, create: { email: "owner@beyondbeams.com", name: "Maya Chen", passwordHash, tenantId: tenant.id } });
  await db.membership.upsert({ where: { tenantId_userId: { tenantId: tenant.id, userId: user.id } }, update: { role: Role.OWNER, acceptedAt: new Date(), inviteEmail: null, inviteToken: null, inviteExpires: null }, create: { tenantId: tenant.id, userId: user.id, role: Role.OWNER, acceptedAt: new Date() } });
  // Local assessment reset only. Production roles must not receive audit UPDATE/DELETE grants.
  if (process.env.NODE_ENV === "production") throw new Error("The demo seed must never run in production.");
  await db.auditEvent.deleteMany({ where: { tenantId: tenant.id } });
  await db.exportHistory.deleteMany({ where: { tenantId: tenant.id } });
  await db.savedReport.deleteMany({ where: { tenantId: tenant.id } });
  await seedFrameworks();
  await db.tenantFramework.deleteMany({ where: { tenantId: tenant.id } });
  await ensureTenantFrameworks(tenant.id);
  await db.emergingRisk.deleteMany({ where: { tenantId: tenant.id } });
  await db.risk.deleteMany({ where: { tenantId: tenant.id } });
  await db.tenantSequence.upsert({ where: { tenantId_name: { tenantId: tenant.id, name: "risk" } }, update: { value: 28 }, create: { tenantId: tenant.id, name: "risk", value: 28 } });
  await db.grcRecord.deleteMany({ where: { tenantId: tenant.id } });
  for (const reference of complianceCatalog) await db.complianceReference.upsert({ where: { tenantId_framework_reference: { tenantId: tenant.id, framework: reference.framework, reference: reference.reference } }, update: { ...reference }, create: { tenantId: tenant.id, ...reference } });
  for (const [index, item] of risks.entries()) {
    const [title, description, category, il, ii, rl, ri, treatment, status] = item;
    const risk = await db.risk.create({ data: { tenantId: tenant.id, reference: `RSK-${String(index + 21).padStart(4, "0")}`, title, description, category, ownerId: user.id, inherentLikelihood: il, inherentImpact: ii, inherentScore: il * ii, residualLikelihood: rl, residualImpact: ri, residualScore: rl * ri, treatment, status, nextReviewDate: new Date(Date.now() + (index + 1) * 7 * 86400000) } });
    await db.auditEvent.create({ data: { tenantId: tenant.id, riskId: risk.id, actorId: user.id, action: "CREATE", entityId: risk.id, summary: `Created ${risk.reference}` } });
    await linkComplianceToRisk(risk);
  }
  await db.grcRecord.createMany({ data: [
    { tenantId: tenant.id, module: "controls", title: "Quarterly privileged access review", status: "IN PROGRESS", owner: user.name, priority: "HIGH", details: "Review administrative accounts across production systems and validate current business need and approval.", outcome: "Remove stale access and evidence reviewer approval for retained privileges.", createdById: user.id },
    { tenantId: tenant.id, module: "vendors", title: "Critical cloud provider review", status: "OPEN", owner: user.name, priority: "HIGH", details: "Assess resilience, data location, subcontractors, incident notification, and exit readiness.", outcome: "Approve with tracked contract remediation and semi-annual monitoring.", createdById: user.id },
  ] });
  await db.emergingRisk.create({ data: { tenantId: tenant.id, title: "AI-enabled payment fraud acceleration", hypothesis: "Low-cost generative tooling may increase the speed and credibility of social-engineering attacks against payment operations.", indicators: "Increase in voice-clone reports\nHigher payment-change request velocity\nAuthentication challenge failure trends", cadence: "MONTHLY", horizon: "3-12 MONTHS", ownerId: user.id, nextReviewDate: new Date(Date.now() + 30 * 86400000) } });
}
main().then(() => db.$disconnect()).catch(async (error) => { console.error(error); await db.$disconnect(); process.exit(1); });