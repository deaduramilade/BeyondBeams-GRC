"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/authz";
import { createAnalyticsSnapshot } from "@/lib/analytics";

export async function triggerAnalyticsSnapshotAction(period = "DAILY") {
  const session = await requirePermission("risk:read");
  const snapshot = await createAnalyticsSnapshot(session.user.tenantId, period, session.user.id);
  revalidatePath("/app/insights");
  return { success: true, snapshotId: snapshot.id, asOfDate: snapshot.asOfDate.toISOString() };
}
