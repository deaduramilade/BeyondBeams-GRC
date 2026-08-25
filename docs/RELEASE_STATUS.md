# Release Foundation Status

**Updated:** 2026-08-24  
**Branch:** `feature/release-foundation`  
**Scope:** Phase 1 release foundation for the Next.js GRC application

## Implemented in this phase

- Strict TypeScript validation and a focused Node test suite.
- Environment validation with production fail-closed requirements for PostgreSQL, HTTPS, email, cron authentication, and rate-limit signing.
- Database-backed, HMAC-keyed rate limiting for authentication, registration, invitations, reminders, reports, and other expensive endpoints.
- Timing-safe comparison for shared secrets and no raw authentication or invitation URLs in production logs.
- Security headers and a restrictive baseline Content Security Policy in `next.config.ts`.
- PostgreSQL schema validation, initial migration scaffolding, and a separate SQLite local-development path.
- GitHub Actions checks for typecheck, lint, tests, Prisma validation, and production build.
- Responsive shell improvements, mobile navigation behavior, touch target sizing, and login form accessibility/autocomplete.

## Verification evidence

The release gate is complete only after these commands pass on the current commit:

```powershell
npm run typecheck
npm run lint
npm test
npm run db:validate
npm run build
git diff --check
```

Verified on 2026-08-24: `typecheck` passed, lint passed with no warnings/errors, all 4 focused tests passed, both Prisma schemas validated, the production build passed, and `git diff --check` passed. Prisma emitted only the existing Prisma 7 configuration deprecation warning. A local SQLite seed is suitable for product assessment; PostgreSQL migration deployment still requires a disposable or managed PostgreSQL instance.

## Deployment status

No hosting provider, managed PostgreSQL database, email provider, object storage, production domain, or production secrets are configured in this repository. A hosted assessment environment must use non-production demo data and a dedicated test account. It must not use the local SQLite database or development email preview provider as a production substitute.

Railway deployment was not completed because the Railway CLI is not installed in this workspace and no Railway account/session or deployment credentials are available. The application is therefore hosted locally for assessment at the URL supplied with the release handoff.

## Remaining release blockers

- Deploy and rehearse the PostgreSQL migration against a real disposable PostgreSQL database.
- Add integration and end-to-end coverage for tenant isolation, permissions, invitations, reports, and authenticated workflows.
- Move report artifacts to private tenant-scoped object storage or enforce a documented size and retention limit.
- Add durable report/notification jobs, provider retries, bounce handling, observability, backups, restore testing, and health/readiness endpoints.
- Complete the governed GRC domain: versioned assessments, approval gates, lifecycle transitions, treatment actions, evidence, appetite, configurable taxonomy, retention, and legal hold.

## Assessment account policy

Credentials must be generated per environment and supplied out of band. Never commit a password, seed secret, hosted database URL, or provider API key. The local seed accepts `SEED_DEMO_PASSWORD` from an untracked `.env` file for a controlled review account.