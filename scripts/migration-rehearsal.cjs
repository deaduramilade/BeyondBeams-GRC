const { execFileSync } = require("node:child_process");

const databaseUrl = process.env.DATABASE_URL ?? "";
if (!/^postgres(?:ql)?:\/\//i.test(databaseUrl)) {
  console.error("Migration rehearsal requires DATABASE_URL to target PostgreSQL.");
  process.exit(2);
}
if (process.env.MIGRATION_REHEARSAL !== "true") {
  console.error("Set MIGRATION_REHEARSAL=true and use a disposable PostgreSQL database. This command changes the target schema.");
  process.exit(2);
}
const prisma = ["node_modules/prisma/build/index.js", "migrate", "deploy", "--schema", "prisma/schema.postgresql.prisma"];
try {
  execFileSync(process.execPath, prisma, { stdio: "inherit", env: { ...process.env, DATABASE_URL: databaseUrl } });
  execFileSync(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "status", "--schema", "prisma/schema.postgresql.prisma"], { stdio: "inherit", env: { ...process.env, DATABASE_URL: databaseUrl } });
  console.log("Migration rehearsal completed. Run the documented privilege and backup/restore checks against this disposable database before accepting the result.");
} catch {
  console.error("Migration rehearsal failed. No credentials or database details were printed.");
  process.exit(1);
}
