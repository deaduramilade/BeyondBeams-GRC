# Delivery Roadmap

The current five-phase inventory is maintained in [DEVELOPMENT_STATUS.md](DEVELOPMENT_STATUS.md). This roadmap sequences the remaining work without treating schema-only models or navigation placeholders as delivered features.

The detailed Phase 4 delivery report is maintained in [PHASE_4_DELIVERY.md](PHASE_4_DELIVERY.md).

## Phase 1 - Trusted foundation and access

Core authentication, tenant scope, permissions, risk references, optimistic updates, security headers, rate limiting, CI, focused tests, liveness/readiness probes, and the PostgreSQL append-only privilege policy are developed locally. Complete PostgreSQL rehearsal, integration coverage, production role separation, and hosted deployment preparation.

## Phase 2 - Governed risk lifecycle

Risk CRUD and local governance workflows are developed. Server-side lifecycle invariants, tenant-safe evidence/control validation, treatment-action updates, appetite-breach resolution, and functional assessment/treatment/control entry routes are now developed locally. Finish dedicated lifecycle views, structured evidence storage, configurable scoring policies, review scheduling, and end-to-end transition and approval validation.

## Phase 3 - Frameworks and organisational context

Framework catalogues, mappings, compliance references, emerging risks, and supporting libraries are developed locally. Framework records now carry source, owner, review, publication, and applicability metadata; risks can reference tenant-owned business units, objectives, risk sources, and regulatory domains with server-side tenant validation. Next: human-readable taxonomy joins, mapping review UI, evidence-backed control testing, catalogue change history, and PostgreSQL rehearsal. Vendor risk, incidents, and certification claims remain out of scope until separately designed.

## Phase 4 - Insights, reporting, and notifications

Local analytics, reconciled KPIs, accessible heat maps, CSV/XLSX/PDF exports, report-format validation, report links, email previews, reminders, and permission-checked notification retries are developed. Move artifacts and dispatch to durable production services, then complete trend snapshots, point-in-time report reconciliation, provider webhooks, bounce handling, and escalation.

## Phase 5 - Production assurance and operations

Local release checks and documentation are developed. Complete authenticated browser/E2E and PostgreSQL integration testing, accessibility and load testing, observability, backups and restore rehearsals, security review, rollback verification, deployment, and operational ownership.

## Release gates

Security review, migration rehearsal, tenant-isolation tests, accessibility checks, automated tests, backup/restore evidence, audit-event verification, observability, and a documented rollback plan are required before live customer data.
