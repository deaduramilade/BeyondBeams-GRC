import assert from "node:assert/strict";
import test from "node:test";
import { MAX_EVIDENCE_BYTES, LocalEvidenceStorage } from "@/lib/evidence-storage";

test("local evidence keys are tenant-prefixed and checksummed", async () => {
  const storage = new LocalEvidenceStorage(`${process.cwd()}/.test-evidence`);
  const stored = await storage.put("tenant-a", "proof.txt", Buffer.from("proof"));
  assert.match(stored.storageKey, /^tenant-a\//);
  assert.equal((await storage.get("tenant-a", stored.storageKey, stored.checksum)).toString(), "proof");
  await assert.rejects(() => storage.get("tenant-b", stored.storageKey));
});

test("local evidence adapter enforces size and retention contracts", async () => {
  const storage = new LocalEvidenceStorage(`${process.cwd()}/.test-evidence-limits`);
  await assert.rejects(() => storage.put("tenant-a", "large.bin", Buffer.alloc(MAX_EVIDENCE_BYTES + 1)));
  await assert.rejects(() => storage.put("tenant-a", "bad.txt", Buffer.from("x"), { expiresAt: new Date("2026-02-02"), retentionUntil: new Date("2026-02-01") }));
});