# GRC Risk Register & Assessment Tool

A portfolio project for managing and assessing organizational risk. It is designed to demonstrate practical React, FastAPI, PostgreSQL, and secure-development practices without making claims of regulatory certification or production compliance.

## Current status
The Phase 1-3 product slice is implemented for local integration and review. It includes a responsive risk workspace, API-backed risk register with local demo fallback, backend-authoritative 1-5 scoring, separate inherent and residual assessments, controls and treatment actions, residual/inherent heat maps, dashboard metrics, audit events, executive report facts, and CSV register export.

Deployment prerequisites remain explicit: the current API store is an in-process repository for development and must be replaced by the PostgreSQL repository and migrations before multi-instance production use; OIDC, workspace-scoped RBAC, managed secrets, object storage for report artifacts, background report jobs, and operational monitoring require environment-specific configuration and release verification. Until those gates are completed, treat the local deployment as a reviewable product build, not a production system of record.

## Architecture

`React/Vite frontend → FastAPI API → PostgreSQL`

The browser communicates only with FastAPI. PostgreSQL credentials stay in backend/local environment configuration and never belong in frontend variables. The current backend domain/service boundary is designed so the in-process store can be replaced by a PostgreSQL repository without changing the API contract.

## Local development

### Backend

1. Create and activate a virtual environment in `backend/`.
2. Install dependencies: `pip install -r requirements.txt`.
3. Copy the root `.env.example` to a local `.env` and fill only local values.
4. Run: `uvicorn app.main:app --reload --port 8000` from `backend/`.
5. Verify: `GET http://127.0.0.1:8000/api/health`.

### Frontend

1. In `frontend/`, run `npm install`.
2. Copy the root `.env.example` values needed by the frontend to `frontend/.env.local` (only `VITE_API_BASE_URL`).
3. Run `npm run dev`.

### PostgreSQL with Docker

1. Put a local `POSTGRES_PASSWORD` in a root `.env` file. Do not commit it.
2. Run `docker compose up -d postgres`.
3. Set the backend `DATABASE_URL` locally. PostgreSQL repository wiring and migrations are a deployment gate; the local API currently starts with an in-process seeded repository so the complete workflow can be reviewed without a database.

## Security notes

- `.env`, virtual environments, build artifacts, local keys, and generated reports are ignored.
- No credentials or API secrets are present in this repository.
- `VITE_*` variables are public browser values; never use them for secrets.
- CORS origins are environment-configured and do not default to a wildcard.

## Project documentation
- [Project charter](docs/PROJECT_CHARTER.md) — purpose, scope, principles, and success measures.
- [Project memory](MEMORY.md) — current baseline, working rules, and known gaps for future assistants.
- [Architecture decisions](docs/DECISIONS.md) — durable product and engineering rationale.
- [Roadmap](docs/ROADMAP.md) — sequenced delivery plan and release gates.
- [Operations guide](docs/OPERATIONS.md) — development, security, validation, and change discipline.

See the roadmap for the next milestones: trusted data foundation, governance controls, and insight/assurance.

## API surface
- `GET/POST /api/v1/risks` and `GET /api/v1/risks/{id}` for the register and risk detail.
- `POST /api/v1/risks/{id}/assessments/{inherent|residual}` for versioned assessments.
- `POST /api/v1/risks/{id}/controls` and `/actions` for response tracking.
- `GET /api/v1/dashboard`, `/heat-map`, `/audit`, and `/reports/executive-summary` for management views.
- `GET /api/v1/reports/risk-register.csv` for operational export.
