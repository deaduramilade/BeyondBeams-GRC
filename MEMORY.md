# Project Memory

## Mission

BeyondBeams GRC is a multi-tenant risk register and assessment workspace for accountable organisational risk decisions. It does not claim regulatory certification.

## Current architecture

- Root application: Next.js 15 App Router with strict TypeScript and Tailwind/shadcn UI.
- Authentication: Auth.js v5 credentials with JWT sessions; adapter schema is magic-link ready.
- Persistence: Prisma with SQLite locally and an equivalent PostgreSQL schema for production migration.
- Authorization: tenant and role are derived from the authenticated session; risk queries are tenant-scoped.
- Product views: dashboard, heat map, searchable register, risk detail/history, and create/edit forms.

The former `frontend/` Vite and `backend/` FastAPI directories remain as migration history but are not the canonical application.

## Working rules

- Every record query must be scoped by the authenticated `tenantId`.
- Never trust tenant IDs or roles supplied by browser input.
- Preserve inherent and residual assessments as distinct fields.
- Recalculate scores on the server for every create and update.
- Material risk changes require audit events; deletion remains soft.
- Never claim a build or test passed without command output.

## Verification status (2026-08-30)

The release-foundation work includes environment validation, fail-closed production checks, security headers/CSP, timing-safe secret comparison, HMAC-keyed database-backed rate limiting, PostgreSQL validation/migration scaffolding, CI, focused tests, responsive/authentication accessibility improvements, guarded migration rehearsal, credential-free secret scanning, separated database-role policy, and request correlation IDs. Phase 2 governance workflows cover versioned assessments, four-eyes approvals, treatment plans/actions, control profiles, evidence metadata, review scheduling/reassessment requests, versioned scoring policy administration, and durable tenant-scoped jobs. Phase 3 delivers complete framework catalogue governance with explicit sources, versions, publication dates, and changelogs; structured mapping applicability reviews (Applicable, Partially applicable, Not applicable) with audit tracking; tenant control administration; human-readable taxonomy joins (Business Unit, Objective, Risk Source, Regulatory Domain) across registers, filters, details, analytics, and CSV/XLSX/PDF exports; enriched interactive and exportable gap analysis (PDF and Excel .xlsx); and product quantity stacking (1–99x) with updated member limits on homepage pricing. Phase 4 delivers an expanded 8-report catalogue across CSV, XLSX, and PDF in a dedicated `/app/reports` Report Centre; a private report storage abstraction (`ReportStorageAdapter`) with SHA-256 checksums, size metadata, and tenant-prefixed keys; single-use, 24-hour expiring, SHA-256 hashed download tokens consumed upon download; immutable daily `AnalyticsSnapshot` point-in-time consistency; durable background job status lifecycle (`QUEUED` → `PROCESSING` → `COMPLETED`/`FAILED`) with exponential backoff and administrator retries; robust notification delivery with non-corrupting error isolation; and accessible insights dashboards. Phase 5 delivers structured JSON logging (`lib/logger.ts`) with recursive secret redaction; request correlation (`x-request-id`) propagation; operational metrics registry (`lib/metrics.ts` & `/api/metrics`); liveness (`/api/health`, `/api/health/live`) and readiness (`/api/ready`) probes; retention engine (`lib/retention.ts` & `scripts/retention-cleanup.cjs`) with Legal-Hold enforcement; containerized PostgreSQL backup/restore rehearsal scripts (`scripts/postgres-backup-restore.cjs`); hardened CI release gates; and operational documentation (`docs/RELEASE.md`, `docs/OPERATIONS.md`, `docs/SECURITY.md`, `docs/DEVELOPMENT_STATUS.md`). All Phase 1–5 automated test suites pass (56+ tests). Hosted deployment, managed PostgreSQL point-in-time recovery, production object storage, and production operations remain outstanding. See `docs/DEVELOPMENT_STATUS.md`, `docs/RELEASE.md`, and `docs/OPERATIONS.md`.