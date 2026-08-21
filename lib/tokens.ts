import { createHash, randomBytes } from "node:crypto";

export function createToken() { return randomBytes(32).toString("base64url"); }
export function hashToken(token: string) { return createHash("sha256").update(token).digest("hex"); }
export function appUrl() { return (process.env.AUTH_URL ?? "http://localhost:3000").replace(/\/$/, ""); }

export function deliverLink(kind: "invitation" | "magic link", email: string, url: string) {
  // Production deployments can replace this boundary with their transactional email provider.
  console.info(`[BeyondBeams ${kind}] ${email}: ${url}`);
}