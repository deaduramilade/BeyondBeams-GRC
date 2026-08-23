import { Plan, Role } from "@prisma/client";
import { db } from "@/lib/db";

export const frameworkCatalog = [
  {
    name: "ISO 27001", version: "2022 Annex A", description: "Information security controls for an ISO/IEC 27001 ISMS.", industryTags: "ALL", controls: [
      ["A.5.1", "Policies for information security", "Information security policies and topic-specific policies are defined, approved, published, communicated and reviewed.", "Organisational"],
      ["A.5.19", "Information security in supplier relationships", "Processes manage information security risks associated with supplier products and services.", "Organisational"],
      ["A.8.2", "Privileged access rights", "The allocation and use of privileged access rights is restricted and managed.", "Technological"],
      ["A.8.15", "Logging", "Logs that record activities, exceptions, faults and other relevant events are produced, stored and reviewed.", "Technological"],
      ["A.8.24", "Use of cryptography", "Rules for effective use of cryptography, including key management, are defined and implemented.", "Technological"],
    ]
  },
  {
    name: "NIST Cybersecurity Framework", version: "2.0", description: "Outcome-based cybersecurity guidance organized around Govern, Identify, Protect, Detect, Respond and Recover.", industryTags: "ALL", controls: [
      ["GV.OC-01", "Organisational context", "The organisational mission is understood and informs cybersecurity risk management.", "Govern"],
      ["ID.AM-01", "Asset inventories", "Inventories of hardware managed by the organisation are maintained.", "Identify"],
      ["PR.AA-01", "Identity management", "Identities and credentials for authorised users, services and hardware are managed.", "Protect"],
      ["DE.CM-01", "Continuous monitoring", "Networks and network services are monitored to find potentially adverse events.", "Detect"],
      ["RS.MA-01", "Incident management plan", "The incident response plan is executed in coordination with relevant parties.", "Respond"],
      ["RC.RP-01", "Recovery plan execution", "The recovery portion of the incident response plan is executed once initiated.", "Recover"],
    ]
  },
  {
    name: "SOC 2", version: "Trust Services Criteria 2017", description: "Controls aligned to the AICPA Trust Services Criteria for security, availability, processing integrity, confidentiality and privacy.", industryTags: "ALL", controls: [
      ["CC1.1", "Commitment to integrity", "The entity demonstrates a commitment to integrity and ethical values.", "Common Criteria"],
      ["CC3.2", "Risk identification and analysis", "The entity identifies and analyzes risks to achievement of objectives.", "Common Criteria"],
      ["CC6.1", "Logical access security", "Logical access security software, infrastructure and architectures are implemented.", "Common Criteria"],
      ["CC7.2", "System monitoring", "The entity monitors system components and anomalies in a timely manner.", "Common Criteria"],
      ["CC8.1", "Change management", "Changes to infrastructure, data and software are authorized, designed, tested and implemented.", "Common Criteria"],
    ]
  },
  { name: "Healthcare (HIPAA Security Rule)", version: "45 CFR Part 164", description: "Administrative, physical and technical safeguards for electronic protected health information.", industryTags: "HEALTHCARE", controls: [["164.308(a)(1)", "Security management process", "Implement policies to prevent, detect, contain and correct security violations.", "Administrative"], ["164.312(a)(1)", "Access control", "Implement technical policies and procedures for access to electronic protected health information.", "Technical"], ["164.312(b)", "Audit controls", "Implement hardware, software and procedural mechanisms that record and examine activity.", "Technical"]] },
  { name: "Fintech & Payments", version: "PCI DSS 4.0.1 / DORA / Common Controls", description: "Practical baseline for digital banks, wallets, crypto, stocks, forex and payment businesses.", industryTags: "FINTECH", controls: [["PCI-6.2", "Secure software development", "Bespoke and custom software is developed securely throughout the development lifecycle.", "PCI DSS"], ["PCI-12.3", "Targeted risk analysis", "Flexible requirements are supported by a documented targeted risk analysis.", "PCI DSS"], ["DORA-6", "ICT risk management", "A sound, comprehensive and documented ICT risk management framework is maintained.", "DORA"], ["FIN-BCP-01", "Critical service resilience", "Critical financial services have tested continuity, recovery and exit arrangements.", "Common Controls"]] },
] as const;

export const planFrameworkLimit: Record<Plan, number> = { FREE: 1, BASIC: 2, PROFESSIONAL: 5, PREMIUM: 5 };
export const planMappingLimit: Record<Plan, number> = { FREE: 25, BASIC: 100, PROFESSIONAL: Number.POSITIVE_INFINITY, PREMIUM: Number.POSITIVE_INFINITY };
export function canManageFramework(role: Role) { return role === Role.OWNER || role === Role.RISK_MANAGER; }
export async function seedFrameworks() { for (const item of frameworkCatalog) { const framework = await db.framework.upsert({ where: { name: item.name }, update: { version: item.version, description: item.description, industryTags: item.industryTags }, create: { name: item.name, version: item.version, description: item.description, industryTags: item.industryTags } }); for (const [controlId, title, description, category] of item.controls) await db.frameworkControl.upsert({ where: { frameworkId_controlId: { frameworkId: framework.id, controlId } }, update: { title, description, category }, create: { frameworkId: framework.id, controlId, title, description, category } }); } }
export async function ensureTenantFrameworks(tenantId: string) {
  const frameworks = await db.framework.findMany({ select: { id: true } });
  await Promise.all(frameworks.map(({ id: frameworkId }) => db.tenantFramework.upsert({
    where: { tenantId_frameworkId: { tenantId, frameworkId } },
    update: {},
    create: { tenantId, frameworkId, enabled: false },
  })));
}
export async function enabledFrameworks(tenantId: string) {
  return db.framework.findMany({
    where: {
      tenantSelections: { some: { tenantId, enabled: true } },
    },
    include: { controls: true },
  });
}
export async function enabledControls(tenantId: string) {
  return db.frameworkControl.findMany({
    where: {
      framework: { tenantSelections: { some: { tenantId, enabled: true } } },
    },
    include: { framework: true },
    orderBy: [{ framework: { name: "asc" } }, { controlId: "asc" }],
  });
}
