# GRC Risk Register & Assessment Tool — Project Charter
## Purpose
Provide a focused, auditable workspace for identifying, assessing, prioritising, and treating organisational risk. The tool supports risk-informed decisions; it does not itself certify regulatory compliance.

## Vision and outcomes
- A single risk register with accountable owners and review dates.
- Consistent inherent and residual risk scoring using likelihood x impact on a 1-5 scale.
- Clear treatment decisions, prioritisation, and executive visibility.
- A foundation for authenticated, durable, auditable multi-tenant operation.

## Scope
**Current product slice:** risk register, search/filter, scoring bands, summary indicators, create-risk workflow, and risk detail view.

**Next increments:** complete durable Phase 4 queues/storage/trend history and the remaining production validation gates, alongside the governed lifecycle and configurable scoring work. Local persistence, authentication/RBAC, residual assessments, controls/actions, audit events, reconciled analytics, multi-format reporting, notifications, migration rehearsal tooling, secret scanning, role policy, and request correlation are implemented to the documented local-assessment level.

**Out of scope:** legal advice, automatic certification, autonomous risk acceptance, and claims of compliance with any framework without customer configuration and evidence.

## Principles
1. Risk decisions remain owned by people.
2. Scoring rules are explicit, versioned, and explainable.
3. Least privilege, data minimisation, and secure defaults.
4. Every material change should be attributable and reviewable.
5. Accessibility, responsive design, and plain language are product requirements.

## Success measures
- 100% of active risks have an owner, category, score, treatment, and review date.
- Critical risks are visible within one click and have an accountable treatment path.
- No secrets in frontend code or committed environment files.
- Automated API/UI checks cover core risk lifecycle paths before release.

## Governance
Product owner: project maintainer. Engineering decisions are recorded in `docs/DECISIONS.md`. Operational context and completed work are recorded in `MEMORY.md`. Review this charter at each milestone boundary.
