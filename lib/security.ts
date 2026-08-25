import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, randomInt } from "node:crypto";

export type Permission =
  | "risk:create" | "risk:update" | "risk:delete" | "risk:read"
  | "framework:manage" | "mapping:manage" | "member:manage"
  | "audit:read" | "report:export" | "settings:manage";

const permissions: Record<string, Permission[]> = {
  OWNER: ["risk:create", "risk:update", "risk:delete", "risk:read", "framework:manage", "mapping:manage", "member:manage", "audit:read", "report:export", "settings:manage"],
  RISK_MANAGER: ["risk:create", "risk:update", "risk:delete", "risk:read", "framework:manage", "mapping:manage", "audit:read", "report:export"],
  ASSESSOR: ["risk:create", "risk:update", "risk:read", "mapping:manage"],
  VIEWER: ["risk:read"],
  AUDITOR: ["risk:read", "audit:read", "report:export"],
};

export function hasPermission(role: string, permission: Permission) {
  return permissions[role]?.includes(permission) ?? false;
}

export function permissionMatrix() {
  return Object.fromEntries(Object.entries(permissions).map(([role, values]) => [role, [...values]]));
}

export function createTotpSecret() {
  const bytes = Buffer.from(Array.from({ length: 20 }, () => randomInt(0, 256))); const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"; let bits = 0; let value = 0; let output = "";
  for (const byte of bytes) { value = (value << 8) | byte; bits += 8; while (bits >= 5) { output += alphabet[(value >>> (bits - 5)) & 31]; bits -= 5; } } if (bits) output += alphabet[(value << (5 - bits)) & 31]; return output;
}

function hotp(secret: string, counter: number) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"; let bits = 0; let value = 0; const decoded: number[] = [];
  for (const character of secret.toUpperCase().replace(/=+$/, "")) { const index = alphabet.indexOf(character); if (index < 0) return ""; value = (value << 5) | index; bits += 5; if (bits >= 8) { decoded.push((value >>> (bits - 8)) & 255); bits -= 8; } }
  const key = Buffer.from(decoded);
  const data = Buffer.alloc(8);
  data.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac("sha1", key).update(data).digest();
  const offset = digest[digest.length - 1] & 15;
  return ((digest.readUInt32BE(offset) & 0x7fffffff) % 1_000_000).toString().padStart(6, "0");
}

export function createTotpCode(secret: string, timestamp = Date.now()) {
  return hotp(secret, Math.floor(timestamp / 30_000));
}

export function verifyTotpCode(secret: string, code: string, timestamp = Date.now()) {
  return [-1, 0, 1].some((offset) => hotp(secret, Math.floor(timestamp / 30_000) + offset) === code);
}

export function totpUri(secret: string, email: string, issuer = "BeyondBeams GRC") {
  return `otpauth://totp/${encodeURIComponent(`${issuer}:${email}`)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}

function encryptionKey() {
  const source = process.env.AUTH_SECRET;
  if (!source || source.length < 32) throw new Error("AUTH_SECRET must be at least 32 characters.");
  return createHash("sha256").update(source).digest();
}

export function encryptSecret(value: string) {
  const iv = randomBytes(12); const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return `${iv.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}.${encrypted.toString("base64url")}`;
}

export function decryptSecret(value: string) {
  const [iv, tag, encrypted] = value.split(".");
  if (!iv || !tag || !encrypted) throw new Error("Invalid encrypted secret.");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(encrypted, "base64url")), decipher.final()]).toString("utf8");
}