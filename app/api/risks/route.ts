import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { riskSchema } from "@/lib/validations";
import { writeRoles } from "@/lib/authz";

export async function GET(request: Request) {
  const session = await auth(); if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const search = new URL(request.url).searchParams.get("q") ?? "";
  const risks = await db.risk.findMany({ where: { tenantId: session.user.tenantId, deletedAt: null, OR: search ? [{ title: { contains: search } }, { reference: { contains: search } }] : undefined }, include: { owner: { select: { id: true, name: true } } }, orderBy: { updatedAt: "desc" } });
  return NextResponse.json(risks);
}
export async function POST(request: Request) {
  const session = await auth(); if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); if (!writeRoles.includes(session.user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const parsed = riskSchema.safeParse(await request.json()); if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 }); const data = parsed.data;
  const owner = await db.user.findFirst({ where: { id: data.ownerId, tenantId: session.user.tenantId } }); if (!owner) return NextResponse.json({ error: "Invalid owner" }, { status: 400 });
  const count = await db.risk.count({ where: { tenantId: session.user.tenantId } });
  const risk = await db.risk.create({ data: { ...data, tenantId: session.user.tenantId, reference: `RSK-${String(count + 1).padStart(4, "0")}`, inherentScore: data.inherentLikelihood * data.inherentImpact, residualScore: data.residualLikelihood && data.residualImpact ? data.residualLikelihood * data.residualImpact : null } });
  await db.auditEvent.create({ data: { tenantId: session.user.tenantId, riskId: risk.id, actorId: session.user.id, action: "CREATE", entityId: risk.id, summary: `Created ${risk.reference}` } });
  return NextResponse.json(risk, { status: 201 });
}