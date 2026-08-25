import type { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { activeSession, deleteRoles, writeRoles } from "@/lib/authz";
import { riskSchema } from "@/lib/validations";
import { linkComplianceToRisk } from "@/lib/compliance";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await activeSession(); if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); const { id } = await params;
  const risk = await db.risk.findFirst({ where: { id, tenantId: session.user.tenantId, deletedAt: null }, include: { owner: { select: { id: true, name: true } }, complianceLinks: { include: { reference: true } }, auditEvents: { include: { actor: { select: { name: true } } }, orderBy: { createdAt: "desc" } } } });
  return risk ? NextResponse.json(risk) : NextResponse.json({ error: "Not found" }, { status: 404 });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await activeSession(); if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); if (!writeRoles.includes(session.user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 }); const { id } = await params;
  const current = await db.risk.findFirst({ where: { id, tenantId: session.user.tenantId, deletedAt: null } }); if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = await request.json(); const parsed = riskSchema.safeParse(body); if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 }); const data = parsed.data; const expectedVersion = Number(body.version);
  if (!Number.isInteger(expectedVersion) || expectedVersion < 1) return NextResponse.json({ error: "A current risk version is required." }, { status: 400 });
  const owner = await db.user.findFirst({ where: { id: data.ownerId, tenantId: session.user.tenantId } }); if (!owner) return NextResponse.json({ error: "Invalid owner" }, { status: 400 });
  const updated = await db.$transaction(async (tx: Prisma.TransactionClient) => { const result = await tx.risk.updateMany({ where: { id, tenantId: session.user.tenantId, version: expectedVersion, deletedAt: null }, data: { ...data, version: { increment: 1 }, inherentScore: data.inherentLikelihood * data.inherentImpact, residualScore: data.residualLikelihood && data.residualImpact ? data.residualLikelihood * data.residualImpact : null } }); if (result.count !== 1) return 0; await tx.auditEvent.create({ data: { tenantId: session.user.tenantId, riskId: id, actorId: session.user.id, action: "UPDATE", entityId: id, summary: `Updated ${current.reference}`, changes: JSON.stringify({ version: expectedVersion, nextVersion: expectedVersion + 1 }) } }); return 1; });
  if (updated !== 1) return NextResponse.json({ error: "Conflict: this risk was changed by another user. Reload before saving." }, { status: 409 });
  const risk = await db.risk.findUniqueOrThrow({ where: { id } });
  await linkComplianceToRisk(risk); return NextResponse.json(risk);
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await activeSession(); if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); if (!deleteRoles.includes(session.user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 }); const { id } = await params;
  const risk = await db.risk.findFirst({ where: { id, tenantId: session.user.tenantId, deletedAt: null } }); if (!risk) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await db.risk.update({ where: { id }, data: { deletedAt: new Date() } }); await db.auditEvent.create({ data: { tenantId: session.user.tenantId, riskId: id, actorId: session.user.id, action: "DELETE", entityId: id, summary: `Deleted ${risk.reference}` } }); return new NextResponse(null, { status: 204 });
}