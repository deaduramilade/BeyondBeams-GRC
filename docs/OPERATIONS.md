# BeyondBeams GRC – Operations & Runbook

## 1. Architectural Overview
BeyondBeams GRC is a Next.js 15 App Router application with strict TypeScript, Auth.js v5 authentication, Prisma ORM, Tailwind CSS, and shadcn/ui. Local development uses SQLite (`dev.db`). Canonical production environments target managed PostgreSQL 16+.

---

## 2. Health & Readiness Probes

The application provides standardized probes for Kubernetes, Docker, and load balancers:

- **Liveness Probes**:
  - `GET /api/health`
  - `GET /api/health/live`
  - Returns `HTTP 200` with `Cache-Control: no-store, no-cache, must-revalidate`.
- **Readiness Probe**:
  - `GET /api/ready`
  - Executes `SELECT 1` against the database.
  - Returns `HTTP 200` with uptime when reachable, or `HTTP 503` when the database is unavailable.

---

## 3. Observability, Logging, and Request Correlation

### Request Correlation IDs
Every incoming request to `/app/*` and `/api/*` is assigned a unique `x-request-id` header in `middleware.ts`. This correlation ID is:
1. Propagated through downstream server actions and API handlers.
2. Injected into response headers (`x-request-id`).
3. Logged in audit events (`AuditEvent`) and structured logs.

### Structured JSON Logging (`lib/logger.ts`)
The application outputs structured JSON logs to standard output:
```json
{
  "timestamp": "2026-08-30T10:00:00.000Z",
  "level": "info",
  "message": "Generated report risk-register.csv",
  "correlationId": "f81d4fae-7dec-11d0-a765-00a0c91e6bf6",
  "tenantId": "cly123456",
  "userId": "usr_789"
}
```
**Strict Redaction Rule**: Secrets, passwords, session cookies, raw tokens, magic-link URLs, invitation URLs, and report download tokens are automatically sanitized via recursive regex filtering before serialization.

### Operational Metrics (`lib/metrics.ts` & `/api/metrics`)
In-memory counters aggregate key operations:
- `auth_login_attempts_total{method, status}`
- `report_generations_total{type, format, status}`
- `job_executions_total{type, status}`
- `notification_deliveries_total{type, status}`
- `retention_purged_records_total{entityType}`

Metrics are viewable via `GET /api/metrics`.

---

## 4. Background Job Processing & Retries

Background work (report generation, notification delivery, review reminders, analytics snapshots) is managed through the durable `Job` table:
- **States**: `QUEUED` → `PROCESSING` → `COMPLETED` / `FAILED` / `CANCELLED`.
- **Backoff Delay**: Exponential backoff doubling on each attempt (`1s, 2s, 4s, 8s...` up to `1h`).
- **Terminal Failure**: Marked `FAILED` after 3 failed attempts.
- **Admin Retries**: Owners and Risk Managers can retry failed jobs from `/app/operations/jobs` or via `retryJobAction`.

---

## 5. Retention Engine & Legal-Hold Governance

### Retention Lifecycle
- **Expired Report Artifacts**: Purged 30 days after generation or when `downloadExpires` has elapsed.
- **Expired Tokens**: Verification and password reset tokens purged upon expiration.
- **Soft-Deleted Risks**: Records with `deletedAt` older than the tenant's `retentionDays` (default: 365) are permanently purged unless Legal Hold is active.

### Legal-Hold Rule
When a tenant has `legalHold: true`, soft-deleted records and evidence are **never deleted**. Retention cleanup logs an audit record noting that legal hold is active and skips deletion.

### Running Retention Cleanup
1. **Dry-Run Mode (Safe simulation)**:
   ```powershell
   node scripts/retention-cleanup.cjs --dry-run
   ```
2. **Live Purge Mode**:
   ```powershell
   node scripts/retention-cleanup.cjs --live
   ```
3. **UI Action**:
   Triggered via `triggerRetentionCleanupAction` in Organisation Settings.

---

## 6. Local Rehearsal Commands

- **Fresh PostgreSQL Deploy Rehearsal**: `npm run db:postgres:fresh`
- **Upgrade Migration Rehearsal**: `npm run db:postgres:upgrade`
- **Backup & Restore Rehearsal**: `npm run db:postgres:backup-rehearsal`
- **Multi-Tenant Boundary Test**: `npm run test:tenant-isolation`
- **Secret Scanner**: `npm run security:scan`
