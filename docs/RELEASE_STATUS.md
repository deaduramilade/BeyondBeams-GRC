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

## Phase 2 — Security and correctness implementation

Implemented locally, pending PostgreSQL rehearsal and authenticated browser acceptance:

- Tenant-scoped, atomic risk references through `TenantSequence`; count-based allocation is no longer used by the server action.
- Optimistic risk updates using a version column and HTTP 409/server-action conflict responses.
- Risk creation and its audit event are atomic. Notifications and compliance linking remain post-commit side effects and must be retried asynchronously before production.
- Report download tokens are hashed, single-use, expiry-checked, cleared on consumption, and sent with `private, no-store` headers.
- Permission matrix and server-side `requirePermission` helper; UI visibility is not treated as authorization.
- Password reset links are hashed, expire after 30 minutes, are single-use, and increment `sessionVersion` to invalidate existing JWT sessions.
- Owner/Risk Manager TOTP MFA uses encrypted secrets, a standard `otpauth://` setup URI, confirmation, and login-time verification.
- Audit writes are centralized through an append helper; no application edit/delete path is provided. Database-level append-only permissions still require PostgreSQL role policy and operational migration review.
- Phase 2 security tests cover permission denial, TOTP, one-way tokens, tenant predicate contract, and optimistic revisions. Full PostgreSQL integration/concurrency tests require a disposable PostgreSQL service.

### Local assessment test path

1. Copy `.env.example` to `.env`, use a random local `AUTH_SECRET` of at least 32 characters, and run `npm run setup`.
2. Start with `npm run dev -- --port 3001` and open `http://localhost:3001/login`.
3. Sign in with the locally configured seed account. Use **Reset password** to generate a preview reset link; verify it succeeds once and rejects a second use.
4. As an Owner, configure MFA using the server action/API harness or the settings UI when exposed; scan the returned `otpauth://` URI in an authenticator, confirm a code, sign out, and verify password-only login is rejected.
5. Create two risks quickly in separate browser tabs and confirm unique, sequential references. Open the same risk in two tabs; save one, then confirm the stale tab receives a conflict rather than overwriting it.
6. Generate an emailed report in local preview, download it once, and verify the same link returns HTTP 410 on replay or after expiry.

Local SQLite is for assessment only. Before hosted testing, apply the PostgreSQL migration, provision managed secrets, HTTPS, production email, and backups. No hosting credentials are available in this workspace, so the test URL remains local rather than being falsely presented as a production deployment.

## Assessment account policy

Credentials must be generated per environment and supplied out of band. Never commit a password, seed secret, hosted database URL, or provider API key. The local seed accepts `SEED_DEMO_PASSWORD` from an untracked `.env` file for a controlled review account.