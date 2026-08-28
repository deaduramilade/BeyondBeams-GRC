import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const MAX_EVIDENCE_BYTES = 25 * 1024 * 1024;
export type StoredEvidence = { storageKey: string; sizeBytes: number; checksum: string; expiresAt?: Date; retentionUntil?: Date };
export type EvidenceDownloadAudit = { tenantId: string; storageKey: string; actorId?: string; downloadedAt: Date };

export interface EvidenceStorage {
  put(tenantId: string, fileName: string, content: Buffer, metadata?: { expiresAt?: Date; retentionUntil?: Date }): Promise<StoredEvidence>;
  get(tenantId: string, storageKey: string, expectedChecksum?: string): Promise<Buffer>;
  auditDownload?(event: EvidenceDownloadAudit): Promise<void>;
}

function safeSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
}

export class LocalEvidenceStorage implements EvidenceStorage {
  constructor(private readonly root = path.join(process.cwd(), ".local-evidence")) {}

  async put(tenantId: string, fileName: string, content: Buffer, metadata: { expiresAt?: Date; retentionUntil?: Date } = {}) {
    if (process.env.NODE_ENV === "production") throw new Error("Local evidence storage is disabled in production.");
    if (!tenantId.trim()) throw new Error("Evidence tenant is required.");
    if (content.byteLength > MAX_EVIDENCE_BYTES) throw new Error(`Evidence exceeds the ${MAX_EVIDENCE_BYTES} byte limit.`);
    if (metadata.expiresAt && metadata.retentionUntil && metadata.expiresAt > metadata.retentionUntil) throw new Error("Evidence expiration cannot exceed retention.");
    const directory = path.join(this.root, safeSegment(tenantId));
    await mkdir(directory, { recursive: true });
    const storageKey = `${safeSegment(tenantId)}/${randomUUID()}-${safeSegment(fileName)}`;
    await writeFile(path.join(directory, storageKey.split("/").at(-1)!), content, { flag: "wx" });
    return { storageKey, sizeBytes: content.byteLength, checksum: createHash("sha256").update(content).digest("hex"), ...metadata };
  }

  async get(tenantId: string, storageKey: string, expectedChecksum?: string) {
    if (process.env.NODE_ENV === "production") throw new Error("Local evidence storage is disabled in production.");
    if (!storageKey.startsWith(`${safeSegment(tenantId)}/`)) throw new Error("Evidence storage key is not tenant scoped.");
    const content = await readFile(path.join(this.root, safeSegment(tenantId), safeSegment(storageKey.replace(`${safeSegment(tenantId)}/`, ""))));
    if (expectedChecksum && createHash("sha256").update(content).digest("hex") !== expectedChecksum) throw new Error("Evidence checksum verification failed.");
    return content;
  }

  async auditDownload(_event: EvidenceDownloadAudit) { return; }
}

export const evidenceStorage: EvidenceStorage = new LocalEvidenceStorage();