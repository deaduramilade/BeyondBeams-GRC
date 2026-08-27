import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export type StoredEvidence = { storageKey: string; sizeBytes: number; checksum: string };

export interface EvidenceStorage {
  put(tenantId: string, fileName: string, content: Buffer): Promise<StoredEvidence>;
  get(tenantId: string, storageKey: string): Promise<Buffer>;
}

function safeSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
}

export class LocalEvidenceStorage implements EvidenceStorage {
  constructor(private readonly root = path.join(process.cwd(), ".local-evidence")) {}

  async put(tenantId: string, fileName: string, content: Buffer) {
    if (process.env.NODE_ENV === "production") throw new Error("Local evidence storage is disabled in production.");
    const directory = path.join(this.root, safeSegment(tenantId));
    await mkdir(directory, { recursive: true });
    const storageKey = `${randomUUID()}-${safeSegment(fileName)}`;
    await writeFile(path.join(directory, storageKey), content, { flag: "wx" });
    return { storageKey, sizeBytes: content.byteLength, checksum: createHash("sha256").update(content).digest("hex") };
  }

  async get(tenantId: string, storageKey: string) {
    if (process.env.NODE_ENV === "production") throw new Error("Local evidence storage is disabled in production.");
    return readFile(path.join(this.root, safeSegment(tenantId), safeSegment(storageKey)));
  }
}

export const evidenceStorage: EvidenceStorage = new LocalEvidenceStorage();