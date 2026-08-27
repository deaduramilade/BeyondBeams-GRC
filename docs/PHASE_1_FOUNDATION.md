# Phase 1 Trusted Foundation

## Migration and role guarantees

- PostgreSQL migration history is forward-only. Audit request-context columns and their tenant/request index are introduced by `20260827090000_phase1_audit_context`; no earlier applied migration is rewritten.
- `npm run db:postgres:fresh` creates and destroys its own PostgreSQL 16 container. It migrates, generates the PostgreSQL client, seeds one tenant/eight risks, verifies those records, applies the role policy, checks append-only runtime grants, and checks migration status.
- `npm run db:postgres:upgrade` additionally reapplies idempotent deployment migration logic to seeded data and asserts tenant/risk counts are unchanged. A historical-version-to-current upgrade and rollback/recovery exercise remains a separate release gate.
- The scripts fail closed when Docker or PostgreSQL is unavailable and restore the default SQLite client in `finally`.

## Permission and tenant matrix

| Role | Read risk | Create/update risk | Delete risk | Audit read | Export | Members/settings |
| --- | --- | --- | --- | --- | --- | --- |
| Owner | Yes | Yes | Yes | Yes | Yes | Yes |
| Risk Manager | Yes | Yes | Yes | Yes | Yes | No |
| Assessor | Yes | Yes | No | No | No | No |
| Viewer | Yes | No | No | No | No | No |
| Auditor | Yes | No | No | Yes | Yes | No |

Server authorization refreshes the membership from the database and accepts only memberships with `acceptedAt` set and no invitation token. Tenant-scoped risk mutation predicates include `tenantId` and `deletedAt: null`; cross-tenant or deleted identifiers update zero rows. Invalid identifiers are treated as not found rather than exposing another tenant.

Invitation, magic-link, password-reset, report-download, and preview credentials are random bearer values stored only as hashes. Consumption uses expiry and replay checks. Report consumption uses an atomic conditional update so concurrent replay has one winner.

## Audit guarantee

Material transaction paths should call `appendAuditEvent`. The helper records the actor and tenant supplied by the authenticated boundary, correlation ID, source, forwarded client address, user agent, serialized changes, optional before/after payloads, and optional reason. PostgreSQL protects history with a mutation trigger plus explicit runtime-role revokes. Seed reset deletion is local-only and blocked in production.

## Verification and remaining boundary

Run:

```text
npm run typecheck
npm run lint
npm test
npm run test:tenant-isolation
npm run db:validate
npm run security:scan
npm run build
git diff --check
npm run db:postgres:fresh
npm run db:postgres:upgrade
```

The focused tenant suite is a shared-predicate contract, not the final database-backed permission matrix. Production remains blocked until PostgreSQL rehearsals, authenticated server/API integration cases for every role and tenant state, concurrency, backup/restore, and hosted operational checks pass in an appropriate environment.