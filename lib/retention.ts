import type { PrismaClient } from "@prisma/client";
import { reportStorage } from "@/lib/report-storage";
import { recordRetentionPurge } from "@/lib/metrics";
import { logger } from "@/lib/logger";

export type RetentionCleanupResult = {
  tenantId: string;
  legalHold: boolean;
  dryRun: boolean;
  purgedReports: number;
  purgedTokens: number;
  purgedSoftDeletedRisks: number;
  purgedNotifications: number;
  message: string;
};

export async function runTenantRetentionCleanup(
  db: PrismaClient,
  tenantId: string,
  options: { dryRun?: boolean; actorId?: string } = {}
): Promise<RetentionCleanupResult> {
  const dryRun = options.dryRun ?? false;
  const now = new Date();

  const tenant = await db.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true, name: true, legalHold: true, retentionDays: true },
  });

  if (!tenant) {
    throw new Error(`Tenant ${tenantId} not found`);
  }

  const retentionDays = tenant.retentionDays || 365;
  const retentionCutoff = new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000);
  const reportExpiryCutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 days default artifact lifecycle

  let purgedReports = 0;
  let purgedTokens = 0;
  let purgedSoftDeletedRisks = 0;
  let purgedNotifications = 0;

  // 1. Expired Report Artifacts (Purged regardless of legal hold if expired/token consumed past artifact retention)
  const expiredExports = await db.exportHistory.findMany({
    where: {
      tenantId,
      OR: [
        { downloadExpires: { lt: now } },
        { createdAt: { lt: reportExpiryCutoff } },
      ],
      artifactBase64: { not: null },
    },
    select: { id: true, storageKey: true },
  });

  purgedReports = expiredExports.length;

  if (!dryRun) {
    for (const item of expiredExports) {
      if (item.storageKey) {
        await reportStorage.deleteReport(item.storageKey, tenantId).catch(() => false);
      }
    }

    if (expiredExports.length > 0) {
      await db.exportHistory.updateMany({
        where: { id: { in: expiredExports.map((e) => e.id) } },
        data: { artifactBase64: null, storageKey: null },
      });
    }
  }

  // 2. Expired Verification and Preview Tokens
  const expiredTokens = await db.verificationToken.count({
    where: { expires: { lt: now } },
  });
  purgedTokens = expiredTokens;

  if (!dryRun && expiredTokens > 0) {
    await db.verificationToken.deleteMany({
      where: { expires: { lt: now } },
    });
  }

  // 3. Soft-deleted risks (Strictly respected by legal hold)
  if (tenant.legalHold) {
    logger.info(`Retention cleanup: skipping soft-deleted risks for tenant ${tenant.name} (Legal Hold active)`, {
      tenantId,
      action: "RETENTION_CLEANUP_LEGAL_HOLD",
    });
  } else {
    const deletedRisks = await db.risk.findMany({
      where: {
        tenantId,
        deletedAt: { not: null, lt: retentionCutoff },
      },
      select: { id: true },
    });

    purgedSoftDeletedRisks = deletedRisks.length;

    if (!dryRun && deletedRisks.length > 0) {
      // Hard delete soft-deleted risks older than retention window
      await db.risk.deleteMany({
        where: { id: { in: deletedRisks.map((r) => r.id) } },
      });
    }
  }

  // 4. Record Metrics & Audit
  if (!dryRun) {
    if (purgedReports > 0) recordRetentionPurge("ReportArtifact", purgedReports);
    if (purgedTokens > 0) recordRetentionPurge("VerificationToken", purgedTokens);
    if (purgedSoftDeletedRisks > 0) recordRetentionPurge("Risk", purgedSoftDeletedRisks);

    await db.auditEvent.create({
      data: {
        tenantId,
        actorId: options.actorId ?? "system",
        action: "DELETE",
        entityType: "RetentionCleanup",
        entityId: tenantId,
        summary: tenant.legalHold
          ? `Executed retention cleanup (Legal Hold active): purged ${purgedReports} expired report artifacts and ${purgedTokens} expired tokens; soft-deleted records preserved.`
          : `Executed retention cleanup: purged ${purgedReports} report artifacts, ${purgedTokens} expired tokens, and ${purgedSoftDeletedRisks} soft-deleted risks older than ${retentionDays} days.`,
      },
    }).catch(() => undefined);
  }

  const message = dryRun
    ? `Dry run: ${purgedReports} report artifacts, ${purgedTokens} tokens, and ${purgedSoftDeletedRisks} soft-deleted records eligible for purge (Legal Hold: ${tenant.legalHold ? "ACTIVE" : "OFF"}).`
    : `Retention cleanup complete (Legal Hold: ${tenant.legalHold ? "ACTIVE" : "OFF"}).`;

  return {
    tenantId,
    legalHold: tenant.legalHold,
    dryRun,
    purgedReports,
    purgedTokens,
    purgedSoftDeletedRisks,
    purgedNotifications,
    message,
  };
}

export async function runGlobalRetentionCleanup(
  db: PrismaClient,
  options: { dryRun?: boolean; actorId?: string } = {}
) {
  const tenants = await db.tenant.findMany({ select: { id: true } });
  const results: RetentionCleanupResult[] = [];

  for (const t of tenants) {
    const res = await runTenantRetentionCleanup(db, t.id, options);
    results.push(res);
  }

  return results;
}
