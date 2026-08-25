type SequenceTransaction = { tenantSequence: { upsert(args: unknown): Promise<{ value: number }> } };
export async function nextRiskReference(tx: SequenceTransaction, tenantId: string) {
  const sequence = await tx.tenantSequence.upsert({
    where: { tenantId_name: { tenantId, name: "risk" } },
    create: { tenantId, name: "risk", value: 1 },
    update: { value: { increment: 1 } },
  });
  return `RSK-${String(sequence.value).padStart(4, "0")}`;
}