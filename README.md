# BeyondBeams GRC

BeyondBeams GRC is a multi-tenant risk register and assessment workspace built with Next.js 15, strict TypeScript, Auth.js, Prisma, Tailwind CSS, shadcn/ui, Radix UI, and SQLite for zero-setup local development.

## Local setup

Prerequisites: Node.js 20 or 22 LTS and npm.

```bash
npm install
cp .env.example .env
npm run setup
npm run dev
```

On Windows PowerShell, use `Copy-Item .env.example .env` instead of `cp`. Open [http://localhost:3000](http://localhost:3000). If that port is occupied, run `npm run dev -- -p 3001` and set `AUTH_URL` to the same origin.

## Demo login

- Email: `owner@beyondbeams.com`
- Password: `BeyondBeams2026!`

The seed creates one demo tenant, one Owner membership, eight realistic sample risks, worldwide compliance references and linkages, workflow examples, and one emerging-risk monitoring case.

Framework mapping is available at `/app/frameworks`. Owners and Risk Managers can enable frameworks; risk writers can search and map enabled controls while creating, editing, or viewing a risk. Free and Basic workspaces have framework and mapping limits, while Professional and Premium workspaces can use all included ISO 27001, NIST CSF 2.0, SOC 2, HIPAA, and fintech controls.

## Commands

- `npm run dev`: start the development server.
- `npm run build`: run a production build.
- `npm run typecheck`: run strict TypeScript checking.
- `npm run setup`: generate Prisma Client, create the SQLite database, and seed demo data.
- `npm run db:seed`: reset the demo tenant's sample risks.

## Data and authentication

Local development uses `prisma/schema.prisma` with SQLite. `prisma/schema.postgresql.prisma` provides the equivalent PostgreSQL schema for production migration. Do not use both schemas against the same generated client.

Auth.js v5 provides secure JWT sessions, email/password registration and login, and short-lived, single-use magic links. First registration creates an isolated organisation and Owner membership atomically. Magic-link and invitation tokens are SHA-256 hashed at rest. Set a strong `AUTH_SECRET` outside local development.

Owners and Risk Managers can invite members from `/app/roles` and assign Owner, Risk Manager, Assessor, Viewer, or Auditor. Pending memberships expire after seven days and activate only when the invited email accepts the token. Invitation emails include the organisation, role, expiry, and single-use acceptance link. Expired and accepted links show a clear recovery state.

## Email notifications

Local development defaults to `EMAIL_PROVIDER=preview` and never requires SMTP or provider credentials. Every rendered email is written to the tenant-scoped `Notification` audit table, printed in full to the server console, and includes an `/email-preview/...` browser link. Production can use Resend by setting `EMAIL_PROVIDER=resend`, `RESEND_API_KEY`, and a verified `EMAIL_FROM`; secrets must remain outside source control.

Owners configure review reminders under `/app/settings`; users can disable review, assignment, or export email categories there. The default review cadence is 7 days before, 1 day before, and the due/overdue day. Free workspaces use that default cadence; custom cadence requires Basic or higher. Reminder dispatch is idempotent and includes formal and emerging risks:

```bash
curl -X POST http://localhost:3000/api/notifications/review-reminders
node scripts/verify-notifications.cjs
```

Set `NOTIFICATION_CRON_SECRET` in shared environments and call the endpoint with `Authorization: Bearer <secret>`. Schedule it daily with the deployment platform. To test upcoming and overdue reminders, set a risk and an emerging risk review date to today, tomorrow, or seven days from today, invoke the endpoint, then open the preview URLs printed by the dev server.

The Settings page can email a Board PDF, Excel/CSV risk register, or audit export to up to ten recipients. Delivery uses the existing export quota check before generation, stores the generated artifact against its tenant export record, and sends a random 24-hour download link. Risk creation/update, structured action assignment, and emerging-risk settlement also send preference-aware lifecycle emails. Every delivery attempt is retained with status, recipient, type, related entity, provider, and timestamp; each domain notification also has a corresponding audit event.

All risk and audit operations derive `tenantId` from the authenticated server session. Owner, Risk Manager, and Assessor roles may create or edit risks; Owner and Risk Manager may delete; Viewer and Auditor are read-only. Deletes are soft deletes and create audit events.

The public landing page is `/`. Authenticated tools are under `/app`; risk creation and reassessment automatically persist relevant compliance references. Compliance excerpts are curated assessment aids with links to official sources and should be checked for current applicability. Each user has three free board-language translations unless `paidPlan` is enabled.

## Production notes

Before production, configure PostgreSQL, a transactional email provider, managed secrets, HTTPS, database migrations, backups, monitoring, rate limiting, and a daily authenticated reminder schedule. Database-backed report artifacts are suitable for this local implementation; production deployments should move larger files to tenant-scoped object storage while retaining hashed expiry tokens and audit records.