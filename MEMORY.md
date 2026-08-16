# Project Memory
## Mission
Northstar GRC is a React/Vite + FastAPI/PostgreSQL risk register and assessment tool. It helps organisations make consistent, accountable risk decisions; it is not a certification product.

## Repository map
- `frontend/src/RiskAssessment.jsx`: current functional risk-register experience and local state model.
- `frontend/src/App.jsx`: application entry wrapper; legacy visual shell is retained below the active component as migration reference.
- `frontend/src/index.css`: Tailwind entry and global focus/base rules.
- `backend/app/main.py`: FastAPI app and health router.
- `backend/app/core/config.py`: environment-driven backend settings.
- `docs/PROJECT_CHARTER.md`: scope, outcomes, principles, and governance.
- `docs/DECISIONS.md`: decisions and rationale.
- `docs/ROADMAP.md`: sequenced delivery plan.
- `docs/OPERATIONS.md`: development and release practices.

## Current baseline (2026-08-16)
- Phase 1-3 local product slice is implemented on branch `feature/phase-1-3-grc-platform`.
- Frontend provides overview, searchable/filterable register, risk creation, detail drawer, inherent/residual heat map, treatment action view, control details, report center, and CSV export.
- Backend provides Pydantic risk contracts, authoritative 1-5 scoring, separate assessments, controls/actions, dashboard, heat-map, executive summary, CSV, and in-process audit events.
- Local seeded data uses the in-process `RiskStore`; it is a development adapter, not durable PostgreSQL persistence.
- OIDC/RBAC, tenant isolation, PostgreSQL migrations/repository, background reports, object storage, notifications, and production observability remain deployment gates.

## Non-negotiable working rules
- Read this file and the charter before extending product behavior.
- Search before adding a new component, endpoint, or document.
- Never claim a feature is complete without running the relevant build/test and recording the result.
- Never put secrets in `VITE_*` variables, source code, or committed `.env` files.
- Preserve the distinction between inherent risk, residual risk, controls, and actions.
- Prefer small, reversible changes. Update this memory and decision log after meaningful work.

## Known gaps / next best work
1. Move risk schemas and scoring to the backend with versioned scoring policy.
2. Add PostgreSQL migrations and repository/service layers.
3. Add OIDC authentication and workspace-scoped RBAC.
4. Add controls, action plans, residual risk, approval workflow, and immutable audit events.
5. Add tests for scoring boundaries, permissions, validation, and key UI flows.
