import { createHash, randomBytes } from "node:crypto";

export function createToken() { return randomBytes(32).toString("base64url"); }
export function hashToken(token: string) { return createHash("sha256").update(token).digest("hex"); }
export function appUrl() { return (process.env.AUTH_URL ?? "http://localhost:3000").replace(/\/$/, ""); }

export function deliverLink(kind: "invitation" | "magic link" | "password reset", email: string, url: string) {
  // Never log authentication or invitation URLs. Local development can inspect
  // the returned preview link through the email preview flow instead.
  if (process.env.NODE_ENV !== "production") console.info(`[BeyondBeams ${kind}] delivery prepared for ${email}`);
}