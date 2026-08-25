import type { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { riskSchema } from "@/lib/validations";
import { activeSession, writeRoles } from "@/lib/authz";
import { linkComplianceToRisk } from "@/lib/compliance";
import { nextRiskReference } from "@/lib/risk-reference";

export async function GET(request: Request) {
  const session = await activeSession(); if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const search = new URL(request.url).searchParams.get("q") ?? "";
  const risks = await db.risk.findMany({ where: { tenantId: session.user.tenantId, deletedAt: null, OR: search ? [{ title: { contains: search } }, { reference: { contains: search } }] : undefined }, include: { owner: { select: { id: true, name: true } } }, orderBy: { updatedAt: "desc" } });
  return NextResponse.json(risks);
}

export async function POST(request: Request) {
  const session = await activeSession(); if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); if (!writeRoles.includes(session.user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const parsed = riskSchema.safeParse(await request.json()); if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 }); const data = parsed.data;
  const risk = await db.$transaction(async (tx: Prisma.TransactionClient) => { const owner = await tx.user.findFirst({ where: { id: data.ownerId, tenantId: session.user.tenantId } }); if (!owner) throw new Error("Invalid owner"); const reference = await nextRiskReference(tx, session.user.tenantId); const created = await tx.risk.create({ data: { ...data, tenantId: session.user.tenantId, reference, inherentScore: data.inherentLikelihood * data.inherentImpact, residualScore: data.residualLikelihood && data.residualImpact ? data.residualLikelihood * data.residualImpact : null } }); await tx.auditEvent.create({ data: { tenantId: session.user.tenantId, riskId: created.id, actorId: session.user.id, action: "CREATE", entityId: created.id, summary: `Created ${created.reference}` } }); return created; });
  await linkComplianceToRisk(risk);
  return NextResponse.json(risk, { status: 201 });
}