# Delivery Roadmap
## Completed — Product slice for local review
- Responsive Northstar workspace with overview, register, heat map, treatments, and report center.
- Backend Pydantic domain contracts for risks, separate inherent/residual assessments, controls, actions, audit events, metrics, heat-map cells, and report summaries.
- API-backed register workflow with local seeded repository fallback, server-authoritative scoring, validation, filtering, CSV export, and reconciliation tests.
- Documentation and feature branch prepared for deployment work.

## Deployment gate — Trusted data foundation
- Replace `RiskStore` with PostgreSQL repository and migrations for workspaces, risks, assessments, treatments, users, and audit events.
- Add transaction boundaries, tenant filters, cursor pagination, idempotency, and migration/rollback rehearsal.
- Keep the existing API contract and backend scoring policy; add repository integration tests against PostgreSQL.

## Deployment gate — Governance and assurance
- Configure OIDC login, secure session management, workspace isolation, RBAC, approval separation of duties, and review notifications.
- Add durable control catalogue, evidence object storage, status transition policy, and immutable audit persistence.

## Deployment gate — Insight and operations
- Move report generation to background jobs/object storage, add PDF rendering, trend snapshots, configurable appetite, taxonomies, and framework mappings.
- Add monitoring, rate limits, backup/restore rehearsal, accessibility/E2E checks, load tests, and rollback verification.

## Release gates
Security review, migration rehearsal, accessibility check, automated tests, backup/restore test, audit-event verification, and documented rollback plan.
