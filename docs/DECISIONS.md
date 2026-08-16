# Architecture & Product Decisions
## ADR-001 — Keep scoring explainable
**Status:** Accepted
The product uses `likelihood × impact` with a 1–5 scale and explicit Low, Moderate, High, and Critical bands. The backend is authoritative for API-created and API-updated assessments. Policy changes must be versioned so historical assessments remain interpretable.

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
