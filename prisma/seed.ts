import { PrismaClient, RiskCategory, RiskStatus, RiskTreatment, Role } from "@prisma/client";
import { hash } from "bcryptjs";

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
  const passwordHash = await hash("BeyondBeams2026!", 12);
  const tenant = await db.tenant.upsert({ where: { slug: "beyondbeams-demo" }, update: {}, create: { name: "BeyondBeams Demo", slug: "beyondbeams-demo" } });
  const user = await db.user.upsert({ where: { email: "owner@beyondbeams.com" }, update: { passwordHash, tenantId: tenant.id }, create: { email: "owner@beyondbeams.com", name: "Maya Chen", passwordHash, tenantId: tenant.id } });
  await db.membership.upsert({ where: { tenantId_userId: { tenantId: tenant.id, userId: user.id } }, update: { role: Role.OWNER }, create: { tenantId: tenant.id, userId: user.id, role: Role.OWNER } });
  await db.risk.deleteMany({ where: { tenantId: tenant.id } });
  for (const [index, item] of risks.entries()) {
    const [title, description, category, il, ii, rl, ri, treatment, status] = item;
    const risk = await db.risk.create({ data: { tenantId: tenant.id, reference: `RSK-${String(index + 21).padStart(4, "0")}`, title, description, category, ownerId: user.id, inherentLikelihood: il, inherentImpact: ii, inherentScore: il * ii, residualLikelihood: rl, residualImpact: ri, residualScore: rl * ri, treatment, status, nextReviewDate: new Date(Date.now() + (index + 1) * 7 * 86400000) } });
    await db.auditEvent.create({ data: { tenantId: tenant.id, riskId: risk.id, actorId: user.id, action: "CREATE", entityId: risk.id, summary: `Created ${risk.reference}` } });
  }
}
main().then(() => db.$disconnect()).catch(async (error) => { console.error(error); await db.$disconnect(); process.exit(1); });