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

- Expanded 8-report catalogue: Risk Register, Board Risk Report, Framework Gap Analysis, Treatment Status & Action Progress, Control Effectiveness Summary, Overdue Items (Reviews & Actions), Portfolio Exposure Summary, and Audit Activity Trail across CSV, XLSX, and PDF where applicable.
- Dedicated Report Centre workspace at `/app/reports` with interactive report catalogue, format selectors, live reconciliation metrics, tier quotas, and direct email delivery.
- Private report artifact storage abstraction (`ReportStorageAdapter` / `LocalReportStorageAdapter`) with tenant-prefixed keys, SHA-256 checksums, size metadata, expiration checks, and download audit logging.
- Single-use, 24-hour expiring, SHA-256 hashed report download tokens with atomic consumption upon download, rejection of replayed/expired tokens, and private no-store cache headers.
- Immutable point-in-time `AnalyticsSnapshot` generation (daily/monthly) capturing exposure, score distributions, heatmaps, and reconciliation data for trend consistency.
- Durable background job outbox with full status lifecycle (`QUEUED` → `PROCESSING` → `COMPLETED` / `FAILED`), exponential backoff retry semantics, max attempt limits, and administrator retry action in `/app/operations/jobs`.
- Robust notification delivery with non-corrupting error isolation (failures never roll back domain transactions), administrator retries, and webhook extension point for provider bounce/complaint ingestion.
- Reconciled, residual-first insights dashboard with accessible 5×5 heat map, category, business unit, and objective concentration charts.

**Partially developed**

- Local development uses durable database-backed queue and local storage adapters; production cloud object storage (S3/GCS), distributed queue worker daemons, and provider bounce webhooks are reserved for hosted production infrastructure.

**Not developed**

- A multi-tenant enterprise data warehouse, automated BI connector pipelines, and production email deliverability monitoring remain future infrastructure milestones.

### Phase 5 - Production assurance and operations

**Developed**

- Request correlation (`x-request-id`) propagated through middleware, API routes, server actions, and audit records.
- Structured JSON logging (`lib/logger.ts`) with recursive automated redaction of sensitive credentials, tokens, passwords, and links.
- Operational metrics collection (`lib/metrics.ts` and `/api/metrics`) tracking authentication, report generation, jobs, notifications, and retention purges.
- Standardized liveness (`/api/health`, `/api/health/live`) and database readiness (`/api/ready`) probes.
- Retention engine (`lib/retention.ts` and `scripts/retention-cleanup.cjs`) supporting dry-run and live purges of expired report artifacts and tokens while strictly honoring tenant `legalHold: true`.
- PostgreSQL backup and restore rehearsal script (`scripts/postgres-backup-restore.cjs`) proving 100% record parity across table schemas in containerized tests.
- CI workflow hardening (`.github/workflows/release-foundation.yml`) enforcing fail-closed release gates across TypeScript typecheck, ESLint, unit/integration test suite, tenant-isolation contracts, dual-schema validations, secret scans, and production builds.
- Expanded Playwright E2E journey tests (`e2e/grpc-journey.spec.ts`) covering core workflows, report catalogue downloads, and form accessibility.
- Operational and security documentation pack: [docs/RELEASE.md](RELEASE.md), [docs/OPERATIONS.md](OPERATIONS.md), and [docs/SECURITY.md](SECURITY.md).

**Partially developed**

- Local development uses SQLite (`dev.db`) and local storage adapters; production cloud object storage (S3/GCS), distributed queue worker daemons, and provider bounce webhooks are reserved for hosted infrastructure rollout.

**Not developed**

- Hosted staging/production cloud infrastructure, automated external database backups with Point-in-Time Recovery (PITR), production APM/SLO dashboards, third-party penetration testing, and formal SOC 2 / ISO certification audits remain future operational milestones. The application is strictly not approved for real customer data until these infrastructure gates are satisfied.

## Priority work remaining

1. Provision cloud infrastructure (managed PostgreSQL with automated backups, KMS-encrypted S3/GCS storage bucket, Redis queue daemons).
2. Configure transactional email DNS records (SPF, DKIM, DMARC) with production Resend API keys and provider bounce webhooks.
3. Establish centralized telemetry and alerting (OpenTelemetry / Datadog / Prometheus).
4. Conduct independent third-party penetration testing and security review before customer data ingestion.

## Documentation authority

Use this file for the current implementation inventory. Use [RELEASE.md](RELEASE.md) for release gates and procedures, [OPERATIONS.md](OPERATIONS.md) for operational procedures, [SECURITY.md](SECURITY.md) for the security baseline, [RELEASE_STATUS.md](RELEASE_STATUS.md) for release gates, and [ROADMAP.md](ROADMAP.md) for sequencing.
