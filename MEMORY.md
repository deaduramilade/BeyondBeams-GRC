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

## Verification status (2026-08-17)

Implementation is complete and verified. Prisma schema validation, client generation, SQLite creation, demo seeding, strict TypeScript checking, and the Next.js production build pass. The seeded database contains one tenant, one user, eight risks, and eight audit events. Live HTTP smoke tests passed for the branded login, anonymous redirect, credentials authentication, dashboard, and seeded risk register. The server is running on port 3001 because port 3000 was already occupied.