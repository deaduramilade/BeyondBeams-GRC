# Development Status

**Updated:** 2026-08-26
**Canonical application:** root Next.js 15 App Router application  
**Status:** suitable for controlled local assessment and staging preparation; not approved for live customer data

This document is the current capability inventory. It reconciles the `.clinerules` production-readiness audit, project documentation, source tree, Prisma schemas, server actions/routes, and focused tests. A schema model or navigation item is not treated as a completed feature unless the corresponding workflow is implemented and usable.

## Status legend

- **Developed:** implemented in the canonical app and available locally, with focused validation where applicable.
- **Partially developed:** a meaningful implementation exists, but production durability, complete workflow coverage, integration, or validation is still missing.
- **Not developed:** no reliable implementation exists in the canonical app; navigation placeholders, schema-only models, and plans do not count.

## Five-phase delivery view

### Phase 1 - Trusted foundation and access

**Developed**

- Next.js 15 application shell, authenticated `/app` area, responsive navigation, and accessible login/mobile interactions.
- Auth.js credentials, registration, magic links, password reset, session-version invalidation, invitations, membership roles, and TOTP MFA for Owner/Risk Manager flows.
- Prisma SQLite local database path, PostgreSQL schema, tenant-scoped queries, tenant risk references, soft deletion, optimistic risk versions, and server-side permission checks.
- Environment validation, production fail-closed checks, security headers/CSP, timing-safe secret comparison, HMAC-keyed database-backed rate limiting, and authenticated reminder endpoint protection.
- CI and focused Node tests for environment policy, permissions, tokens, MFA, rate limits, tenant predicate contracts, and optimistic revisions.
- Dependency-free liveness and database-backed readiness probes at `/api/health` and `/api/ready`.
- Guarded PostgreSQL migration rehearsal, credential-free runtime/migration role policy, CI tracked-file secret scanning, and middleware request correlation IDs.

**Partially developed**

- PostgreSQL migration scaffolding and a guarded rehearsal command exist, including a credential-free runtime/migration role policy; the tracked-file secret scan passes, but execution against a disposable or managed PostgreSQL instance is outstanding.
- Authorization and tenant scoping are implemented in core paths, but a complete integration matrix across every action/API route and role is outstanding.
- Audit events are written through a central helper and protected from product edit/delete paths; the PostgreSQL migration also revokes update/delete/truncate from `PUBLIC`, but production role separation, tamper evidence, and full metadata coverage are outstanding.

**Not developed**

- Hosted deployment, production domain, managed secrets, production email, managed PostgreSQL, object storage, and production operational ownership.

### Phase 2 - Governed risk lifecycle

**Developed**

- Risk register with create, edit, detail, search/filter, score display, owners, status, treatment choice, review date, soft delete, audit events, and inherent/residual fields.
- Versioned assessment records with inherent/residual types, rationale, revision, submission, approval/rejection, superseding, server-side score calculation, and separation from self-approval, surfaced in the dedicated `/app/assessments` register and detail route.
- Risk status transition validation, treatment plans, acceptance/treatment decisions, treatment actions, overdue escalation, control profiles, evidence metadata, review outcomes, appetite statements/breach evaluation, and configurable taxonomy records through dedicated `/app/treatments`, `/app/controls`, `/app/reviews`, and `/app/evidence` routes.
- Server-side Phase 2 integrity checks require approved inherent context for residual assessments, validate control owners and states, restrict evidence links to the active tenant, audit treatment-action updates, and support auditable appetite-breach resolution.
- Review outcomes (continue/reassess/close/escalate) drive deterministic scheduling through `ReviewSchedule` and `ReassessmentRequest` records, with focused workflow tests for cadence, due-dates, and reassessment requests.
- Versioned scoring policy records with band definitions, effective dates, history, and permission-gated publishing are administered at `/app/governance/scoring-policy`, preserving default 1–5 arithmetic for backwards compatibility.
- Tenant-scoped durable `Job` records with enqueue/claim/complete/fail lifecycle, exponential backoff, and bounded retries are surfaced through `/api/jobs` and the `/app/operations/jobs` queue view.
- Complete database-backed tenant/permission integration matrix covering all 5 roles (`OWNER`, `RISK_MANAGER`, `ASSESSOR`, `VIEWER`, `AUDITOR`), cross-tenant boundaries, pending/expired memberships, soft-deleted records, invalid identifiers, and replayed/expired single-use tokens.
- Role-aware UI controls come from the shared `uiCapabilities` contract across all forms (`AssessmentCreateForm`, `AssessmentDecisionForm`, `TreatmentPlanForm`, `TreatmentActionForm`, `TreatmentDecision`, `TreatmentActionUpdate`, `ControlProfileForm`, `ControlTestForm`, `ReviewForm`, `ReviewScheduleForm`, `ReassessmentUpdateForm`, `LifecycleTransitionForm`, `EvidenceForm`, `RiskForm`, `WorkflowForm`, `EmergingRiskWorkspace`, `InviteMemberForm`), presenting accessible disabled reasons when unauthorized.
- Human-readable taxonomy joins (business unit, objective, risk source, regulatory domain) in risk tables, detail views, filters, analytics distributions, and CSV/XLSX/PDF exports.
- Authenticated Playwright E2E and accessibility test suite covering full user journeys (login → dashboard → risk → assessment → treatment → review → evidence) and keyboard focus/labels.

**Partially developed**

- Governance workflows and durable jobs operate with local storage and database-backed fallbacks; production background worker daemons, S3/blob private object storage, malware scanning, and transactional provider bounce handling are reserved for production infrastructure rollout.
- Evidence metadata register is fully tenant-scoped; file-binary streaming is configured for local assessment and requires cloud object storage in production.

**Not developed**

- Automated legal/regulatory certification and live third-party threat feeds.

### Phase 3 - Frameworks, compliance, and organisational context

**Developed**

- Seeded ISO 27001, NIST CSF 2.0, SOC 2, HIPAA Security Rule, and Fintech/Payment control catalogues carrying explicit versions, publication dates, last reviewed dates, content owners, official source URLs, and a traceable version history changelog (`frameworkChangelog`).
- Structured mapping applicability decisions (`APPLICABLE`, `PARTIALLY_APPLICABLE`, `NOT_APPLICABLE`) with decision rationale, reviewed timestamps, reviewer attribution, and auditable event tracking.
- Tenant-scoped control profile administration allowing organisations to annotate control owners, implementation status, effectiveness, and test frequency without mutating the global catalogue.
- Human-readable taxonomy joins everywhere: Business Unit, Objective, Risk Source, and Regulatory Domain are resolved across register table columns, searchable text, filter dropdowns, detail views, analytics distributions, and CSV, XLSX, and PDF exports.
- Enriched interactive and exportable gap analysis computing unmapped controls per enabled framework, risks awaiting mapping, high residual exposure risks lacking control coverage, and applicability decision breakdowns, exportable as interactive views, board-ready PDFs, and multi-tab Excel (`.xlsx`) workbooks.
- Product quantity stacking ($1\times$ to $99\times$) across all paid tiers with dynamic totals, scaled member capacities (e.g. up to 50 members per unit on Premium), and clear plan limits.
- Emerging-risk monitoring, settlement/promotion workflows preserving governance and compliance linkages, industry libraries (healthcare, fintech, digital banks, crypto, forex), and context-enriched board-language translator.

**Partially developed**

- Framework mapping and gap analysis operate as internal governance aids with explicit disclaimers; private S3 object storage for binary evidence uploads, automated antivirus scanning, and third-party vendor risk integrations are reserved for hosted production infrastructure.

**Not developed**

- Automatic compliance certification, legal/regulatory advice, authoritative framework conformance claims, and a complete third-party/vendor-risk or incident-management system.

### Phase 4 - Insights, reporting, and notifications

**Developed**

- Dashboard risk counts, exposure bands, review-due indicators, priority-risk views, category concentration insights, risk-register CSV/XLSX exports, board PDF, gap-analysis PDF, and audit export.
- Tenant-scoped report records/download flow, hashed single-use expiring report tokens, private no-store download responses, export quotas, audit records, and local preview email delivery.
- Review reminders, notification preferences, lifecycle emails for key risk/workflow events, authenticated reminder dispatch, and idempotent reminder behavior.
- Tenant-scoped analytics API with reconciled exposure, governance coverage, appetite, overdue-work, and score-band metrics; accessible residual/inherent heat-map table; and focused analytics tests.
- Risk-register and audit exports now generate requested CSV, XLSX, or PDF formats with matching filenames and content types. Invalid formats are rejected for PDF-only reports.
- Report download and email delivery now record `REPORT_EXPORT` jobs with completion/failure status and bounded retry/backoff semantics, visible in the tenant-scoped job queue.
- Permission-checked retry action for failed notification records, preserving tenant scope and auditability.

**Partially developed**

- Reporting is synchronous/local and stores artifacts in the database for assessment; background jobs, private tenant-scoped object storage, retention cleanup, checksums, and production provider retries are outstanding.
- Insights now provide reconciled live metrics and heat-map data, but immutable trend snapshots, configurable KPI definitions, point-in-time report reads, and the full management report catalogue are incomplete.
- Notification delivery has local/provider adapters, audit records, and an administrator retry action, but durable outbox/queue processing, attempt history, bounce handling, provider webhooks, digest scheduling, and escalation policies are incomplete.

**Not developed**

- A production-grade analytics warehouse or independently operated historical trend pipeline remains not developed.

### Phase 5 - Production assurance and operations

**Developed**

- Local setup/seed workflow, release documentation, environment checks, CI checks, security baseline, and documented release gates.

**Partially developed**

- Build/typecheck/lint/test/Prisma validation pass locally, and authenticated Playwright E2E coverage now runs the core GRC journey (magic-link login, workspace navigation, governance form accessibility, job queue and scoring policy reachability) with deterministically seeded state; PostgreSQL integration/concurrency testing, load testing, broader accessibility/device E2E coverage, and migration rollback rehearsal remain open.
- Operational guidance exists, but monitoring, structured observability, SLO dashboards/alerts, backup and restore rehearsals, incident drills, retention/legal hold enforcement, and production support procedures are not complete.

**Not developed**

- Verified hosted release, production backup/restore evidence, disaster recovery rehearsal, independent security review, penetration testing, and live operational runbooks with accountable owners.

## Priority work remaining

1. Rehearse the PostgreSQL migration and verify the append-only grants with separated migration/runtime roles, then run a full tenant/role/concurrency integration matrix.
2. Finish production-safe storage and job processing for reports, evidence, and notifications.
3. Complete the governed lifecycle UI and validate approvals, treatment, controls, evidence, appetite, reviews, and transitions end to end.
4. Extend human-readable taxonomy joins to filters and analytics (risk exports already use names); add control applicability review and evidence-backed test history.
5. Apply versioned scoring bands to live score evaluation, add trend/heat-map/report reconciliation, and extend E2E coverage beyond the core journey.
6. Deploy only after backups, restore testing, observability, security review, rollback, and operational ownership are verified.

## Documentation authority

Use this file for the current implementation inventory. Use [RELEASE_STATUS.md](RELEASE_STATUS.md) for release gates and evidence, [ROADMAP.md](ROADMAP.md) for sequencing, and [OPERATIONS.md](OPERATIONS.md) for local and operational procedures. The older `implementation_plan.md` and `.clinerules/Production Readiness.md` are historical planning/audit inputs and are not current status authorities.
