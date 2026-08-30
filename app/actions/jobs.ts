"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/authz";
import { db } from "@/lib/db";
import { retryJob } from "@/lib/jobs";

export async function retryJobAction(jobId: string) {
  const session = await requirePermission("settings:manage");
  const retried = await retryJob(db, jobId, session.user.tenantId);
  if (!retried) return { error: "Job could not be retried or was not found." };

  await db.auditEvent.create({
    data: {
      tenantId: session.user.tenantId,
      actorId: session.user.id,
      action: "UPDATE",
      entityType: "Job",
      entityId: jobId,
      summary: `Manually retried job ${jobId} (${retried.type})`,
    },
  });

  revalidatePath("/app/operations/jobs");
  return { success: true };
}
