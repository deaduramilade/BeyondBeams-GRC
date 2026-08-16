# Development & Operations Guide
## Local workflow
Backend: create a virtual environment in `backend`, install `requirements.txt`, configure a local root `.env`, and run `uvicorn app.main:app --reload --port 8000`.

Frontend: from `frontend`, run `npm install` and `npm run dev`. The UI calls `VITE_API_BASE_URL` and shows a visible local-demo state when the API is unavailable, allowing design review without masking deployment configuration.

## Validation
- Frontend build: `npm run build` from `frontend`.
- Backend tests: `pytest` from `backend`.
- API contract: inspect `/api/docs` locally after starting FastAPI.
- Before release, test permissions, data isolation, score boundaries, audit events, and migration rollback.

## Data and security
- Local `.env` files are never committed.
- `VITE_*` values are public and must contain no credentials.
- Production secrets belong in a managed secret store.
- API must enforce workspace scope and permissions server-side; UI controls are not security boundaries. The current local repository has no tenant/auth boundary and must not be exposed publicly.
- Logs must avoid passwords, tokens, sensitive personal data, and full evidence contents.

## Change discipline
Update `MEMORY.md` with completed work and known gaps. Add material design changes to `DECISIONS.md`. Keep `ROADMAP.md` aligned with actual implementation. Do not mark PostgreSQL durability, auth, compliance, or production audit persistence complete until it exists and is tested.

## Incident basics
Preserve request IDs and relevant audit events, restrict access to incident data, document timeline and impact, rotate exposed credentials, and record corrective actions. Never edit historical audit records in place.
