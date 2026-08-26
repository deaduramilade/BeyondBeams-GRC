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

**Partially developed**

- PostgreSQL migration scaffolding exists, including a PostgreSQL schema and initial migration, but migration rehearsal against a disposable or managed PostgreSQL instance is outstanding.
- Authorization and tenant scoping are implemented in core paths, but a complete integration matrix across every action/API route and role is outstanding.
- Audit events are written through a central helper and protected from product edit/delete paths; the PostgreSQL migration also revokes update/delete/truncate from `PUBLIC`, but production role separation, tamper evidence, and full metadata coverage are outstanding.

**Not developed**

- Hosted deployment, production domain, managed secrets, production email, managed PostgreSQL, object storage, and production operational ownership.

### Phase 2 - Governed risk lifecycle

**Developed**

- Risk register with create, edit, detail, search/filter, score display, owners, status, treatment choice, review date, soft delete, audit events, and inherent/residual fields.
- Versioned assessment records with inherent/residual types, rationale, revision, submission, approval/rejection, superseding, server-side score calculation, and separation from self-approval.
- Risk status transition validation, treatment plans, acceptance/treatment decisions, treatment actions, overdue escalation, control profiles, evidence metadata, appetite statements/breach evaluation, and configurable taxonomy records through the governance workbench/actions.
- Server-side Phase 2 integrity checks now require approved inherent context for residual assessments, validate control owners and states, restrict evidence links to the active tenant, audit treatment-action updates, and support auditable appetite-breach resolution.

**Partially developed**

- Governance workflows are functional locally and the assessment, treatment, and control navigation targets now enter the governed workspace; the experience remains concentrated in one workbench rather than complete feature-owned registers and dedicated lifecycle views.
- Treatment and control records exist, but action history, dependencies, evidence upload/scanning/storage, control-to-risk effectiveness rollups, and full residual-assessment prerequisites are incomplete.
- Scoring uses the fixed 1-5 multiplication model. Versioned tenant scoring policies, configurable matrices/bands, policy history, and formal recalculation rules are not complete.
- Appetite breach records can be generated, but acknowledgement, treatment, acceptance, resolution, escalation notifications, and management reporting are incomplete.

**Not developed**

- A complete, independently validated end-to-end lifecycle covering every required transition, approval gate, review schedule, reopening/archive behavior, and PostgreSQL concurrency behavior.

### Phase 3 - Frameworks, compliance, and organisational context

**Developed**

- Seeded ISO 27001, NIST CSF 2.0, SOC 2, HIPAA Security Rule, and fintech/payment control catalogues.
- Workspace framework enable/disable, plan limits, control browsing, risk-to-control mapping, unmapped-risk view, curated compliance references, and framework gap-analysis output.
- Emerging-risk monitoring, settlement/promotion workflow, industry library, and board-language translator with usage limits.

**Partially developed**

- Framework mapping is a governance aid, not certification. This increment adds catalogue source/applicability metadata, publication/review ownership fields, a PostgreSQL migration, and tenant-scoped organisational-context selectors on risk records. Control evidence linkage and control testing remain partial: profiles and evidence metadata exist, but private file storage, scanning, test-result history, and effectiveness rollups are not production-ready.
- Taxonomy administration now feeds risk create/edit forms and is validated server-side for tenant ownership. Context identifiers are included in risk exports, while human-readable taxonomy joins in analytics, filters, and historical reporting remain the next integration step.

**Not developed**

- Automatic compliance certification, legal/regulatory advice, authoritative framework conformance claims, and a complete third-party/vendor-risk or incident-management system.

### Phase 4 - Insights, reporting, and notifications

**Developed**

- Dashboard risk counts, exposure bands, review-due indicators, priority-risk views, category concentration insights, risk-register CSV/XLSX exports, board PDF, gap-analysis PDF, and audit export.
- Tenant-scoped report records/download flow, hashed single-use expiring report tokens, private no-store download responses, export quotas, audit records, and local preview email delivery.
- Review reminders, notification preferences, lifecycle emails for key risk/workflow events, authenticated reminder dispatch, and idempotent reminder behavior.
- Tenant-scoped analytics API with reconciled exposure, governance coverage, appetite, overdue-work, and score-band metrics; accessible residual/inherent heat-map table; and focused analytics tests.
- Risk-register and audit exports now generate requested CSV, XLSX, or PDF formats with matching filenames and content types. Invalid formats are rejected for PDF-only reports.
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

- Build/typecheck/lint/test/Prisma validation pass locally, but authenticated browser acceptance, PostgreSQL integration/concurrency testing, load testing, accessibility E2E coverage, and migration rollback rehearsal remain open.
- Operational guidance exists, but monitoring, structured observability, SLO dashboards/alerts, backup and restore rehearsals, incident drills, retention/legal hold enforcement, and production support procedures are not complete.

**Not developed**

- Verified hosted release, production backup/restore evidence, disaster recovery rehearsal, independent security review, penetration testing, and live operational runbooks with accountable owners.

## Priority work remaining

1. Rehearse the PostgreSQL migration and verify the append-only grants with separated migration/runtime roles, then run a full tenant/role/concurrency integration matrix.
2. Finish production-safe storage and job processing for reports, evidence, and notifications.
3. Complete the governed lifecycle UI and validate approvals, treatment, controls, evidence, appetite, reviews, and transitions end to end.
4. Add human-readable taxonomy joins to filters, analytics, and reports; add control applicability review and evidence-backed test history.
5. Add trend/heat-map/report reconciliation and complete accessibility/E2E coverage.
6. Deploy only after backups, restore testing, observability, security review, rollback, and operational ownership are verified.

## Documentation authority

Use this file for the current implementation inventory. Use [RELEASE_STATUS.md](RELEASE_STATUS.md) for release gates and evidence, [ROADMAP.md](ROADMAP.md) for sequencing, and [OPERATIONS.md](OPERATIONS.md) for local and operational procedures. The older `implementation_plan.md` and `.clinerules/Production Readiness.md` are historical planning/audit inputs and are not current status authorities.
