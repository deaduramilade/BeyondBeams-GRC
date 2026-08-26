# BeyondBeams GRC

BeyondBeams GRC is a multi-tenant risk register and assessment workspace built with Next.js 15, strict TypeScript, Auth.js, Prisma, Tailwind CSS, shadcn/ui, Radix UI, and SQLite for zero-setup local development. PostgreSQL is the canonical production database.

Current capability and remaining work are tracked in [docs/DEVELOPMENT_STATUS.md](docs/DEVELOPMENT_STATUS.md), with detailed Phase 4 delivery in [docs/PHASE_4_DELIVERY.md](docs/PHASE_4_DELIVERY.md) and release gates in [docs/RELEASE_STATUS.md](docs/RELEASE_STATUS.md). The application is suitable for controlled local assessment and staging preparation; it is not yet approved for real customer data.

Phase 2 governance is available under `/app/governance`; the assessment, treatment, and control navigation entries open that governed workspace. Residual assessments, evidence links, control owners, treatment-action updates, and appetite-breach resolutions are validated server-side within the authenticated tenant.

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

The seed creates one demo tenant, one Owner membership, eight realistic sample risks, worldwide compliance references and linkages, workflow examples, and one emerging-risk monitoring case. To choose a local seed login password, set the untracked `SEED_DEMO_PASSWORD` value in `.env`; otherwise the seed generates a random password and does not print it or store it in the repository.

Framework mapping is available at `/app/frameworks`. Owners and Risk Managers can enable frameworks; risk writers can search and map enabled controls while creating, editing, or viewing a risk. Risk forms also accept tenant-owned business unit, objective, risk source, and regulatory-domain context when those taxonomy items have been configured in Governance. Free and Basic workspaces have framework and mapping limits, while Professional and Premium workspaces can use all included ISO 27001, NIST CSF 2.0, SOC 2, HIPAA, and fintech controls.

## Commands

- `npm run dev`: start the development server.
- `npm run build`: run a production build.
- `npm run typecheck`: run strict TypeScript checking.
- `npm run setup`: generate Prisma Client, create the SQLite database, and seed demo data.
- `npm run db:seed`: reset the demo tenant's sample risks.

Deployment probes are available at `/api/health` (liveness) and `/api/ready` (database readiness). The readiness endpoint returns `503` when the database cannot be reached.

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