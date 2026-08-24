# Delivery Roadmap
## Completed — Next.js release foundation
- Multi-tenant Next.js application with Auth.js, Prisma, tenant-scoped risk workflows, framework mappings, reports, notifications, and audit events.
- Responsive application shell and accessible login/mobile interaction improvements.
- Production fail-closed environment checks, security headers/CSP, timing-safe secrets, HMAC-keyed database-backed rate limiting, and authenticated cron protection.
- PostgreSQL schema and initial migration scaffolding, SQLite local setup, CI workflow, focused release-foundation tests, and release documentation.

## Current gate — staging preparation
- Verify typecheck, lint, tests, Prisma validation, production build, and whitespace checks on the current branch.
- Deploy the PostgreSQL migration to a disposable database and seed only non-production assessment data.
- Add tenant-isolation/permission integration tests and authenticated browser checks.

## Deployment gate — Trusted data foundation
- Add transaction boundaries, tenant filters, cursor pagination, idempotency, and migration/rollback rehearsal.
- Add repository integration tests against PostgreSQL and concurrency tests for risk references.

## Deployment gate — Governance and assurance
- Configure OIDC login, secure session management, workspace isolation, RBAC, approval separation of duties, and review notifications.
- Add durable control catalogue, evidence object storage, status transition policy, and immutable audit persistence.

## Deployment gate — Insight and operations
- Move report generation to background jobs/object storage, add PDF rendering, trend snapshots, configurable appetite, taxonomies, and framework mappings.
- Add monitoring, rate limits, backup/restore rehearsal, accessibility/E2E checks, load tests, and rollback verification.

## Release gates
Security review, migration rehearsal, accessibility check, automated tests, backup/restore test, audit-event verification, and documented rollback plan.
