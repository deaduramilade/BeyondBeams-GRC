ALTER TABLE "Risk" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "ExportHistory" ADD COLUMN "downloadedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "mfaSecret" TEXT;
ALTER TABLE "User" ADD COLUMN "mfaEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "mfaConfirmedAt" TIMESTAMP(3);
CREATE TABLE "TenantSequence" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "value" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "TenantSequence_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "TenantSequence_tenantId_name_key" ON "TenantSequence"("tenantId", "name");
ALTER TABLE "TenantSequence" ADD CONSTRAINT "TenantSequence_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION prevent_audit_event_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Audit events are append-only';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "AuditEvent_append_only" BEFORE UPDATE OR DELETE ON "AuditEvent" FOR EACH ROW EXECUTE FUNCTION prevent_audit_event_mutation();
REVOKE UPDATE, DELETE, TRUNCATE ON "AuditEvent" FROM PUBLIC;