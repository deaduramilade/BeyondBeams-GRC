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

## Verification status (2026-08-26)

The release-foundation work includes environment validation, fail-closed production checks, security headers/CSP, timing-safe secret comparison, HMAC-keyed database-backed rate limiting, PostgreSQL validation/migration scaffolding, CI, focused tests, responsive/authentication accessibility improvements, guarded migration rehearsal, credential-free secret scanning, separated database-role policy, and request correlation IDs. Local governance workflows now also cover versioned assessments, approval decisions, treatment plans/actions, control profiles, evidence metadata, appetite evaluation/resolution, taxonomy, framework mappings, reports, notifications, and emerging-risk workflows. Phase 2 server invariants validate residual prerequisites and tenant-safe evidence/control links. Phase 3 now records framework source/applicability governance metadata and tenant-scoped organisational context on risks, with a PostgreSQL migration and export support. Phase 4 now provides reconciled tenant-scoped analytics, accessible heat maps, correctly formatted risk/audit PDFs, and administrator notification retries. Hosted deployment, PostgreSQL migration execution, authenticated browser checks, production object storage/jobs, immutable trend history, full lifecycle integration coverage, human-readable taxonomy reporting, and production operations remain outstanding. See `docs/DEVELOPMENT_STATUS.md`, `docs/PHASE_4_DELIVERY.md`, and `docs/RELEASE_STATUS.md`.