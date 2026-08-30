import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { E2E_EMAIL, E2E_MAGIC_TOKEN } from "./constants";

export function loadDotEnv() {
  try {
    for (const line of readFileSync(path.join(process.cwd(), ".env"), "utf8").split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
      if (match) process.env[match[1]] = match[2].replace(/^"(.*)"$/, "$1");
    }
  } catch {
    // .env is optional; the shell environment may already provide the values.
  }
}

export async function seedMagicLinkToken() {
  loadDotEnv();
  const client = new PrismaClient();
  try {
    const identifier = `magic:${E2E_EMAIL}`;
    await client.verificationToken.deleteMany({ where: { identifier } });
    await client.verificationToken.create({
      data: {
        identifier,
        token: createHash("sha256").update(E2E_MAGIC_TOKEN).digest("hex"),
        expires: new Date(Date.now() + 15 * 60 * 1000),
      },
    });
  } finally {
    await client.$disconnect();
  }
}