import type { Job, JobStatus, JobType, Prisma, PrismaClient } from "@prisma/client";

export type JobDb = Pick<PrismaClient, "job">;

export type EnqueueJobInput = {
  tenantId: string;
  type: JobType;
  payload: unknown;
  runAfter?: Date;
  maxAttempts?: number;
};

export type JobHandler = (job: { id: string; type: JobType; tenantId: string; payload: unknown }) => Promise<unknown>;

export type RunDueJobsOptions = {
  tenantId?: string;
  workerId?: string;
  limit?: number;
  now?: Date;
};

export type ClaimableJob = Pick<
  Job,
  "id" | "tenantId" | "type" | "payloadJson" | "status" | "attempts" | "maxAttempts" | "runAfter"
>;

/**
 * Exponential backoff before a failed job is retried. Base doubling, capped at
 * one hour so a poisoned job cannot keep waking the queue every cycle.
 */
export function backoffDelayMs(attempt: number, baseMs = 1000, capMs = 60 * 60 * 1000) {
  const safeAttempt = Math.max(1, attempt);
  return Math.min(baseMs * 2 ** (safeAttempt - 1), capMs);
}

/** A QUEUED job becomes claimable once its run-after time has passed. */
export function isDue(job: Pick<ClaimableJob, "status" | "runAfter">, now = new Date()) {
  return job.status === "QUEUED" && job.runAfter.getTime() <= now.getTime();
}

/** Idempotent enqueue: identical live jobs are not duplicated. */
export async function enqueueJob(db: JobDb, input: EnqueueJobInput, fingerprint?: string) {
  const payloadJson = JSON.stringify(input.payload);
  if (fingerprint) {
    const existing = await db.job.findFirst({
      where: { tenantId: input.tenantId, type: input.type, status: { in: ["QUEUED", "PROCESSING"] }, payloadJson },
    });
    if (existing) return existing;
  }
  return db.job.create({
    data: {
      tenantId: input.tenantId,
      type: input.type,
      payloadJson,
      runAfter: input.runAfter ?? new Date(),
      maxAttempts: input.maxAttempts ?? 5,
    },
  });
}

export type ClaimResult = Array<ClaimableJob & { startedAt: Date; lockedBy: string }>;

/**
 * Claim a bounded set of due jobs atomically. Each claim is a compare-and-set
 * on QUEUED status so concurrent workers never process the same job twice.
 */
export async function claimJobs(
  db: JobDb,
  options: { tenantId?: string; limit?: number; now?: Date; workerId?: string } = {},
): Promise<ClaimResult> {
  const now = options.now ?? new Date();
  const workerId = options.workerId ?? `worker-${process.pid}`;
  const limit = options.limit ?? 10;
  const baseWhere: Prisma.JobWhereInput = { status: "QUEUED", runAfter: { lte: now } };
  const where = options.tenantId ? { ...baseWhere, tenantId: options.tenantId } : baseWhere;
  const candidates = await db.job.findMany({
    where,
    orderBy: [{ runAfter: "asc" }, { createdAt: "asc" }],
    take: limit,
    select: { id: true },
  });
  const claimed: ClaimResult = [];
  for (const candidate of candidates) {
    const result = await db.job.updateMany({
      where: { id: candidate.id, status: "QUEUED", runAfter: { lte: now } },
      data: { status: "PROCESSING", lockedAt: now, lockedBy: workerId, startedAt: now, attempts: { increment: 1 } },
    });
    if (result.count !== 1) continue;
    const row = await db.job.findFirst({
      where: { id: candidate.id },
      select: { id: true, tenantId: true, type: true, payloadJson: true, status: true, attempts: true, maxAttempts: true, runAfter: true },
    });
    if (!row) continue;
    claimed.push({ ...row, startedAt: now, lockedBy: workerId });
  }
  return claimed;
}

export async function completeJob(db: JobDb, id: string, result: unknown) {
  return db.job.update({
    where: { id },
    data: { status: "COMPLETED", resultJson: JSON.stringify(result), completedAt: new Date(), lockedAt: null, lockedBy: null, error: null },
  });
}

/**
 * Mark a job failed. Until maxAttempts is reached the job is requeued behind an
 * exponential backoff; afterwards it is terminal FAILED and needs operator review.
 */
export async function failJob(db: JobDb, id: string, error: string) {
  const job = await db.job.findUnique({ where: { id } });
  if (!job) return null;
  const terminal = job.attempts >= job.maxAttempts;
  return db.job.update({
    where: { id },
    data: terminal
      ? { status: "FAILED", error, completedAt: new Date(), lockedAt: null, lockedBy: null }
      : { status: "QUEUED", error, runAfter: new Date(Date.now() + backoffDelayMs(job.attempts)), lockedAt: null, lockedBy: null, startedAt: null },
  });
}

/**
 * Claim, run, and settle due jobs in one pass. Handlers must be idempotent:
 * failed handlers are retried with backoff rather than losing their work.
 */
export async function runDueJobs(db: JobDb, handler: JobHandler, options: RunDueJobsOptions = {}) {
  const jobs = await claimJobs(db, { tenantId: options.tenantId, limit: options.limit, now: options.now, workerId: options.workerId });
  const results = [];
  for (const job of jobs) {
    try {
      const payload = JSON.parse(job.payloadJson) as unknown;
      const result = await handler({ id: job.id, type: job.type, tenantId: job.tenantId, payload });
      await completeJob(db, job.id, result);
      results.push({ id: job.id, status: "COMPLETED", result });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await failJob(db, job.id, message);
      results.push({ id: job.id, status: "RETRY", error: message });
    }
  }
  return { processed: results.length, results };
}

/**
 * Administrator retry for failed or cancelled jobs.
 * Enforces tenant scoping and resets the job to QUEUED state for immediate processing.
 */
export async function retryJob(db: JobDb, id: string, tenantId: string) {
  const job = await db.job.findFirst({
    where: { id, tenantId, status: { in: ["FAILED", "CANCELLED", "PROCESSING"] } },
  });
  if (!job) return null;

  return db.job.update({
    where: { id: job.id },
    data: {
      status: "QUEUED",
      runAfter: new Date(),
      error: null,
      lockedAt: null,
      lockedBy: null,
      startedAt: null,
    },
  });
}