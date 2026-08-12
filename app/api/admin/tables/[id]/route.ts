import { NextResponse } from "next/server";
import { z } from "zod";
import { recordAudit, toAuditValue } from "@/lib/audit";
import { authorize } from "@/lib/auth";
import { serialize } from "@/lib/format";
import { prisma } from "@/lib/prisma";

const tableUpdate = z.object({
  name: z.string().trim().min(1).max(100),
  sector: z.string().trim().max(100).optional(),
  capacity: z.coerce.number().int().min(1).max(100),
  active: z.boolean(),
  branchId: z.coerce.number().int().positive(),
});

/** @summary Modifica los datos operativos de una mesa sin cambiar el QR ya distribuido. */
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await authorize("table.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const id = Number((await context.params).id);
  const parsed = tableUpdate.safeParse(await request.json().catch(() => null));
  if (!Number.isInteger(id) || !parsed.success)
    return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
  const current = await prisma.diningTable.findFirst({ where: { id, tenantId: auth.tenant.id } });
  if (!current) return NextResponse.json({ error: "Mesa no encontrada" }, { status: 404 });
  const branch = await prisma.branch.findFirst({
    where: { id: parsed.data.branchId, tenantId: auth.tenant.id },
  });
  if (!branch) return NextResponse.json({ error: "Seleccioná una sucursal válida" }, { status: 400 });
  if (!auth.branches.some((item) => item.id === branch.id && item.active && item.status === "active")) return NextResponse.json({ error: "No tenés acceso a esa sucursal" }, { status: 403 });
  if (current.branchId !== parsed.data.branchId && !(auth.allBranches && current.branchId)) return NextResponse.json({ error: "No podés mover una mesa de otra sucursal" }, { status: 403 });
  const updated = await prisma.diningTable.update({
    where: { id },
    data: { ...parsed.data, sector: parsed.data.sector || null },
  });
  await recordAudit({
    context: auth,
    action: "update",
    entityType: "dining-table",
    entityId: id,
    oldValues: toAuditValue(serialize(current)),
    newValues: toAuditValue(serialize(updated)),
    request,
  });
  return NextResponse.json({ table: serialize(updated) });
}

/** @summary Elimina una mesa conservando los pedidos históricos mediante una relación opcional. */
export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await authorize("table.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const id = Number((await context.params).id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "Identificador inválido" }, { status: 400 });
  const current = await prisma.diningTable.findFirst({ where: { id, tenantId: auth.tenant.id, ...(auth.activeBranchId && auth.activeBranchId > 0 ? { branchId: auth.activeBranchId } : {}) } });
  if (!current) return NextResponse.json({ error: "Mesa no encontrada" }, { status: 404 });
  await prisma.diningTable.delete({ where: { id } });
  await recordAudit({
    context: auth,
    action: "delete",
    entityType: "dining-table",
    entityId: id,
    oldValues: toAuditValue(serialize(current)),
    request,
  });
  return NextResponse.json({ ok: true });
}
