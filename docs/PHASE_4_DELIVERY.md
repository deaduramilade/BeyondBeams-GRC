# Phase 4 Delivery

**Updated:** 2026-08-26  
**Scope:** Insights, reporting, and notifications  
**Current maturity:** complete local delivery; production infrastructure remains an explicit deployment gate

## Delivered

### Insights and reconciliation

- Tenant-scoped portfolio analytics service in `lib/analytics.ts`.
- Active-risk count, total and average exposure, appetite pressure, overdue reviews/actions, treatment coverage, and effective-control coverage.
- Stable 1-5 score-band classification: Low, Moderate, High, Critical.
- Five-by-five heat-map cells with risk IDs, using residual values when available and inherent values only when residual values are absent.
- Reconciliation facts: register count, scored count, unscored count, residual-assessment count, and inherent-only count.
- Authenticated `/api/analytics` endpoint with `private, no-store` caching policy.
- Insights UI with accessible table alternative, non-color labels, coverage bars, category concentration, and empty-state-safe calculations.

### Reports

- Risk-register CSV, XLSX, and PDF exports now return the requested format.
- Audit-trail CSV, XLSX, and PDF exports now return the requested format.
- Board and framework gap reports remain PDF-only and reject invalid format combinations.
- Report filenames and `Content-Type` headers match the generated artifact.
- Existing tenant scoping, export quotas, single-use hashed download tokens, expiry, private caching, and audit records are preserved.
- Report generation failures continue to mark the export record failed rather than returning a false success.

### Notifications

- Existing local preview and Resend adapters remain fail-closed in production.
- Existing preference checks, reminder deduplication, lifecycle notifications, and audit records remain intact.
- Administrators can retry a failed notification through a tenant-scoped server action; retry attempts use the stored recipient/type/entity context and create a new audited delivery record.

## What was previously partial and is now developed locally

- Portfolio analytics are no longer a single aggregate score; the service provides reconciled metrics and heat-map data.
- Heat-map output has both visual cells and a semantic table representation.
- Report format mismatch has been removed for risk-register and audit exports.
- Notification retry behavior has a server-side, permission-checked entry point.

## Still partial

- Reports and notification delivery execute synchronously in the Next.js process. Production requires a durable queue/outbox, retry schedule, provider backoff, dead-letter handling, and operational replay controls.
- Report binaries are stored in the database for local assessment. Production requires private tenant-prefixed object storage, encryption, checksum verification, lifecycle expiry, size limits, and signed short-lived delivery.
- Analytics are calculated from live transactional tables. Production trend history requires immutable snapshots, point-in-time report consistency, retention policy, and reconciliation jobs.
- Notification status records do not yet contain a full attempt history, provider message IDs, bounce/complaint state, or exponential-backoff schedule.
- Current report catalogue is four report types. Treatment status, control effectiveness, overdue-items, risk-profile, and configurable report definitions need dedicated production contracts.

## Not developed

- Analytics warehouse or independently operated historical trend pipeline.
- Production queue workers, object storage adapter, provider webhook processing, bounce handling, and disaster-recovery evidence.

## Completion path

1. Introduce a durable report/notification outbox with idempotency keys and bounded retries.
2. Add a production object-storage adapter with tenant isolation, encryption, checksum, expiry, and signed URLs; retain the database adapter only for local development.
3. Persist daily analytics snapshots and define point-in-time report reads against a consistent snapshot.
4. Add provider webhook ingestion for delivery, bounce, complaint, and suppression states.
5. Expand the report catalogue and add reconciliation tests against register, treatment, control, appetite, and audit facts.
6. Run authenticated browser, PostgreSQL, load, accessibility, backup/restore, and failure-replay tests before changing the release status to production-ready.

## Security boundary

No secret, API key, token, database URL, email body credential, or report bearer URL is embedded in this delivery. Production provider credentials must be supplied through managed environment secrets. Tenant IDs are always derived from the authenticated session; request payloads cannot select another tenant's analytics, reports, or notifications.
