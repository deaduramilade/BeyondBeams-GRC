import { execFileSync } from "node:child_process";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { loadDotEnv, seedMagicLinkToken } from "./db";

export default async function globalSetup() {
  loadDotEnv();
  process.env.SEED_DEMO_PASSWORD = process.env.SEED_DEMO_PASSWORD ?? "PlaywrightDemo123!";
  execFileSync(process.execPath, [path.join(process.cwd(), "node_modules", "prisma", "build", "index.js"), "db", "push", "--schema", "prisma/schema.prisma"], { stdio: "inherit" });
  execFileSync(process.execPath, [path.join(process.cwd(), "node_modules", "tsx", "dist", "cli.mjs"), "prisma/seed.ts"], { stdio: "inherit" });
  const client = new PrismaClient();
  await client.user.updateMany({
    where: { email: "owner@beyondbeams.com" },
    data: { mfaEnabled: false, mfaSecret: null, mfaConfirmedAt: null, securityOnboardingCompletedAt: new Date() },
  });
  await client.rateLimitBucket.deleteMany({});
  await client.$disconnect();
  await seedMagicLinkToken();
  const base = (process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  try {
    // Warm the NextAuth route so the first test does not wait on a cold dev compile.
    await fetch(`${base}/api/auth/csrf`, { cache: "no-store" });
  } catch {
    // Best-effort warm-up; the server may not be ready yet in some environments.
  }
}