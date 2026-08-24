import { createHmac, timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";

export type RateLimitResult = { allowed: boolean; limit: number; remaining: number; retryAfterSeconds: number };
export const RATE_LIMITS = {
  login: { limit: 10, windowSeconds: 15 * 60 },
  registration: { limit: 5, windowSeconds: 60 * 60 },
  magicLink: { limit: 5, windowSeconds: 15 * 60 },
  invitation: { limit: 20, windowSeconds: 60 * 60 },
  cron: { limit: 2, windowSeconds: 60 },
  report: { limit: 10, windowSeconds: 60 * 60 },
} as const;

function digest(value: string) {
  const secret = process.env.RATE_LIMIT_SECRET ?? process.env.AUTH_SECRET ?? "development-rate-limit-secret";
  return createHmac("sha256", secret).update(value).digest("hex");
}

export function clientAddress(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
}

export function safeEqual(left: string, right: string) {
  const a = Buffer.from(left); const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function evaluateLimit(count: number, scope: keyof typeof RATE_LIMITS, retryAfterSeconds: number): RateLimitResult {
  const limit = RATE_LIMITS[scope].limit;
  return { allowed: count <= limit, limit, remaining: Math.max(0, limit - count), retryAfterSeconds: Math.max(1, retryAfterSeconds) };
}

export async function enforceRateLimit(scope: keyof typeof RATE_LIMITS, identity: string): Promise<RateLimitResult> {
  const policy = RATE_LIMITS[scope];
  const now = new Date();
  const windowStart = new Date(Math.floor(now.getTime() / (policy.windowSeconds * 1000)) * policy.windowSeconds * 1000);
  const key = `${scope}:${digest(identity)}:${windowStart.toISOString()}`;
  const current = await db.rateLimitBucket.upsert({ where: { key }, update: { count: { increment: 1 } }, create: { key, count: 1, windowStart, expiresAt: new Date(windowStart.getTime() + policy.windowSeconds * 1000) } });
  return evaluateLimit(current.count, scope, Math.ceil((windowStart.getTime() + policy.windowSeconds * 1000 - now.getTime()) / 1000));
}

export function rateLimitResponse(result: RateLimitResult) {
  return { status: 429, headers: { "Retry-After": String(result.retryAfterSeconds), "X-RateLimit-Limit": String(result.limit), "X-RateLimit-Remaining": String(result.remaining) } };
}