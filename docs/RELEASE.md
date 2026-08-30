# Release Procedures and Verification Gates

This document defines the exact release gates, automated validation commands, database migration rehearsals, and rollback procedures for BeyondBeams GRC.

---

## 1. Automated Release Gates (CI & Pre-Commit)

Before any release, pull request merge, or staging deployment, all seven release gates must execute cleanly and exit with code 0:

| Gate # | Release Gate Command | Scope |
| :--- | :--- | :--- |
| **Gate 1** | `npm run typecheck` | Strict TypeScript validation (`tsc --noEmit`) |
| **Gate 2** | `npm run lint` | ESLint static code analysis |
| **Gate 3** | `npm test` | Complete automated unit/integration test suite (Phases 1–5) |
| **Gate 4** | `npm run test:tenant-isolation` | Dedicated multi-tenant isolation boundary contract tests |
| **Gate 5** | `npm run db:validate` | Dual Prisma schema validation (`schema.prisma` & `schema.postgresql.prisma`) |
| **Gate 6** | `npm run security:scan` | Credential and secret scanner for all tracked source files |
| **Gate 7** | `npm run build` | Next.js 15 production build with static/dynamic route optimization |

---

## 2. Database Migration Rehearsals

PostgreSQL is the canonical production database. Local rehearsals validate migration fidelity against disposable PostgreSQL 16 containers before deployment.

### A. Fresh Database Migration Rehearsal
Deploys migrations against a fresh database, seeds tenant data, verifies runtime audit privileges (`t|f|f|f`), and checks schema creation lockdowns:
```powershell
npm run db:postgres:fresh
```

### B. Upgrade Migration Rehearsal
Rehearses an incremental migration on an existing populated database without data loss:
```powershell
npm run db:postgres:upgrade
```

### C. Backup and Restore Rehearsal
Exercises full `pg_dump` and `pg_restore` cycles, verifying 100% record parity across tenants, risks, audit events, and controls:
```powershell
npm run db:postgres:backup-rehearsal
```

---

## 3. Rollback & Disaster Recovery Notes

1. **Database Schema Rollbacks**: Prisma migrations are forward-only in production. Schema rollbacks must be deployed as an explicit compensating migration (`prisma migrate deploy`).
2. **Application Rollbacks**: In the event of a critical regression, revert the application container/deployment to the previous image tag. All database schema additions are designed to be non-breaking and backward-compatible.
3. **Point-in-Time Recovery**: Production deployment requires managed PostgreSQL with continuous WAL archiving and automated snapshots (e.g. AWS RDS or GCP Cloud SQL).
