import test from "node:test";
import assert from "node:assert/strict";
import { evaluateLimit, safeEqual } from "@/lib/rate-limit";
import { validateEnv } from "@/lib/env";

const baseEnv: NodeJS.ProcessEnv = { DATABASE_URL: "file:./dev.db", AUTH_SECRET: "a".repeat(40), AUTH_URL: "http://localhost:3000", EMAIL_PROVIDER: "preview", NODE_ENV: "development" };

test("development environment accepts the local SQLite configuration", () => {
  assert.equal(validateEnv(baseEnv).DATABASE_URL, "file:./dev.db");
});

test("production environment fails closed for incomplete configuration", () => {
  assert.throws(() => validateEnv({ ...baseEnv, NODE_ENV: "production" }), /PostgreSQL/);
  assert.doesNotThrow(() => validateEnv({ DATABASE_URL: "postgresql://db", AUTH_SECRET: "a".repeat(40), AUTH_URL: "https://app.example.com", NODE_ENV: "production", EMAIL_PROVIDER: "resend", RESEND_API_KEY: "re_123", EMAIL_FROM: "GRC <no-reply@example.com>", NOTIFICATION_CRON_SECRET: "b".repeat(40), RATE_LIMIT_SECRET: "c".repeat(40), NEXT_PUBLIC_TURNSTILE_SITE_KEY: "0x4AAAAAAA-test-site", TURNSTILE_SECRET_KEY: "0x4AAAAAAA-test-secret" }));
});

test("secret comparison is timing-safe and length-sensitive", () => {
  assert.equal(safeEqual("secret", "secret"), true);
  assert.equal(safeEqual("secret", "different"), false);
});

test("rate limit policy blocks the request after the configured budget", () => {
  assert.equal(evaluateLimit(10, "login", 20).allowed, true);
  assert.equal(evaluateLimit(11, "login", 20).allowed, false);
  assert.equal(evaluateLimit(11, "login", 20).remaining, 0);
});