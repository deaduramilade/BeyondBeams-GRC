import { Plan, Role } from "@prisma/client";
import { db } from "@/lib/db";

type ControlSeed = readonly [string, string, string, string];
type FrameworkSeed = { name: string; version: string; description: string; industryTags: string; controls: readonly ControlSeed[] };

export const frameworkCatalog: readonly FrameworkSeed[] = [
  { name: "ISO 27001", version: "2022 Annex A", description: "Information security controls for an ISO/IEC 27001 information security management system.", industryTags: "ALL", controls: [
    ["A.5.1", "Policies for information security", "Information security policies are defined, approved, published, communicated and reviewed.", "Organisational"],
    ["A.5.7", "Threat intelligence", "Information relating to information security threats is collected and analysed.", "Organisational"],
    ["A.5.19", "Supplier relationships", "Processes manage information security risks associated with supplier products and services.", "Organisational"],
    ["A.5.23", "Cloud services security", "Processes for acquisition, use, management and exit from cloud services are established.", "Organisational"],
    ["A.6.3", "Information security awareness", "Personnel receive appropriate awareness, education and training.", "People"],
    ["A.8.2", "Privileged access rights", "The allocation and use of privileged access rights is restricted and managed.", "Technological"],
    ["A.8.8", "Technical vulnerabilities", "Information about technical vulnerabilities is obtained, evaluated and addressed.", "Technological"],
    ["A.8.15", "Logging", "Logs record relevant activities, exceptions, faults and events and are reviewed.", "Technological"],
    ["A.8.24", "Use of cryptography", "Rules for effective use of cryptography, including key management, are defined and implemented.", "Technological"],
    ["A.8.25", "Secure development life cycle", "Rules for secure software and systems development are established and applied.", "Technological"],
  ] },
  { name: "NIST Cybersecurity Framework", version: "2.0", description: "Outcome-based cybersecurity guidance organised around Govern, Identify, Protect, Detect, Respond and Recover.", industryTags: "ALL", controls: [
    ["GV.OC-01", "Organisational context", "The organisational mission is understood and informs cybersecurity risk management.", "Govern"],
    ["GV.RM-01", "Risk management objectives", "Risk management objectives are established and communicated.", "Govern"],
    ["ID.AM-01", "Asset inventories", "Inventories of hardware managed by the organisation are maintained.", "Identify"],
    ["ID.RA-01", "Vulnerability identification", "Vulnerabilities in assets are identified, validated and recorded.", "Identify"],
    ["PR.AA-01", "Identity management", "Identities and credentials for authorised users, services and hardware are managed.", "Protect"],
    ["PR.DS-01", "Data at rest", "The confidentiality, integrity and availability of data at rest are protected.", "Protect"],
    ["DE.CM-01", "Continuous monitoring", "Networks and network services are monitored to find potentially adverse events.", "Detect"],
    ["DE.AE-02", "Event analysis", "Potentially adverse events are analysed to understand associated activities.", "Detect"],
    ["RS.MA-01", "Incident management plan", "The incident response plan is executed in coordination with relevant parties.", "Respond"],
    ["RC.RP-01", "Recovery plan execution", "The recovery portion of the incident response plan is executed once initiated.", "Recover"],
  ] },
  { name: "SOC 2", version: "Trust Services Criteria 2017", description: "Controls aligned to the AICPA Trust Services Criteria for security, availability, processing integrity, confidentiality and privacy.", industryTags: "ALL", controls: [
    ["CC1.1", "Commitment to integrity", "The entity demonstrates a commitment to integrity and ethical values.", "Common Criteria"],
    ["CC2.2", "Internal communication", "Relevant quality information is communicated internally to support control responsibilities.", "Common Criteria"],
    ["CC3.2", "Risk identification and analysis", "The entity identifies and analyses risks to achievement of objectives.", "Common Criteria"],
    ["CC5.2", "Control activities", "Control activities are selected and developed to mitigate identified risks.", "Common Criteria"],
    ["CC6.1", "Logical access security", "Logical access security software, infrastructure and architectures are implemented.", "Common Criteria"],
    ["CC6.6", "External threats", "Logical access security measures protect against threats from outside system boundaries.", "Common Criteria"],
    ["CC7.2", "System monitoring", "The entity monitors system components and anomalies in a timely manner.", "Common Criteria"],
    ["CC8.1", "Change management", "Changes to infrastructure, data and software are authorised, tested and implemented.", "Common Criteria"],
    ["CC9.2", "Vendor risk", "Risks from business disruption and vendor relationships are assessed and managed.", "Common Criteria"],
  ] },
  { name: "Healthcare (HIPAA Security Rule)", version: "45 CFR Part 164", description: "Administrative, physical and technical safeguards for electronic protected health information.", industryTags: "HEALTHCARE", controls: [
    ["164.308(a)(1)", "Security management process", "Implement policies to prevent, detect, contain and correct security violations.", "Administrative"],
    ["164.308(a)(3)", "Workforce security", "Ensure workforce access is appropriate and terminated when no longer needed.", "Administrative"],
    ["164.308(a)(5)", "Security awareness and training", "Implement a security awareness and training programme for workforce members.", "Administrative"],
    ["164.308(a)(6)", "Security incident procedures", "Implement policies and procedures to address security incidents.", "Administrative"],
    ["164.312(a)(1)", "Access control", "Implement technical policies and procedures for access to electronic protected health information.", "Technical"],
    ["164.312(b)", "Audit controls", "Implement mechanisms that record and examine activity in systems containing ePHI.", "Technical"],
    ["164.312(c)(1)", "Integrity", "Protect ePHI from improper alteration or destruction.", "Technical"],
    ["164.312(e)(1)", "Transmission security", "Guard against unauthorised access to ePHI in transit.", "Technical"],
  ] },
  { name: "Fintech & Payments", version: "PCI DSS 4.0.1 / DORA / Common Controls", description: "Practical baseline for digital banks, wallets, crypto, stocks, forex and payment businesses.", industryTags: "FINTECH", controls: [
    ["PCI-6.2", "Secure software development", "Bespoke and custom software is developed securely throughout the development lifecycle.", "PCI DSS"],
    ["PCI-7.2", "Access control model", "Access is defined and assigned according to business need and least privilege.", "PCI DSS"],
    ["PCI-10.2", "Audit log review", "Audit logs support detection and response to suspicious activity.", "PCI DSS"],
    ["PCI-12.3", "Targeted risk analysis", "Flexible requirements are supported by a documented targeted risk analysis.", "PCI DSS"],
    ["DORA-6", "ICT risk management", "A sound, comprehensive and documented ICT risk management framework is maintained.", "DORA"],
    ["DORA-11", "Incident reporting", "Major ICT-related incidents are classified and reported to relevant authorities.", "DORA"],
    ["FIN-BCP-01", "Critical service resilience", "Critical financial services have tested continuity, recovery and exit arrangements.", "Common Controls"],
    ["FIN-MKT-01", "Market conduct surveillance", "Controls detect, investigate and escalate suspicious trading and customer activity.", "Common Controls"],
  ] },
] as const;

export const planFrameworkLimit: Record<Plan, number> = { FREE: 1, BASIC: 2, PROFESSIONAL: 5, PREMIUM: 5 };
export const planMappingLimit: Record<Plan, number> = { FREE: 10, BASIC: 50, PROFESSIONAL: Number.POSITIVE_INFINITY, PREMIUM: Number.POSITIVE_INFINITY };
export function canManageFramework(role: Role) { return role === Role.OWNER || role === Role.RISK_MANAGER; }

export async function seedFrameworks() {
  for (const item of frameworkCatalog) {
    const framework = await db.framework.upsert({ where: { name: item.name }, update: { version: item.version, description: item.description, industryTags: item.industryTags }, create: { name: item.name, version: item.version, description: item.description, industryTags: item.industryTags } });
    for (const [controlId, title, description, category] of item.controls) await db.frameworkControl.upsert({ where: { frameworkId_controlId: { frameworkId: framework.id, controlId } }, update: { title, description, category }, create: { frameworkId: framework.id, controlId, title, description, category } });
  }
}

export async function ensureTenantFrameworks(tenantId: string) {
  await seedFrameworks();
  const tenant = await db.tenant.findUnique({ where: { id: tenantId }, select: { plan: true } });
  if (!tenant) return;
  const [frameworks, selectionCount] = await Promise.all([db.framework.findMany({ orderBy: { name: "asc" }, select: { id: true } }), db.tenantFramework.count({ where: { tenantId } })]);
  if (selectionCount > 0) return;
  const allowed = planFrameworkLimit[tenant.plan];
  for (const framework of frameworks.slice(0, allowed)) await db.tenantFramework.create({ data: { tenantId, frameworkId: framework.id, enabled: true } });
}

export async function enabledFrameworks(tenantId: string) { return db.framework.findMany({ where: { tenantSelections: { some: { tenantId, enabled: true } } }, include: { controls: { orderBy: { controlId: "asc" } } }, orderBy: { name: "asc" } }); }
export async function enabledControls(tenantId: string) { return db.frameworkControl.findMany({ where: { framework: { tenantSelections: { some: { tenantId, enabled: true } } } }, include: { framework: true }, orderBy: [{ framework: { name: "asc" } }, { controlId: "asc" }] }); }