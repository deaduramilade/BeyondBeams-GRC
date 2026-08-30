#!/usr/bin/env node

/**
 * Retention Cleanup CLI
 * Usage:
 *   node scripts/retention-cleanup.cjs --dry-run
 *   node scripts/retention-cleanup.cjs --live
 */

const { PrismaClient } = require("@prisma/client");
const db = new PrismaClient();

async function main() {
  const args = process.argv.slice(2);
  const isLive = args.includes("--live");
  const isDryRun = !isLive;

  console.log(`[BeyondBeams GRC] Starting Retention Cleanup (Mode: ${isDryRun ? "DRY RUN" : "LIVE"})...`);

  const now = new Date();
  const tenants = await db.tenant.findMany({
    select: { id: true, name: true, legalHold: true, retentionDays: true },
  });

  let totalPurgedReports = 0;
  let totalPurgedTokens = 0;
  let totalPurgedRisks = 0;

  for (const tenant of tenants) {
    const retentionDays = tenant.retentionDays || 365;
    const cutoff = new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000);

    // 1. Expired report exports
    const expiredExports = await db.exportHistory.findMany({
      where: {
        tenantId: tenant.id,
        downloadExpires: { lt: now },
        artifactBase64: { not: null },
      },
      select: { id: true },
    });

    // 2. Soft-deleted risks
    let deletedRisksCount = 0;
    if (!tenant.legalHold) {
      const deletedRisks = await db.risk.findMany({
        where: {
          tenantId: tenant.id,
          deletedAt: { not: null, lt: cutoff },
        },
        select: { id: true },
      });
      deletedRisksCount = deletedRisks.length;

      if (isLive && deletedRisks.length > 0) {
        await db.risk.deleteMany({
          where: { id: { in: deletedRisks.map((r) => r.id) } },
        });
      }
    }

    if (isLive && expiredExports.length > 0) {
      await db.exportHistory.updateMany({
        where: { id: { in: expiredExports.map((e) => e.id) } },
        data: { artifactBase64: null, storageKey: null },
      });
    }

    totalPurgedReports += expiredExports.length;
    totalPurgedRisks += deletedRisksCount;

    console.log(`- Tenant: ${tenant.name} | Legal Hold: ${tenant.legalHold ? "YES" : "NO"} | Reports: ${expiredExports.length} | Deleted Risks: ${deletedRisksCount}`);
  }

  // 3. Expired verification tokens
  const expiredTokens = await db.verificationToken.count({
    where: { expires: { lt: now } },
  });
  totalPurgedTokens = expiredTokens;

  if (isLive && expiredTokens > 0) {
    await db.verificationToken.deleteMany({
      where: { expires: { lt: now } },
    });
  }

  console.log(`\nCleanup Summary:`);
  console.log(`- Total Expired Reports: ${totalPurgedReports}`);
  console.log(`- Total Expired Tokens:  ${totalPurgedTokens}`);
  console.log(`- Total Purged Risks:    ${totalPurgedRisks}`);
  console.log(`[BeyondBeams GRC] Retention execution completed successfully.`);
}

main()
  .catch((err) => {
    console.error("Retention cleanup failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
