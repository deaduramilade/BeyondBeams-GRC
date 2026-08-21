const { PrismaClient } = require("@prisma/client");
const db = new PrismaClient();

async function main() {
  const tenant = await db.tenant.findUniqueOrThrow({ where: { slug: "beyondbeams-demo" } });
  const frameworks = await db.framework.findMany({ include: { controls: true, tenantSelections: { where: { tenantId: tenant.id, enabled: true } } }, orderBy: { name: "asc" } });
  const mappingCount = await db.riskFrameworkMapping.count({ where: { risk: { tenantId: tenant.id } } });
  console.log(JSON.stringify({ tenant: tenant.name, plan: tenant.plan, frameworks: frameworks.map((framework) => ({ name: framework.name, controls: framework.controls.length, enabled: framework.tenantSelections.length > 0 })), mappingCount }, null, 2));
}

main().finally(() => db.$disconnect());