# Development & Operations Guide
## Current application
The canonical application is the root Next.js 15 App Router project. The former `frontend/` and `backend/` directories are migration history and are not the deployable service.

## Local workflow
From the repository root, install dependencies, copy `.env.example` to `.env`, run `npm run setup`, and start `npm run dev`. Use `npm run typecheck`, `npm run lint`, `npm test`, `npm run db:validate`, and `npm run build` for the release-foundation gate.

## Validation
- TypeScript: `npm run typecheck`.
- Tests: `npm test`.
- Prisma schemas: `npm run db:validate`.
- Production build: `npm run build`.
- Before release, test permissions, data isolation, score boundaries, audit events, and PostgreSQL migration rollback.
- Phase 2 local security checks: `npm test`, `npm run typecheck`, `npm run db:validate`, `npm run build`, and `git diff --check`.
- Report download URLs are single-use bearer credentials. Treat them as confidential and verify replay returns HTTP 410.
- Owners and Risk Managers must enroll in TOTP MFA before production access. Store `AUTH_SECRET` only in the managed secret store; it encrypts MFA secrets and signs sessions.
- Deployment probes: `GET /api/health` is a dependency-free liveness check; `GET /api/ready` verifies database connectivity and returns HTTP 503 without exposing database details when unavailable.
- Phase 2 policy tests verify that residual assessments require approved inherent context, control owners belong to the tenant, evidence links resolve only inside the tenant, treatment actions can be audited through state changes, and appetite breaches require a reasoned resolution.

## Data and security
- Local `.env` files are never committed.
- `VITE_*` values are public and must contain no credentials.
- Production secrets belong in a managed secret store.
- The application enforces tenant scope and role checks server-side; UI controls are not security boundaries. Tenant isolation still needs a dedicated automated integration test matrix before public exposure.
- Logs must avoid passwords, tokens, sensitive personal data, and full evidence contents.
- PostgreSQL audit protection: the security migration installs an append-only trigger and revokes `UPDATE`, `DELETE`, and `TRUNCATE` from `PUBLIC`. Production database ownership must remain with a migration/administration role separate from the runtime role; verify those grants during migration rehearsal.

## Change discipline
Update `MEMORY.md` with completed work and known gaps. Add material design changes to `DECISIONS.md`. Keep `ROADMAP.md` and `docs/RELEASE_STATUS.md` aligned with actual implementation. Do not mark PostgreSQL durability, auth, compliance, or production audit persistence complete until it exists and is tested.

## Incident basics
Preserve request IDs and relevant audit events, restrict access to incident data, document timeline and impact, rotate exposed credentials, and record corrective actions. Never edit historical audit records in place.
