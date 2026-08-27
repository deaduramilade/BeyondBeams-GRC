-- Apply this policy with a PostgreSQL administration/migration role.
-- Supply passwords and provider-specific connection settings out of band.
-- Do not put credentials in this file or in source control.
--
-- The migration role owns schema changes. The runtime role must not own tables,
-- functions, or the audit append-only trigger.
-- Replace role names only if the deployment platform requires different names.

DO $$ BEGIN
  CREATE ROLE grc_migrator NOLOGIN;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE ROLE grc_runtime NOLOGIN;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

GRANT USAGE ON SCHEMA public TO grc_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO grc_runtime;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO grc_runtime;
REVOKE UPDATE, DELETE, TRUNCATE ON "AuditEvent" FROM grc_runtime;
GRANT INSERT, SELECT ON "AuditEvent" TO grc_runtime;

ALTER DEFAULT PRIVILEGES FOR ROLE grc_migrator IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO grc_runtime;
ALTER DEFAULT PRIVILEGES FOR ROLE grc_migrator IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO grc_runtime;
-- Reapply the audit-specific revoke after every migration that creates or
-- changes tables. PostgreSQL default privileges cannot target one table.

-- Verify with the administration role after applying:
-- SELECT has_table_privilege('grc_runtime', '"AuditEvent"', 'INSERT');
-- SELECT has_table_privilege('grc_runtime', '"AuditEvent"', 'UPDATE');
-- SELECT has_table_privilege('grc_runtime', '"AuditEvent"', 'DELETE');
-- SELECT has_table_privilege('grc_runtime', '"AuditEvent"', 'TRUNCATE');
-- Expected: INSERT true; UPDATE/DELETE/TRUNCATE false.
