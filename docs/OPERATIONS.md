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

## Data and security
- Local `.env` files are never committed.
- `VITE_*` values are public and must contain no credentials.
- Production secrets belong in a managed secret store.
- The application enforces tenant scope and role checks server-side; UI controls are not security boundaries. Tenant isolation still needs a dedicated automated integration test matrix before public exposure.
- Logs must avoid passwords, tokens, sensitive personal data, and full evidence contents.

## Change discipline
Update `MEMORY.md` with completed work and known gaps. Add material design changes to `DECISIONS.md`. Keep `ROADMAP.md` and `docs/RELEASE_STATUS.md` aligned with actual implementation. Do not mark PostgreSQL durability, auth, compliance, or production audit persistence complete until it exists and is tested.

## Incident basics
Preserve request IDs and relevant audit events, restrict access to incident data, document timeline and impact, rotate exposed credentials, and record corrective actions. Never edit historical audit records in place.
