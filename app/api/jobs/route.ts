import { NextResponse } from "next/server";
import { activeSession, requirePermission } from "@/lib/authz";
import { db } from "@/lib/db";
import { runDueJobs } from "@/lib/jobs";
import type { JobStatus } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await activeSession(); if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const params = new URL(request.url).searchParams;
  if (params.get("run") === "1") {
    await requirePermission("settings:manage");
    const result = await runDueJobs(db, async () => ({ note: "Deferred; queue workers process these in a deployed environment." }), { limit: 10 });
    return NextResponse.json({ success: true, ...result });
  }
  const status = params.get("status") as JobStatus | null;
  const where = { tenantId: session.user.tenantId, ...(status ? { status } : {}) };
  const jobs = await db.job.findMany({ where, orderBy: { createdAt: "desc" }, take: 200 });
  return NextResponse.json({ jobs: jobs.map((job) => ({ id: job.id, type: job.type, status: job.status, attempts: job.attempts, maxAttempts: job.maxAttempts, error: job.error, runAfter: job.runAfter, createdAt: job.createdAt, completedAt: job.completedAt })) });
}