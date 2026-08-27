const { execFileSync, spawnSync } = require("node:child_process");
const { randomBytes } = require("node:crypto");

const modeArgument = process.argv.includes("--mode") ? process.argv[process.argv.indexOf("--mode") + 1] : undefined;
const mode = process.env.PG_REHEARSAL_MODE ?? modeArgument ?? "fresh";
if (!new Set(["fresh", "upgrade"]).has(mode)) {
  console.error("PG_REHEARSAL_MODE must be fresh or upgrade.");
  process.exit(2);
}
const docker = process.env.DOCKER_BIN ?? "docker";
const container = `beyondbeams-grc-postgres-${process.pid}`;
const password = randomBytes(24).toString("base64url");
const database = "grc_rehearsal";
const user = "grc_rehearsal_admin";
const port = process.env.PG_REHEARSAL_PORT ?? "55432";
const databaseUrl = `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@localhost:${port}/${database}`;
const env = { ...process.env, DATABASE_URL: databaseUrl, NODE_ENV: "test", SEED_DEMO_PASSWORD: randomBytes(24).toString("base64url") };
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
  throw new Error("PostgreSQL did not become ready within 30 seconds.");
}
function tenantCounts() {
  const script = "const {PrismaClient}=require('@prisma/client');const db=new PrismaClient();db.tenant.findUnique({where:{slug:'beyondbeams-demo'},select:{id:true,_count:{select:{risks:true}}}}).then(row=>{if(!row)process.exit(1);console.log(JSON.stringify({tenants:1,risks:row._count.risks}))}).finally(()=>db.$disconnect())";
  const result = spawnSync(process.execPath, ["-e", script], { env, encoding: "utf8" });
  if (result.status !== 0) throw new Error("Tenant-scoped connectivity check failed.");
  return JSON.parse(result.stdout.trim());
}
function applyRolePolicy() {
  const sql = require("node:fs").readFileSync("prisma/production-roles.sql");
  run(docker, ["exec", "-i", container, "psql", "-v", "ON_ERROR_STOP=1", "-U", user, "-d", database, "-f", "-"], { input: sql });
  const check = "SELECT has_table_privilege('grc_runtime', '\"AuditEvent\"', 'INSERT'),has_table_privilege('grc_runtime', '\"AuditEvent\"', 'UPDATE'),has_table_privilege('grc_runtime', '\"AuditEvent\"', 'DELETE'),has_table_privilege('grc_runtime', '\"AuditEvent\"', 'TRUNCATE');";
  const result = spawnSync(docker, ["exec", container, "psql", "-At", "-U", user, "-d", database, "-c", check], { encoding: "utf8" });
  if (result.status !== 0 || result.stdout.trim() !== "t|f|f|f") throw new Error("Runtime audit privileges are not append-only.");
  const schemaCheck = spawnSync(docker, ["exec", container, "psql", "-At", "-U", user, "-d", database, "-c", "SELECT has_schema_privilege('grc_runtime', 'public', 'CREATE');"], { encoding: "utf8" });
  if (schemaCheck.status !== 0 || schemaCheck.stdout.trim() !== "f") throw new Error("Runtime role can create schema objects.");
}

process.on("exit", cleanup);
process.on("SIGINT", () => process.exit(130));
try {
  if (runQuiet(["info"]).status !== 0) throw new Error("Docker is required for the PostgreSQL rehearsal and its daemon is not available.");
  cleanup();
  run(docker, ["run", "--detach", "--name", container, "-e", `POSTGRES_DB=${database}`, "-e", `POSTGRES_USER=${user}`, "-e", `POSTGRES_PASSWORD=${password}`, "-p", `${port}:5432`, "postgres:16-alpine"], { env: process.env });
  waitForPostgres();
  run(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "deploy", "--schema", "prisma/schema.postgresql.prisma"]);
  run(process.execPath, ["node_modules/prisma/build/index.js", "generate", "--schema", "prisma/schema.postgresql.prisma"], { env });
  run(process.execPath, ["node_modules/tsx/dist/cli.mjs", "prisma/seed.ts"]);
  const seeded = tenantCounts();
  if (seeded.tenants !== 1 || seeded.risks !== 8) throw new Error("Seed verification failed.");
  if (mode === "upgrade") {
    run(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "deploy", "--schema", "prisma/schema.postgresql.prisma"]);
    const upgraded = tenantCounts();
    if (JSON.stringify(upgraded) !== JSON.stringify(seeded)) throw new Error("Seeded tenant data changed during upgrade rehearsal.");
  }
  applyRolePolicy();
  run(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "status", "--schema", "prisma/schema.postgresql.prisma"]);
  console.log(`Local PostgreSQL ${mode} rehearsal passed. The disposable database will be removed.`);
} catch (error) {
  console.error(error instanceof Error ? error.message : "PostgreSQL rehearsal failed.");
  process.exitCode = 1;
} finally {
  try {
    execFileSync(process.execPath, ["node_modules/prisma/build/index.js", "generate", "--schema", "prisma/schema.prisma"], { stdio: "inherit", env: process.env });
  } catch {
    console.error("Could not restore the default SQLite Prisma client after rehearsal.");
    process.exitCode = 1;
  }
  cleanup();
}
