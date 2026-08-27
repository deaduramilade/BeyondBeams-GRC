-- Phase 1 audit context. This is a new migration so already-applied history
-- remains immutable.
ALTER TABLE "AuditEvent" ADD COLUMN "requestId" TEXT;
ALTER TABLE "AuditEvent" ADD COLUMN "source" TEXT;
ALTER TABLE "AuditEvent" ADD COLUMN "ipAddress" TEXT;
ALTER TABLE "AuditEvent" ADD COLUMN "userAgent" TEXT;
ALTER TABLE "AuditEvent" ADD COLUMN "beforeJson" TEXT;
ALTER TABLE "AuditEvent" ADD COLUMN "afterJson" TEXT;
ALTER TABLE "AuditEvent" ADD COLUMN "reason" TEXT;
CREATE INDEX "AuditEvent_tenantId_requestId_idx" ON "AuditEvent"("tenantId", "requestId");
REVOKE UPDATE, DELETE, TRUNCATE ON "AuditEvent" FROM PUBLIC;