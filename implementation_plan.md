# Implementation Plan

> Historical planning input. The canonical application is now the root Next.js 15 App Router project. Use [docs/DEVELOPMENT_STATUS.md](docs/DEVELOPMENT_STATUS.md) and [docs/ROADMAP.md](docs/ROADMAP.md) for current status and sequencing; the React/Vite + FastAPI structure below is retained for traceability only.

Phase 2 local governance actions have since been implemented in `app/actions/governance.ts`, with tenant-safe evidence/control validation, residual-assessment prerequisites, treatment-action updates, and appetite-breach resolution. The Phase 3 increment also adds framework source/applicability metadata, tenant-scoped organisational context links on risks, selectors in risk/governance forms, and the PostgreSQL migration `20260825120000_phase3_context_governance`. Do not use the unexecuted file list below as a claim of current gaps; use `docs/DEVELOPMENT_STATUS.md`, `docs/RELEASE_STATUS.md`, and `docs/ROADMAP.md` for current truth.

## Overview

Establish Northstar GRC as a professional organizational risk-management platform with durable risk records, inherent and residual assessments, heat maps, treatment and control tracking, auditable governance workflows, and management reporting.

The repository currently contains a functional React/Vite prototype backed by in-memory browser state, plus a FastAPI health endpoint and PostgreSQL development container. The current UI can create, search, filter, score, and inspect basic risks, but it has no durable data, authentication, workspace isolation, controls, residual-risk calculation, heat map, audit trail, or generated reports. Those limitations must remain explicit until implementation and validation prove otherwise.

Most root Markdown files were imported from an unrelated Pluralbeam commerce project. Per the agreed direction, applicable documents will be rewritten as authoritative GRC documents, commerce-only documents will be deleted, and missing domain specifications will be added. Documentation will distinguish current capability, approved specification, and planned work so that aspirational content is never presented as implemented functionality.

Development will be delivered in three phases. Phase 1 creates the trusted multi-tenant data and security foundation. Phase 2 completes the governed risk lifecycle, including inherent and residual assessment, controls, treatment, review, approval, and heat maps. Phase 3 adds management reporting, analytics, notifications, operational hardening, and release assurance.

Phase 1 local readiness tooling now includes `npm run security:scan`, guarded `npm run db:migrate:rehearse`, middleware request correlation IDs, and the credential-free PostgreSQL runtime/migration policy template in `prisma/production-roles.sql`. Their execution against real PostgreSQL and hosted infrastructure remains an external release gate.

## Types

### Shared domain types

Create frontend TypeScript domain contracts in `frontend/src/types/` after converting the active frontend from JavaScript to TypeScript. Backend equivalents will be Pydantic models in `backend/app/schemas/` and SQLAlchemy models in `backend/app/models/`. API schemas are contracts and database models are persistence concerns; neither should be reused as the other.

- `Workspace`: `id`, `name`, `slug`, `status`, `timezone`, `created_at`, `updated_at`.
- `User`: `id`, `workspace_id`, `email`, `display_name`, `status`, `last_login_at`, timestamps.
- `WorkspaceMembership`: `workspace_id`, `user_id`, `role`, `joined_at`.
- `Role`: `workspace_admin`, `risk_manager`, `risk_owner`, `control_owner`, `reviewer`, `executive`, `auditor`, `viewer`.
- `Permission`: explicit action identifiers such as `risk:create`, `risk:update`, `assessment:approve`, `report:export`, and `audit:read`.
- `Risk`: immutable identifier plus workspace, title, structured cause-event-impact statement, description, category, business unit, objective, owner, status, treatment strategy, appetite state, review dates, timestamps, and optimistic-lock version.
- `RiskStatus`: `draft`, `open`, `under_review`, `treatment_in_progress`, `monitoring`, `accepted`, `closed`, `archived` with documented transition rules.
- `RiskCategory`: workspace-configurable category record rather than a hard-coded enum.
- `RiskAssessment`: `id`, `risk_id`, `assessment_type`, likelihood, impact, calculated score, level, rationale, policy version, assessor, assessment date, approval state, approver, approval date, and timestamps.
- `AssessmentType`: `inherent` or `residual`; records are separate and historical assessments are append-only after approval.
- `AssessmentDecision`: `draft`, `submitted`, `approved`, `rejected`, `superseded`.
- `ScoringPolicy`: versioned likelihood scale, impact scale, matrix, level bands, colors, appetite thresholds, effective dates, and active state. The recorded initial policy uses likelihood x impact on a 1-5 scale.
- `RiskLevel`: configurable level record with code, label, score range/matrix cells, rank, semantic color token, and escalation requirement.
- `Control`: workspace control record with title, description, type, owner, frequency, design rating, operating rating, evidence requirements, status, and review dates.
- `ControlType`: `preventive`, `detective`, `corrective`, `directive`.
- `ControlEffectiveness`: `not_assessed`, `ineffective`, `partially_effective`, `largely_effective`, `effective`.
- `RiskControl`: many-to-many linkage between risks and controls with contribution notes and applicability.
- `TreatmentPlan`: risk, strategy, accountable owner, target residual level, due date, status, approval fields, budget/cost notes, and timestamps.
- `TreatmentStrategy`: `avoid`, `reduce`, `transfer`, `accept`.
- `TreatmentStatus`: `draft`, `planned`, `in_progress`, `blocked`, `completed`, `cancelled`, `overdue`.
- `TreatmentAction`: plan, title, description, owner, due date, priority, progress, status, completion evidence, timestamps.
- `EvidenceAttachment`: metadata only in PostgreSQL; object key, original name, media type, size, checksum, uploader, classification, retention date, and malware-scan state.
- `Review`: risk, reviewer, due date, completed date, outcome, notes, next review date.
- `Comment`: workspace-scoped discussion record with author and timestamps; edits/deletions remain auditable.
- `AuditEvent`: append-only actor, workspace, action, resource type/id, timestamp, request/correlation ID, source IP metadata, outcome, and redacted before/after change summary.
- `RiskAppetite`: workspace/category thresholds, tolerance statement, escalation owner, effective dates, and status.
- `HeatMapCell`: likelihood, impact, risk count, risk IDs or drill-down query metadata, and level.
- `DashboardMetrics`: totals, level distribution, appetite breaches, overdue reviews/actions, treatment coverage, control effectiveness, and trend comparisons.
- `ReportDefinition`: report type, filters, columns/sections, schedule metadata, output format, and access scope.
- `ReportRun`: immutable generation request, requester, parameters snapshot, status, storage reference, checksum, row count, generated/expiry timestamps, and failure reason.
- `ReportType`: `executive_summary`, `risk_register`, `risk_profile`, `treatment_status`, `control_effectiveness`, `overdue_items`, `audit_activity`.
- `ReportFormat`: `csv` and `pdf` initially; `xlsx` only after a concrete need and dependency review.
- `Notification`: recipient, event type, subject resource, delivery channels, read state, delivery state, timestamps.
- `ApiError`: machine-readable `code`, human-readable `message`, optional field errors, and `request_id`.
- `Page[T]`: items plus cursor or offset pagination metadata, with one strategy selected consistently before API implementation.

### Database constraints

- Every business record carries `workspace_id`; repository queries require workspace scope.
- Approved assessments, audit events, and completed report snapshots are immutable.
- Foreign keys prevent cross-workspace relationships through service validation and database-safe identifiers.
- Uniqueness covers workspace slug, membership pair, risk reference within workspace, and scoring-policy version within workspace.
- Soft deletion is limited to records with recovery/business value; audit events are never deleted through product APIs.
- UTC timestamps are stored server-side; workspace timezone affects presentation and schedules only.
- Scores, levels, appetite status, dashboard metrics, and report facts are calculated authoritatively on the backend.

## Files

### Documentation files to rewrite

All paths below are under `C:\Users\koola\Documents\GitHub\GRC-Risk-Register`.

- `README.md`: concise mission, truthful current status, architecture, setup, validation, security warnings, documentation map, and three-phase delivery status.
- `MEMORY.md`: authoritative assistant memory containing stable mission, actual stack, repository map, accepted risk semantics, non-negotiable security rules, current baseline, and next work. Remove all commerce history.
- `CONTEXT.md`: current implementation state, active phase, verified capabilities, known blockers, and immediate next tasks.
- `agent.md`: repository-agent instructions aligned to React/Vite, FastAPI, PostgreSQL, GRC semantics, validation, documentation truthfulness, and memory update policy.
- `agent-log.md`: reset to concise GRC investigation/history notes and durable lessons; do not preserve unrelated Pluralbeam claims.
- `TASKS.md`: replace commerce checklist with the three development phases and verifiable status markers.
- `LOG.md`: reset to a chronological GRC engineering log with an entry for documentation rationalization.
- `CHANGELOG.md`: use Keep a Changelog-style, release-facing GRC changes with an `Unreleased` section; remove fictional version history.
- `ARCHITECTURE.md`: replace Next.js/MongoDB/payment architecture with React/Vite -> FastAPI -> PostgreSQL, domain boundaries, request/data flows, multi-tenancy, reporting jobs, object storage, and deployment topology.
- `API.md`: replace commerce endpoints with versioned risk, assessment, control, treatment, dashboard, heat-map, report, audit, taxonomy, user, and workspace contracts.
- `RBAC.md`: define GRC roles, permission matrix, separation of duties, workspace scope, resource ownership, approval permissions, and audit requirements.
- `SECURITY.md`: align with FastAPI/Pydantic/PostgreSQL and organizational risk data; specify OIDC, secure sessions, tenant isolation, rate limits, evidence security, report authorization, audit integrity, and OWASP controls.
- `TESTING.md`: align tooling with Pytest and a selected React test stack; cover scoring boundaries, state transitions, permissions, tenant isolation, audit immutability, heat maps, report accuracy, accessibility, and E2E workflows.
- `DESIGN_SYSTEM.md`: define a restrained, professional operational UI, semantic risk colors, dense tables, accessible heat maps, forms, dialogs, status badges, responsive behavior, and Lucide usage.
- `ACCESSIBILITY.md`: specify WCAG 2.2 AA, keyboard and screen-reader workflows, non-color heat-map encoding, focus management, reduced motion, table alternatives, and report accessibility.
- `ANALYTICS.md`: define risk KPIs, aggregation rules, dimensions, trends, appetite breaches, treatment/control metrics, data freshness, and reconciliation to register data.
- `BACKUP_RECOVERING.md`: move to `BACKUP_RECOVERY.md` and rewrite for PostgreSQL, report artifacts, evidence objects, retention, encryption, RPO/RTO, restore rehearsals, and tenant-safe recovery.
- `CLI.md`: document actual PowerShell-compatible local commands for frontend, backend, PostgreSQL, tests, migrations, formatting, and health checks; no nonexistent scripts.
- `CODE_REVIEW_GUIDE.md`: add GRC correctness, tenant isolation, permissions, scoring, audit, privacy, migration, accessibility, and report-review checklists.
- `CODING_STANDARD.md`: define Python and TypeScript conventions, domain/service/repository boundaries, validation, errors, typing, async policy, and secure coding.
- `COMPLIANCE.md`: clarify that the platform supports governance evidence and mappings but does not confer certification; cover configurable mappings, control evidence, retention, and human accountability.
- `COMPONENTS.md`: document planned application shell, risk table, assessment form, score display, heat map, treatment board, control table, filters, report builder, and accessible primitives.
- `CONTRIBUTING.md`: align setup, branching, scoped changes, migrations, tests, documentation truthfulness, security reporting, and pull-request expectations.
- `DATA_RETENTION.md`: define data classes, configurable retention, legal hold, deletion/anonymization, evidence/report expiry, audit retention, and verified purge jobs.
- `DEPLOYMENT.md`: specify environment promotion, container topology, managed PostgreSQL/object storage, migrations, secret management, health/readiness checks, rollback, and post-deploy verification.
- `EMAILS.md`: repurpose as risk notifications and email delivery requirements for assignments, review reminders, overdue actions, appetite breaches, approvals, and report delivery; no sensitive report attachment by default.
- `ENVIRONMENT.md`: list only real/current variables and clearly label planned variables for database, OIDC, storage, mail, observability, and report workers.
- `FEATURE_FLAGS.md`: define workspace-aware, server-authoritative flags, rollout/audit rules, defaults, cleanup, and prohibited use for authorization.
- `HOOKS.md`: define planned typed frontend data/query hooks and rules; remove nonexistent Next.js hooks.
- `INCIDENT_RESPONSE.md`: cover security, privacy, integrity, availability, cross-tenant exposure, audit compromise, incorrect scoring, and report disclosure incidents.
- `LOCAL_DEVELOPMENT.md`: provide exact Windows/PowerShell and portable setup for current stack, database startup, migrations, tests, and sample data.
- `MIGRATIONS.md`: define Alembic migration lifecycle, expand/migrate/contract strategy, tenant-aware data backfills, rollback limits, review, and rehearsal.
- `MOBILE.md`: define mobile access for approvals, review, treatment updates, register scanning, and heat-map alternatives without pretending all desktop density fits a phone.
- `OBSERVABILITY.md`: define structured logs, request IDs, metrics, traces, audit separation, scoring/report correctness signals, SLOs, dashboards, and alerts.
- `PERFORMANCE.md`: establish budgets for register queries, heat-map aggregation, dashboards, report jobs, indexes, pagination, caching constraints, and load tests.
- `PRIVACY.md`: document organizational/user data classes, minimization, purpose limitation, access/export/deletion handling, evidence sensitivity, subprocessors, and privacy review.
- `RELEASE_NOTES.md`: replace fictional Pluralbeam releases with a template and truthful `Unreleased` prototype baseline.
- `RELEASE_PROCESS.md`: define versioning, release gates, migration rehearsal, security/accessibility checks, backup verification, report reconciliation, deployment, rollback, and communication.
- `SDK.md`: redefine as a future typed API client contract; clearly mark it unimplemented and document authentication, pagination, errors, idempotency, and generated-client policy.
- `SERVICES.md`: define backend application services for scoring, risks, assessments, controls, treatments, heat maps, dashboards, reports, notifications, audit, files, and authorization.
- `SUPPORT.md`: define operational support for access, data correction, workflow, report, scoring-policy, and incident issues, including safe impersonation constraints and escalation.

### New domain documentation files

- `RISK_METHODOLOGY.md`: authoritative risk terminology, cause-event-impact statements, inherent/residual distinction, 1-4 default likelihood/impact criteria, matrix/bands, rationale requirements, appetite, review, and approval rules.
- `DATA_MODEL.md`: entities, relationships, constraints, indexes, tenancy, lifecycle, immutability, deletion, and data classification.
- `RISK_LIFECYCLE.md`: creation through identification, inherent assessment, evaluation, treatment, control linkage, residual assessment, approval, monitoring, closure, reopening, and archival.
- `TREATMENT_AND_CONTROLS.md`: treatment strategies, plans/actions, control ownership/design/operation, evidence, effectiveness, overdue/escalation logic, and residual reassessment prerequisites.
- `HEAT_MAPS.md`: matrix construction, inherent/residual modes, filters, drill-down, empty cells, aggregation, accessible table alternative, color semantics, and export behavior.
- `REPORTING.md`: management report catalogue, definitions, filters, point-in-time consistency, templates, CSV/PDF behavior, permissions, scheduling, retention, reconciliation, and audit events.
- `AUDIT_TRAIL.md`: event taxonomy, append-only design, before/after redaction, correlation IDs, privileged access, retention, export, integrity checks, and prohibited mutation.
- `AUTHENTICATION.md`: OIDC-based authentication target, session lifecycle, MFA/SSO readiness, invitation and membership flow, account states, service accounts, and recovery.
- `NOTIFICATIONS.md`: in-app/email event catalogue, recipient resolution, preferences, digest/reminder rules, retries, deduplication, escalation, and sensitive-data limits.
- `REPORT_CATALOG.md`: exact management report definitions and required fields for executive summary, full register, risk profile, appetite breaches, treatments/actions, controls, overdue reviews, and audit activity.

### Commerce-only documentation files to delete

- `CHECKOUT_DELIVERY.md`
- `CHECKOUT_IMPLEMENTATION_CHECKLIST.md`
- `HIGH_VALUE_ORDER_IMPLEMENTATION.md`
- `HIGH_VALUE_ORDER_QUICK_REFERENCE.md`
- `INVOICE_PREVIEW_DOCUMENTATION.md`
- `INVOICE_PREVIEW_QUICK_START.md`
- `INVOICING.md`
- `PAYMENTS.md`
- `PRICING.md`
- `SELF_SERVE_CHECKOUT_READY.md`

Their commerce content has no valid place in a GRC risk register and should not be archived inside the active repository documentation set.

### Existing source files to modify during development

- `frontend/package.json`: add only approved TypeScript, routing, API-query, form/validation, chart/heat-map, testing, and accessibility dependencies after package selection; add `typecheck`, `lint`, and `test` scripts.
- `frontend/src/App.jsx`: replace the legacy wrapper and remove dead commerce-style shell reference after migration; become typed application routing/shell composition.
- `frontend/src/RiskAssessment.jsx`: decompose into domain pages/components and replace local seed state with API-backed queries/mutations.
- `frontend/src/index.css`: replace ad hoc palette with documented design tokens, semantic risk levels, accessible focus states, print/report rules, and responsive operational layouts.
- `frontend/src/main.jsx`: add router, API-query provider, authentication/session provider, and error boundary after dependencies are approved.
- `frontend/vite.config.js`: configure test environment, development API proxy, and build behavior as required.
- `frontend/tailwind.config.js`: define semantic design tokens and content paths for typed files.
- `backend/requirements.txt`: add persistence, migrations, PostgreSQL driver, authentication/JWT verification, multipart/object-storage integration, PDF/reporting, background jobs, lint/type tooling, and test dependencies only as required by each phase.
- `backend/app/main.py`: add lifespan setup, versioned routers, middleware, request IDs, exception handling, security headers, and readiness endpoint.
- `backend/app/core/config.py`: typed configuration for database, OIDC, storage, mail, report workers, logging, and environment validation without insecure production defaults.
- `.env.example`: document safe placeholders grouped by current and planned capability; never include secrets.
- `docker-compose.yml`: add application services only when useful; retain PostgreSQL health checks and add test/development dependencies such as object storage or mail capture only when selected.
- `.gitignore`: add tool-specific caches, generated API clients, local evidence/report artifacts, and coverage outputs introduced by implementation.

### New source directories/files during development

- `backend/alembic.ini` and `backend/alembic/`: migration configuration and revisions.
- `backend/app/db/session.py`, `base.py`: engine/session lifecycle and declarative base.
- `backend/app/models/*.py`: workspace, identity, risk, assessment, scoring, control, treatment, review, audit, report, notification, and file models.
- `backend/app/schemas/*.py`: request/response contracts separated by domain.
- `backend/app/repositories/*.py`: workspace-scoped persistence interfaces and SQLAlchemy implementations.
- `backend/app/services/*.py`: business workflows and authoritative calculations.
- `backend/app/api/v1/*.py`: versioned route modules.
- `backend/app/core/security.py`, `permissions.py`, `errors.py`, `logging.py`: identity verification, authorization, errors, and structured logging.
- `backend/app/workers/*.py`: report and notification jobs after the worker mechanism is selected.
- `frontend/src/types/*.ts`: generated or hand-maintained API/domain view types.
- `frontend/src/lib/api.ts`, `errors.ts`, `formatters.ts`: HTTP client, normalized errors, and presentation formatting.
- `frontend/src/features/risks/`, `assessments/`, `controls/`, `treatments/`, `heat-map/`, `reports/`, `audit/`, `settings/`: feature-owned pages, components, hooks, and tests.
- `frontend/src/components/ui/` and `layout/`: small reusable primitives and application shell.
- `.github/workflows/ci.yml`: backend/frontend lint, type, unit/integration test, build, migration check, and dependency/security checks.

## Functions

Exact signatures may receive framework-specific dependency parameters, but domain inputs/outputs must remain equivalent to the following.

### Phase 1 backend functions

- `calculate_score(likelihood: int, impact: int, policy: ScoringPolicy) -> ScoreResult` in `backend/app/services/scoring.py`: validate scale values and derive score/level from the versioned policy.
- `create_risk(workspace_id: UUID, actor: Principal, data: RiskCreate) -> RiskRead` in `backend/app/services/risks.py`: authorize, create reference, persist risk, and append audit event atomically.
- `list_risks(workspace_id: UUID, actor: Principal, query: RiskQuery) -> Page[RiskSummary]`: server-side search, filters, sort, and pagination.
- `get_risk(workspace_id: UUID, actor: Principal, risk_id: UUID) -> RiskDetail`: load complete authorized detail without cross-tenant leakage.
- `update_risk(workspace_id: UUID, actor: Principal, risk_id: UUID, data: RiskUpdate, expected_version: int) -> RiskRead`: enforce transition and optimistic concurrency rules.
- `archive_risk(...) -> None`: archive rather than physically delete governed records and audit the action.
- `create_assessment(workspace_id: UUID, actor: Principal, risk_id: UUID, data: AssessmentCreate) -> AssessmentRead`: calculate server-side score and preserve policy version.
- `submit_assessment(...)`, `approve_assessment(...)`, `reject_assessment(...)`: enforce role separation and immutable approval history.
- `require_permission(principal: Principal, permission: Permission, workspace_id: UUID) -> None` in `backend/app/core/permissions.py`: central authorization guard.
- `append_audit_event(session: Session, event: AuditEventCreate) -> AuditEventRead` in `backend/app/services/audit.py`: append redacted immutable event in the business transaction.
- `get_current_principal(request: Request) -> Principal` in `backend/app/core/security.py`: verify trusted OIDC token/session and resolve active workspace membership.

### Phase 2 backend functions

- `create_control(...)`, `update_control(...)`, `link_control_to_risk(...)`, `assess_control_effectiveness(...)` in `backend/app/services/controls.py`.
- `create_treatment_plan(...)`, `update_treatment_plan(...)`, `add_treatment_action(...)`, `complete_treatment_action(...)` in `backend/app/services/treatments.py`.
- `validate_residual_assessment_prerequisites(risk: Risk, controls: list[Control], plan: TreatmentPlan | None) -> None`: require documented control/treatment context and rationale without mathematically deriving residual risk from inherent risk.
- `schedule_review(...)`, `complete_review(...)`, `find_overdue_reviews(as_of: datetime) -> list[Review]` in `backend/app/services/reviews.py`.
- `build_heat_map(workspace_id: UUID, actor: Principal, query: HeatMapQuery) -> HeatMapRead` in `backend/app/services/heat_maps.py`: aggregate authorized risks by selected assessment type and filters.
- `evaluate_appetite(assessment: RiskAssessment, appetite: RiskAppetite) -> AppetiteResult`: determine threshold status and required escalation.
- `transition_risk_status(risk: Risk, target: RiskStatus, actor: Principal) -> Risk`: central state-machine validation.

### Phase 3 backend functions

- `get_dashboard_metrics(...) -> DashboardMetrics` and `get_risk_trends(...) -> RiskTrendSeries` in `backend/app/services/analytics.py`.
- `create_report_run(workspace_id: UUID, actor: Principal, definition: ReportRequest) -> ReportRunRead` in `backend/app/services/reports.py`: authorize, snapshot parameters, enqueue generation, and audit request.
- `generate_csv_report(run_id: UUID) -> StoredReport` and `generate_pdf_report(run_id: UUID) -> StoredReport`: generate point-in-time, reconciled artifacts with checksums and expiry.
- `get_report_download(run_id: UUID, actor: Principal) -> SignedDownload`: reauthorize every download and return a short-lived reference.
- `resolve_notification_recipients(event: DomainEvent) -> list[Recipient]`, `dispatch_notification(...)`, and `send_review_reminders(as_of: datetime)` in `backend/app/services/notifications.py`.
- `redact_log_context(context: dict[str, Any]) -> dict[str, Any]` in `backend/app/core/logging.py`: remove secrets and sensitive evidence/report data.

### Frontend functions and hooks

- `useRisks(filters: RiskFilters)`, `useRisk(id: string)`, `useCreateRisk()`, `useUpdateRisk()` in `frontend/src/features/risks/api.ts`.
- `useAssessments(riskId: string)`, `useCreateAssessment()`, `useAssessmentApproval()` in `frontend/src/features/assessments/api.ts`.
- `useHeatMap(filters: HeatMapFilters)` in `frontend/src/features/heat-map/api.ts`.
- `useTreatmentPlan(riskId: string)` and treatment/control mutations in their feature API modules.
- `useDashboardMetrics(filters: DashboardFilters)` and `useReports()` in analytics/report modules.
- `getRiskLevelPresentation(level: RiskLevel): RiskLevelPresentation`: map server semantic level to accessible label/token; never independently calculate official level in UI.
- `formatRiskReference`, `formatDate`, `formatPercentage`, and `formatScore`: locale-aware presentation utilities.
- Existing `RiskAssessment.addRisk` local-state logic will be removed after API-backed creation is in place; its behavior migrates to `useCreateRisk` and backend `create_risk`.
- Existing `levels(score)` UI scoring will be removed after backend scoring is active; temporary use is permitted only behind explicit prototype labeling during Phase 1 migration.

## Classes

### Backend classes

- `Settings` in `backend/app/core/config.py`: extend existing `BaseSettings` with validated environment configuration and production-safe checks.
- `Base` in `backend/app/db/base.py`: SQLAlchemy declarative base.
- SQLAlchemy entities `WorkspaceModel`, `UserModel`, `MembershipModel`, `RiskModel`, `AssessmentModel`, `ScoringPolicyModel`, `RiskCategoryModel`, `RiskAppetiteModel`, `ControlModel`, `RiskControlModel`, `TreatmentPlanModel`, `TreatmentActionModel`, `ReviewModel`, `EvidenceAttachmentModel`, `AuditEventModel`, `ReportDefinitionModel`, `ReportRunModel`, and `NotificationModel` in `backend/app/models/`.
- Pydantic request/read classes grouped by domain, including `RiskCreate`, `RiskUpdate`, `RiskRead`, `RiskDetail`, `AssessmentCreate`, `AssessmentRead`, `ControlCreate`, `TreatmentPlanCreate`, `HeatMapQuery`, `HeatMapRead`, `ReportRequest`, `ReportRunRead`, and `ProblemDetail` in `backend/app/schemas/`.
- `RiskRepository`, `AssessmentRepository`, `ControlRepository`, `TreatmentRepository`, `AuditRepository`, and `ReportRepository` protocols plus SQLAlchemy implementations in `backend/app/repositories/`; every method requires workspace context where applicable.
- `ScoringService`, `RiskService`, `AssessmentService`, `ControlService`, `TreatmentService`, `ReviewService`, `HeatMapService`, `AnalyticsService`, `ReportService`, `NotificationService`, `AuditService`, and `AuthorizationService` in `backend/app/services/`. Constructors receive repositories/adapters through dependency injection; routes contain no business rules.
- `ObjectStorage` and `EmailSender` protocols in `backend/app/integrations/` with local/test and production adapters selected by configuration.
- Existing `HealthResponse` remains and will be complemented by `ReadinessResponse`; health must not expose sensitive dependency details publicly.

### Frontend components

React function components remain the project convention; no class components will be added. Principal components include `AppShell`, `WorkspaceSwitcher`, `RiskRegisterPage`, `RiskTable`, `RiskFilters`, `RiskForm`, `RiskDetailPage`, `AssessmentPanel`, `AssessmentHistory`, `ScoreMatrix`, `RiskHeatMap`, `HeatMapTable`, `ControlRegister`, `TreatmentPlanPanel`, `ActionTracker`, `DashboardPage`, `ReportCenter`, `ReportFilters`, `AuditLogTable`, `PermissionGate`, `EmptyState`, `ErrorState`, `LoadingState`, and accessible dialog/form primitives.

The monolithic `RiskAssessment` component will be removed only after feature components fully replace it. The inactive `LegacyApp`, `AuthPanel`, `Metric`, and `Legend` components in `frontend/src/App.jsx` will be deleted during the typed application-shell migration rather than retained as dead reference code.

## Dependencies

No package changes are part of the documentation pass. Versions must be selected and locked during each implementation phase after compatibility and maintenance review.

### Phase 1 proposed backend dependencies

- SQLAlchemy 2.x and Alembic for PostgreSQL persistence and migrations.
- PostgreSQL driver (`psycopg` 3 or `asyncpg`) selected together with a synchronous or asynchronous FastAPI database policy; do not mix styles casually.
- OIDC/JWT verification library compatible with the selected identity provider; prefer standards-based OIDC over custom password storage.
- `python-multipart` only when evidence uploads are introduced.
- Ruff and mypy (or Pyright) for linting/type checks; retain Pytest and HTTPX.

### Phase 1 proposed frontend dependencies

- TypeScript and React type packages.
- React Router for application routes.
- TanStack Query for server state and request lifecycle.
- React Hook Form plus a schema validator such as Zod for client UX validation, while retaining backend Pydantic authority.
- Vitest, React Testing Library, user-event, and axe integration for unit/component/accessibility tests.

### Phase 2 proposed dependencies

- Prefer CSS Grid/HTML for the 4x4 heat map; add no chart dependency solely for the matrix.
- Object-storage SDK only after the deployment provider is selected; use an adapter to retain S3-compatible portability.
- Malware scanning integration for evidence uploads in production; local development may use a documented stub.

### Phase 3 proposed dependencies

- A maintained PDF generation library suitable for server-side tabular reports; evaluate WeasyPrint versus ReportLab based on deployment constraints.
- A background job mechanism selected from the actual hosting topology; avoid introducing Redis/Celery until asynchronous report and notification load justifies it.
- Email provider SDK behind `EmailSender`; no provider-specific logic in domain services.
- OpenTelemetry and an error-monitoring integration chosen with deployment requirements.
- Playwright for end-to-end and visual/accessibility regression tests.

## Testing

### Documentation validation

- Confirm every root Markdown file contains only Northstar GRC or technology-neutral content.
- Search for and eliminate `Pluralbeam`, `PluralShield`, `PluralPlus`, `PluralExo`, commerce checkout/payment/invoice claims, Next.js, MongoDB, Clerk-as-decided-provider, and fictional release claims except where explicitly documenting removed history is necessary.
- Validate all internal Markdown links and referenced file paths.
- Confirm current-state statements match source code and executed tests/builds.
- Confirm `README.md`, `MEMORY.md`, `CONTEXT.md`, `TASKS.md`, `ARCHITECTURE.md`, and `docs/*` do not conflict.
- Run a Markdown linter if adopted; otherwise check heading structure, duplicate headings, trailing whitespace, and broken local links with scripts that do not alter source.

### Phase 1 tests

- Unit tests for score validation, every band boundary, policy versioning, status transitions, permission mapping, and error normalization.
- Migration tests from empty database through head and downgrade rehearsal where supported.
- Repository integration tests against PostgreSQL for CRUD, pagination, filtering, optimistic locking, uniqueness, and workspace isolation.
- API tests for success, validation, authentication, authorization, not-found concealment across tenants, conflicts, and audit emission.
- Frontend component tests for register, forms, loading/error/empty states, keyboard operation, and server validation display.
- E2E tests for login/session, workspace access, risk creation, inherent assessment, edit, search/filter, and unauthorized access.

### Phase 2 tests

- Control and treatment lifecycle tests, owner permissions, due/overdue calculation, evidence metadata validation, and completion rules.
- Residual assessment tests proving it is distinct from inherent assessment and requires rationale/context; no automatic subtraction formula.
- Approval/separation-of-duties tests and immutable approved-assessment tests.
- Heat-map aggregation tests by assessment type, level, category, owner, status, and date; counts must reconcile with drill-down records.
- Risk appetite and escalation boundary tests.
- Accessibility tests for heat-map keyboard use, non-color labels, table alternative, forms, dialogs, and responsive layouts.

### Phase 3 tests

- Dashboard/report reconciliation tests against register queries and fixed point-in-time fixtures.
- CSV escaping/formula-injection protection, encoding, stable columns, locale/timezone, and large export tests.
- PDF content, page-break, branding, accessibility, authorization, expiry, and checksum tests.
- Notification deduplication, retries, preferences, recipient resolution, escalation, and sensitive-content tests.
- Audit append-only, privileged access, export, redaction, and tamper-detection tests.
- Performance tests for large workspaces, heat-map/dashboard aggregation, concurrent reads, and report jobs.
- Backup/restore rehearsal, migration rollback, tenant-isolation penetration tests, dependency scanning, and full Playwright release suite.

### Validation commands

- Existing baseline: `npm run build` from `frontend`; `pytest` from `backend`.
- After tooling is added: frontend lint, typecheck, unit tests, build, and Playwright; backend Ruff, typecheck, Pytest with coverage, Alembic head/current checks, and migration rehearsal.
- CI must execute all deterministic checks and block release on failed tenant isolation, permission, scoring, migration, or report reconciliation tests.

## Implementation Order

1. Rewrite the canonical status and governance documents: `README.md`, `MEMORY.md`, `CONTEXT.md`, `agent.md`, `agent-log.md`, `TASKS.md`, `LOG.md`, and `CHANGELOG.md`.
2. Rewrite architecture, methodology, data, lifecycle, security, authorization, API, service, and testing specifications; add the new GRC domain documents.
3. Rewrite the remaining engineering and operational standards, move `BACKUP_RECOVERING.md` to `BACKUP_RECOVERY.md`, and delete the ten commerce-only documents.
4. Cross-check all Markdown files for stale Pluralbeam/commerce/Next.js/MongoDB content, broken links, contradictory status claims, and unsupported production-readiness statements.
5. Update `MEMORY.md` with the durable documentation authority order, exact current baseline, accepted three-phase sequence, and rules preventing inherent/residual conflation or false completeness claims.
6. Run the existing frontend build and backend tests to preserve a verified pre-development baseline; record results in `CONTEXT.md` and `LOG.md` without claiming new functionality.
7. **Phase 1 - Trusted Foundation:** record final ADRs for synchronous versus asynchronous database access, OIDC provider/flow, pagination, object identifiers, and report job architecture.
8. Add backend quality tooling, SQLAlchemy/Alembic/PostgreSQL integration, initial workspace/identity/risk/scoring/assessment/audit schema, and seeded development policy.
9. Implement trusted identity resolution, workspace memberships, RBAC permission guards, tenant-safe repositories, standardized errors, request IDs, and append-only audit creation.
10. Implement versioned risk/assessment APIs and authoritative inherent scoring, including approval and optimistic concurrency.
11. Convert the frontend to TypeScript, add routing/query/form foundations, replace in-memory risk state with APIs, and deliver the register, risk detail, and inherent assessment workflows with complete states.
12. Complete Phase 1 unit, integration, E2E, migration, security, accessibility, and CI gates; update status documentation only after passing evidence exists.
13. **Phase 2 - Governed Risk Lifecycle:** implement risk categories, appetite, controls, risk-control links, treatment plans/actions, reviews, evidence metadata/storage, and corresponding authorization/audit events.
14. Implement residual assessments as separate, contextual, approvable records; enforce prerequisites and preserve complete assessment history.
15. Implement risk workflow transitions, reminders data, overdue/escalation evaluation, control effectiveness, and appetite breach logic.
16. Build accessible inherent/residual heat maps, filter/drill-down experiences, risk and control/treatment workspaces, and executive-ready dashboard foundations.
17. Complete Phase 2 reconciliation, tenant, permission, workflow, heat-map, evidence, accessibility, and performance tests; rehearse backup/restore.
18. **Phase 3 - Management Insight and Production Readiness:** implement dashboard metrics/trends, report definitions/runs, CSV/PDF generation, secure artifact storage/download, and report audit events.
19. Implement in-app/email notifications, reminders, digests, escalation, user preferences, delivery retries, and operational monitoring.
20. Add audit administration, configurable taxonomy/framework mappings, retention/legal-hold jobs, observability, security headers/rate limiting, readiness probes, and deployment automation.
21. Execute full release gates: report/register reconciliation, tenant isolation, security review, dependency scanning, load tests, WCAG review, migration/rollback rehearsal, backup/restore, incident tabletop, and staging acceptance.
22. Publish truthful release notes and mark a capability complete only when code, tests, operations, and documentation all agree.