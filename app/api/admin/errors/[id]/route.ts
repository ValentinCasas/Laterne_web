import { NextResponse } from "next/server";
import { authorize } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** @summary Marca un incidente técnico como resuelto sin permitir cambios entre tenants. */
export async function PATCH(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await authorize("audit.read");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const rawId = (await context.params).id;
  if (!/^\d+$/.test(rawId)) {
    return NextResponse.json({ error: "Identificador inválido" }, { status: 400 });
  }
  const id = BigInt(rawId);
  const current = await prisma.errorLog.findFirst({ where: { id, tenantId: auth.tenant.id } });
  if (!current) return NextResponse.json({ error: "Incidente no encontrado" }, { status: 404 });
  const error = await prisma.errorLog.update({ where: { id }, data: { resolvedAt: new Date() } });
  return NextResponse.json({ error: { ...error, id: error.id.toString() } });
}
