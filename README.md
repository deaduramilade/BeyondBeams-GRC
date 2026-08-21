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

## Commands

- `npm run dev`: start the development server.
- `npm run build`: run a production build.
- `npm run typecheck`: run strict TypeScript checking.
- `npm run setup`: generate Prisma Client, create the SQLite database, and seed demo data.
- `npm run db:seed`: reset the demo tenant's sample risks.

## Data and authentication

Local development uses `prisma/schema.prisma` with SQLite. `prisma/schema.postgresql.prisma` provides the equivalent PostgreSQL schema for production migration. Do not use both schemas against the same generated client.

Auth.js v5 provides secure JWT sessions, email/password registration and login, and short-lived, single-use magic links. First registration creates an isolated organisation and Owner membership atomically. Magic-link and invitation tokens are SHA-256 hashed at rest. Set a strong `AUTH_SECRET` outside local development.

Owners and Risk Managers can invite members from `/app/roles` and assign Owner, Risk Manager, Assessor, Viewer, or Auditor. Pending memberships expire after seven days and activate only when the invited email accepts the token. Local development prints complete invitation and magic-link URLs to the server console and exposes the local invitation link after submission. Replace `deliverLink` in `lib/tokens.ts` with a transactional email provider for production delivery.

All risk and audit operations derive `tenantId` from the authenticated server session. Owner, Risk Manager, and Assessor roles may create or edit risks; Owner and Risk Manager may delete; Viewer and Auditor are read-only. Deletes are soft deletes and create audit events.

The public landing page is `/`. Authenticated tools are under `/app`; risk creation and reassessment automatically persist relevant compliance references. Compliance excerpts are curated assessment aids with links to official sources and should be checked for current applicability. Each user has three free board-language translations unless `paidPlan` is enabled.

## Production notes

Before production, configure PostgreSQL, a transactional email provider, managed secrets, HTTPS, database migrations, backups, monitoring, and rate limiting. The included console delivery and seed password are development conveniences.