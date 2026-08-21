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
  const parsed = riskSchema.safeParse(await request.json()); if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 }); const data = parsed.data;
  const owner = await db.user.findFirst({ where: { id: data.ownerId, tenantId: session.user.tenantId } }); if (!owner) return NextResponse.json({ error: "Invalid owner" }, { status: 400 });
  const risk = await db.risk.update({ where: { id }, data: { ...data, inherentScore: data.inherentLikelihood * data.inherentImpact, residualScore: data.residualLikelihood && data.residualImpact ? data.residualLikelihood * data.residualImpact : null } });
  await linkComplianceToRisk(risk); await db.auditEvent.create({ data: { tenantId: session.user.tenantId, riskId: id, actorId: session.user.id, action: "UPDATE", entityId: id, summary: `Updated ${risk.reference}` } }); return NextResponse.json(risk);
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await activeSession(); if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); if (!deleteRoles.includes(session.user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 }); const { id } = await params;
  const risk = await db.risk.findFirst({ where: { id, tenantId: session.user.tenantId, deletedAt: null } }); if (!risk) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await db.risk.update({ where: { id }, data: { deletedAt: new Date() } }); await db.auditEvent.create({ data: { tenantId: session.user.tenantId, riskId: id, actorId: session.user.id, action: "DELETE", entityId: id, summary: `Deleted ${risk.reference}` } }); return new NextResponse(null, { status: 204 });
}