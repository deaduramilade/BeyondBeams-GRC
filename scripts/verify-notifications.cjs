const { PrismaClient } = require("@prisma/client");
const db = new PrismaClient();

async function main() {
  const tenant = await db.tenant.findFirst({ select: { id: true, name: true, reviewRemindersEnabled: true, reviewReminderCadence: true } });
  if (!tenant) throw new Error("No tenant found. Run npm run db:seed first.");
  const [users, notifications] = await Promise.all([db.user.count({ where: { tenantId: tenant.id } }), db.notification.findMany({ where: { tenantId: tenant.id }, orderBy: { createdAt: "desc" }, take: 10, select: { type: true, recipient: true, status: true, provider: true, createdAt: true } })]);
  console.log(JSON.stringify({ tenant, users, notifications }, null, 2));
}
main().finally(() => db.$disconnect());