const { execFileSync } = require("node:child_process");

const schemas = [
  ["prisma/schema.prisma", "file:./dev.db"],
  ["prisma/schema.postgresql.prisma", "postgresql://localhost:5432/grc_risk_register"],
];
for (const [schema, databaseUrl] of schemas) {
  const env = { ...process.env, DATABASE_URL: databaseUrl };
  execFileSync(process.execPath, ["node_modules/prisma/build/index.js", "validate", "--schema", schema], { env, stdio: "inherit" });
}