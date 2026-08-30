# BeyondBeams GRC

BeyondBeams GRC is a multi-tenant risk register, compliance mapping, and assessment workspace built with Next.js 15, strict TypeScript, Auth.js v5, Prisma, Tailwind CSS, and shadcn/ui. Local development uses SQLite for zero-setup assessment; PostgreSQL is the canonical production database.

Operational and release governance documentation:
- [docs/DEVELOPMENT_STATUS.md](docs/DEVELOPMENT_STATUS.md): Complete five-phase development inventory and outstanding infrastructure requirements.
- [docs/RELEASE.md](docs/RELEASE.md): Exact release gates, migration rehearsals, and rollback procedures.
- [docs/OPERATIONS.md](docs/OPERATIONS.md): Operational runbook, job queues, retention engine, health probes, and correlation IDs.
- [docs/SECURITY.md](docs/SECURITY.md): Security architecture, log redaction, token cryptography, and audit trail controls.

> [!WARNING]
> BeyondBeams GRC is designed for local evaluation, staging rehearsal, and internal review. It is **not yet approved for real customer data** until managed cloud PostgreSQL with point-in-time recovery, KMS-encrypted object storage, dedicated queue workers, verified email deliverability, and third-party security audits are completed.

## Local setup

Prerequisites: Node.js 20 or 22 LTS and npm.

```bash
npm install
cp .env.example .env
npm run setup
npm run dev
```

On Windows PowerShell, use `Copy-Item .env.example .env` instead of `cp`. Open [http://localhost:3000](http://localhost:3000). If that port is occupied, run `npm run dev -- -p 3001` and set `AUTH_URL` to the same origin.

## Local seed data

The seed creates one demo tenant, one Owner membership, eight realistic sample risks, compliance mappings, and governance workflows. To choose a local seed login password, set the untracked `SEED_DEMO_PASSWORD` value in `.env`; otherwise the seed generates a random password and does not store it in the repository.

## Commands & Release Gates

- `npm run dev`: start the development server.
- `npm run build`: run a production build.
- `npm run typecheck`: run strict TypeScript checking.
- `npm test`: run the full unit and integration test suite (56+ tests).
- `npm run test:tenant-isolation`: run the dedicated multi-tenant boundary contract suite.
- `npm run db:validate`: validate both SQLite and PostgreSQL Prisma schemas.
- `npm run security:scan`: scan tracked source files for credential patterns.
- `npm run retention:cleanup`: run the retention engine CLI (with `--dry-run` or `--live`).
- `npm run db:postgres:fresh`: test PostgreSQL migration deploy and audit grants in a disposable Docker container.
- `npm run db:postgres:backup-rehearsal`: exercise full database dump and restore fidelity in Docker.

Deployment probes are available at `/api/health` and `/api/health/live` (liveness) and `/api/ready` (readiness). Metrics counters are exposed at `/api/metrics`.

The CI workflow runs typecheck, lint, tests, secret scanning, both Prisma validations, the production build, and whitespace validation with normal failure propagation. PostgreSQL runtime/migration role policy is documented in `prisma/production-roles.sql`; passwords and provider settings must be supplied through the deployment secret manager.

## Data and authentication

Local development uses `prisma/schema.prisma` with SQLite. `prisma/schema.postgresql.prisma` provides the equivalent PostgreSQL schema for production migration. Do not use both schemas against the same generated client.

Auth.js v5 provides secure JWT sessions, email/password registration and login, and short-lived, single-use magic links. First registration creates an isolated organisation and Owner membership atomically. Magic-link and invitation tokens are SHA-256 hashed at rest. Set a strong `AUTH_SECRET` outside local development.

Owners and Risk Managers can invite members from `/app/roles` and assign Owner, Risk Manager, Assessor, Viewer, or Auditor. Pending memberships expire after seven days and activate only when the invited email accepts the token. Invitation emails include the organisation, role, expiry, and single-use acceptance link. Expired and accepted links show a clear recovery state.

## Email notifications

Local development defaults to `EMAIL_PROVIDER=preview` and never requires SMTP or provider credentials. Rendered email previews are stored in the tenant-scoped `Notification` audit table and are available through the local preview flow; raw authentication, invitation, and preview URLs are never written to logs. Production must use Resend by setting `EMAIL_PROVIDER=resend`, `RESEND_API_KEY`, and a verified `EMAIL_FROM`; secrets must remain outside source control.

Owners configure review reminders under `/app/settings`; users can disable review, assignment, or export email categories there. The default review cadence is 7 days before, 1 day before, and the due/overdue day. Free workspaces use that default cadence; custom cadence requires Basic or higher. Reminder dispatch is idempotent and includes formal and emerging risks:

```bash
curl -X POST http://localhost:3000/api/notifications/review-reminders
node scripts/verify-notifications.cjs
```

Set `NOTIFICATION_CRON_SECRET` in shared environments and call the endpoint with `Authorization: Bearer <secret>`. Schedule it daily with the deployment platform. To test upcoming and overdue reminders, set a risk and an emerging risk review date to today, tomorrow, or seven days from today, invoke the endpoint, then open the preview URLs printed by the dev server.

The Settings page can email a Board PDF, Excel/CSV risk register, or audit export to up to ten recipients. Delivery uses the existing export quota check before generation, stores the generated artifact against its tenant export record, and sends a random 24-hour download link. Risk creation/update, structured action assignment, and emerging-risk settlement also send preference-aware lifecycle emails. Every delivery attempt is retained with status, recipient, type, related entity, provider, and timestamp; each domain notification also has a corresponding audit event.

All risk and audit operations derive `tenantId` from the authenticated server session. Owner, Risk Manager, and Assessor roles may create or edit risks; Owner and Risk Manager may delete; Viewer and Auditor are read-only. Deletes are soft deletes and create audit events.

The public landing page is `/`. Authenticated tools are under `/app`; risk creation and reassessment automatically persist relevant compliance references. Compliance excerpts and framework mappings are curated governance aids with links/source metadata and must be checked against current official material and organisation-specific applicability. They do not provide legal advice, certification, or an authoritative conformance opinion. Each user has three free board-language translations unless `paidPlan` is enabled.

## Production notes

Before production, configure PostgreSQL, a transactional email provider, managed secrets, HTTPS, database migrations, backups, monitoring, rate limiting, and a daily authenticated reminder schedule. `npm run db:migrate:deploy` is the production migration command. Database-backed report artifacts are suitable for local assessment only; production deployments should move files to tenant-scoped object storage while retaining hashed expiry tokens and audit records. See [docs/OPERATIONS.md](docs/OPERATIONS.md) and [docs/RELEASE_STATUS.md](docs/RELEASE_STATUS.md).