# BeyondBeams GRC – Security Policy & Baseline

## 1. Security Architecture & Controls

BeyondBeams GRC implements multi-tenant isolation, defensive authorization, token cryptography, and audit integrity across all endpoints.

### A. Multi-Tenant Isolation
- All database queries enforce tenant scoping (`where: { tenantId }`).
- Client-supplied `tenantId` and `role` parameters are strictly rejected; identity and authorization context are derived exclusively from the verified server-side session.
- Cross-tenant record reads, mutations, approvals, and deletions fail closed.

### B. Single-Use Hashed Tokens
- **Report Download Links**: SHA-256 hashed at rest in `downloadTokenHash`, valid for 24 hours, and atomically consumed upon download. Replay attempts return `HTTP 410 Gone`.
- **Magic-Link & Invitation Tokens**: SHA-256 hashed at rest, expiring after 15 minutes (magic links) or 7 days (invitations).

### C. Rate Limiting & Denial-of-Service Defense
- HMAC-keyed database-backed rate limiting (`RateLimitBucket`) protects authentication, magic-link requests, report generation, and invitation dispatch.
- Returns `HTTP 429 Too Many Requests` with `Retry-After` headers when limits are exceeded.

### D. Sensitive Data & Log Redaction
- `lib/logger.ts` recursively sanitizes all JSON output, stripping tokens, passwords, secrets, credentials, and magic link URLs.
- Raw secrets are never written to disk, database logs, or terminal outputs.

### E. Append-Only Audit Logging
- Material lifecycle mutations (risk creation, score modifications, four-eyes decisions, treatment changes, downloads, retries, retention purges) write immutable `AuditEvent` rows.
- PostgreSQL production role templates (`prisma/production-roles.sql`) revoke `UPDATE`, `DELETE`, and `TRUNCATE` privileges on audit tables from the runtime role.

---

## 2. Outstanding Infrastructure Requirements (Production Pre-Requisites)

The following operational and security capabilities require external infrastructure, cloud providers, or third-party audits before the application can be approved for real customer data:

1. **Managed PostgreSQL Infrastructure**:
   - Cloud database (e.g. AWS RDS or GCP Cloud SQL) with automated daily snapshots, multi-AZ failover, and point-in-time recovery (PITR).
2. **Encrypted Cloud Object Storage**:
   - Production S3 / Google Cloud Storage bucket with customer-managed KMS encryption, versioning, and private lifecycle rules for report and evidence storage.
3. **Dedicated Background Queue Daemons**:
   - Distributed queue workers (e.g., BullMQ / SQS / Celery) with dead-letter queue monitoring and alert paging.
4. **Production Email Provider Integration**:
   - Configured Resend / SendGrid account with verified SPF, DKIM, DMARC DNS records, bounce webhook ingestion, and deliverability monitoring.
5. **Monitoring, Alerting & SLO Dashboards**:
   - Centralized APM (Datadog / OpenTelemetry / Prometheus) and alerting on error spikes, database connection saturation, and job queue latency.
6. **Independent Security Audit**:
   - Third-party penetration testing, threat modeling, and SOC 2 Type II conformance review.
