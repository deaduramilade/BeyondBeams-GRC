# Architecture & Product Decisions
## ADR-001 — Keep scoring explainable
**Status:** Accepted
The product uses `likelihood × impact` with a 1–5 scale and explicit Low, Moderate, High, and Critical bands. The backend is authoritative for API-created and API-updated assessments. Policy changes must be versioned so historical assessments remain interpretable.

## ADR-007 — Framework content is reference material
**Status:** Accepted
Framework and compliance catalogue entries must retain source, publication/review, content-owner, and applicability metadata where available. The product may support mapping and evidence governance, but must not represent mappings as certification, legal advice, or authoritative conformance. Applicability remains an accountable human decision and must be recorded against organisation-specific mappings.

## ADR-008 — Organisational context is tenant-owned
**Status:** Accepted
Risk records may reference tenant-owned taxonomy items for business unit, objective, risk source, and regulatory domain. The server validates every supplied context ID against the authenticated tenant and active state. The legacy `RiskCategory` enum remains the stable scoring/reporting classification until a future migration replaces it with a fully configurable taxonomy.

## ADR-002 — Separate inherent and residual risk
**Status:** Accepted
Inherent risk describes exposure before controls. Residual risk describes exposure after controls and treatment. They must be stored as separate assessments, never overwritten.

## ADR-003 — Keep a replaceable local repository
**Status:** Accepted
The API uses a thread-safe in-process repository with deterministic seed data for local product review. Its service boundary is intentionally replaceable by PostgreSQL. The in-process repository is not suitable for multi-instance or production system-of-record use.

## ADR-004 — Human accountability is mandatory
**Status:** Accepted
Risk owners, approvers, treatment decisions, and review dates are explicit fields. The product must not silently accept or close risk on behalf of a user.

## ADR-005 — Framework mapping is configurable
**Status:** Proposed
Support ISO 31000, NIST CSF, CIS, SOC 2, and organisation-specific taxonomies through configurable mappings rather than hard-coding a compliance claim into the product.

## ADR-006 — Enforce Phase 2 invariants at the server boundary
**Status:** Accepted
Residual assessments require an approved inherent assessment. Evidence, treatment actions, and control owners must resolve within the authenticated tenant. Treatment-action and appetite-breach state changes are audited. Client forms and route visibility are never the authority for these rules.

## ADR-009 — Reconcile analytics from the transactional register
**Status:** Accepted
Phase 4 live analytics are calculated from tenant-scoped transactional records and expose reconciliation facts alongside KPI values. Heat-map cells use residual assessments where available and inherent assessments only when residual values are absent. Historical trends require immutable snapshots and are not inferred from current data.

## ADR-010 — Match report formats to artifacts
**Status:** Accepted
Every report response must generate the requested format, return a matching content type and filename, and reject unsupported combinations. Board and framework gap reports are PDF-only. Report delivery remains private, single-use, expiring, and tenant-scoped.

## ADR-011 — Keep migration and runtime database privileges separate
**Status:** Accepted
Production schema changes require a migration/administration role separate from the application runtime role. The repository provides a credential-free PostgreSQL policy template and a guarded disposable-database rehearsal command. No password, provider URL, or production grant is stored in source control.

## ADR-012 — Correlate requests without trusting client identifiers
**Status:** Accepted
The middleware creates a fresh UUID request identifier for `/app/*` and `/api/*` responses. It is intended for support and log correlation only; authorization continues to derive from the authenticated session and tenant scope.
