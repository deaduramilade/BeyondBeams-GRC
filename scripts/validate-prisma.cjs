const { execFileSync } = require("node:child_process");

const env = { ...process.env, DATABASE_URL: "postgresql://grc_app:grc_password@localhost:5432/grc_risk_register" };
for (const schema of ["prisma/schema.prisma", "prisma/schema.postgresql.prisma"]) {
  execFileSync(process.execPath, ["node_modules/prisma/build/index.js", "validate", "--schema", schema], { env, stdio: "inherit" });
}