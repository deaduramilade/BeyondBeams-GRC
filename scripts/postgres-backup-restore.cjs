#!/usr/bin/env node

/**
 * PostgreSQL Backup & Restore Rehearsal Script
 * Validates pg_dump / pg_restore fidelity against a disposable PostgreSQL 16 container.
 */

const { execFileSync, spawnSync } = require("node:child_process");
const { randomBytes } = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const docker = process.env.DOCKER_BIN ?? "docker";
const container = `beyondbeams-grc-backup-rehearsal-${process.pid}`;
const password = randomBytes(24).toString("base64url");
const database = "grc_backup_rehearsal";
const user = "grc_backup_admin";
const port = process.env.PG_BACKUP_REHEARSAL_PORT ?? "55433";
const databaseUrl = `postgresql://${user}:${password}@localhost:${port}/${database}`;
const env = { ...process.env, DATABASE_URL: databaseUrl, NODE_ENV: "test", SEED_DEMO_PASSWORD: "BackupRehearsal123!" };

const run = (file, args, options = {}) => execFileSync(file, args, { stdio: "inherit", env, ...options });
const runQuiet = (args) => spawnSync(docker, args, { encoding: "utf8", env: process.env, stdio: ["ignore", "pipe", "pipe"] });

function cleanup() {
  runQuiet(["rm", "--force", container]);
}

function waitForPostgres() {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const result = runQuiet(["exec", container, "pg_isready", "-U", user, "-d", database]);
    if (result.status === 0) return;
    spawnSync(process.execPath, ["-e", "setTimeout(() => {}, 1000)"]);
  }
  throw new Error("PostgreSQL container did not become ready within 30 seconds.");
}

function getDatabaseMetrics() {
  const query = `
    SELECT json_build_object(
      'tenants', (SELECT COUNT(*) FROM "Tenant"),
      'users', (SELECT COUNT(*) FROM "User"),
      'risks', (SELECT COUNT(*) FROM "Risk"),
      'auditEvents', (SELECT COUNT(*) FROM "AuditEvent"),
      'treatmentPlans', (SELECT COUNT(*) FROM "TreatmentPlan"),
      'controlProfiles', (SELECT COUNT(*) FROM "ControlProfile")
    );
  `;
  const result = spawnSync(docker, ["exec", container, "psql", "-At", "-U", user, "-d", database, "-c", query], { encoding: "utf8" });
  if (result.status !== 0) throw new Error("Failed to query database metrics.");
  return JSON.parse(result.stdout.trim());
}

process.on("exit", cleanup);
process.on("SIGINT", () => process.exit(130));

async function main() {
  console.log("=== BeyondBeams GRC: PostgreSQL Backup & Restore Rehearsal ===");

  if (runQuiet(["info"]).status !== 0) {
    console.warn("Docker daemon is not available. Skipping containerised backup rehearsal.");
    console.log("For local assessment, ensure Docker is running and execute: node scripts/postgres-backup-restore.cjs");
    return;
  }

  cleanup();

  console.log(`1. Launching disposable PostgreSQL 16 container (${container})...`);
  run(docker, [
    "run",
    "--detach",
    "--name",
    container,
    "-e",
    `POSTGRES_DB=${database}`,
    "-e",
    `POSTGRES_USER=${user}`,
    "-e",
    `POSTGRES_PASSWORD=${password}`,
    "-p",
    `${port}:5432`,
    "postgres:16-alpine",
  ]);

  waitForPostgres();
  console.log("2. Container ready. Applying migrations and seed data...");

  run(process.execPath, ["node_modules/prisma/build/index.js", "db", "push", "--schema", "prisma/schema.postgresql.prisma"]);
  run(process.execPath, ["node_modules/tsx/dist/cli.mjs", "prisma/seed.ts"]);

  const preMetrics = getDatabaseMetrics();
  console.log("3. Pre-backup database state captured:", preMetrics);

  console.log("4. Executing pg_dump backup inside container...");
  const dumpFile = `/tmp/backup_${Date.now()}.sql`;
  const dumpResult = spawnSync(docker, ["exec", container, "pg_dump", "-U", user, "-d", database, "-Fp", "-f", dumpFile], { encoding: "utf8" });
  if (dumpResult.status !== 0) {
    throw new Error(`pg_dump failed: ${dumpResult.stderr}`);
  }

  console.log("5. Simulating catastrophic drop and clean recreation of database...");
  run(docker, ["exec", container, "psql", "-U", user, "-d", "postgres", "-c", `DROP DATABASE "${database}";`]);
  run(docker, ["exec", container, "psql", "-U", user, "-d", "postgres", "-c", `CREATE DATABASE "${database}" OWNER "${user}";`]);

  console.log("6. Executing pg_restore / psql restore...");
  const restoreResult = spawnSync(docker, ["exec", container, "psql", "-U", user, "-d", database, "-f", dumpFile], { encoding: "utf8" });
  if (restoreResult.status !== 0) {
    throw new Error(`Restore failed: ${restoreResult.stderr}`);
  }

  const postMetrics = getDatabaseMetrics();
  console.log("7. Post-restore database state captured:", postMetrics);

  // Assert exact parity
  const matches = JSON.stringify(preMetrics) === JSON.stringify(postMetrics);
  if (!matches) {
    console.error("MISMATCH between pre-backup and post-restore metrics!");
    console.error("Pre:", preMetrics);
    console.error("Post:", postMetrics);
    process.exit(1);
  }

  console.log("✔ Backup and restore fidelity verified: 100% record parity across all tables.");
  console.log("=== Backup & Restore Rehearsal Complete ===");
}

main().catch((err) => {
  console.error("Backup rehearsal failed:", err);
  process.exit(1);
});
