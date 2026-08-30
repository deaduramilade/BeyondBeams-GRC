"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/authz";
import { db } from "@/lib/db";
import { runTenantRetentionCleanup } from "@/lib/retention";

export async function triggerRetentionCleanupAction(dryRun = false) {
  const session = await requirePermission("settings:manage");
  const result = await runTenantRetentionCleanup(db, session.user.tenantId, {
    dryRun,
    actorId: session.user.id,
  });

  revalidatePath("/app/settings");
  revalidatePath("/app/operations/jobs");

  return { success: true, result };
}

export async function toggleLegalHoldAction(legalHold: boolean) {
  const session = await requirePermission("settings:manage");
  const tenant = await db.tenant.update({
    where: { id: session.user.tenantId },
    data: { legalHold },
  });

  await db.auditEvent.create({
    data: {
      tenantId: session.user.tenantId,
      actorId: session.user.id,
      action: "UPDATE",
      entityType: "TenantLegalHold",
      entityId: tenant.id,
      summary: legalHold ? "Enabled Legal Hold for organisation" : "Disabled Legal Hold for organisation",
    },
  }).catch(() => undefined);

  revalidatePath("/app/settings");
  return { success: true, legalHold: tenant.legalHold };
}
