import { NextResponse } from "next/server";
import { z } from "zod";
import { recordAudit, toAuditValue } from "@/lib/audit";
import { authorize, canAccessBranch } from "@/lib/auth";
import { serialize } from "@/lib/format";
import { prisma } from "@/lib/prisma";

/** @summary Adapta una estación de Prisma al formato plano que consume el monitor. */
function stationPayload(station: {
  id: number;
  name: string;
  type: string;
  active: boolean;
  sortOrder: number;
  branchId: number;
  _count: { products: number };
}) {
  return {
    id: station.id,
    name: station.name,
    type: station.type,
    active: station.active,
    sortOrder: station.sortOrder,
    branchId: station.branchId,
    productCount: station._count.products,
  };
}

const stationUpdate = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  type: z.string().trim().max(20).optional(),
  active: z.boolean().optional(),
  sortOrder: z.coerce.number().int().min(0).optional(),
});

/** @summary Actualiza una estación de cocina verificando pertenencia al tenant y acceso a la sucursal. */
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await authorize("order.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const id = Number((await context.params).id);
  const parsed = stationUpdate.safeParse(await request.json().catch(() => null));
  if (!Number.isInteger(id) || !parsed.success) {
    return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
  }
  const current = await prisma.kitchenStation.findFirst({
    where: { id, tenantId: auth.tenant.id },
    include: { _count: { select: { products: true } } },
  });
  if (!current) return NextResponse.json({ error: "Estación no encontrada" }, { status: 404 });
  if (!canAccessBranch(auth, current.branchId)) {
    return NextResponse.json({ error: "No tenés acceso a la sucursal de esta estación" }, { status: 403 });
  }
  const data: { name?: string; type?: string; active?: boolean; sortOrder?: number } = {};
  if (parsed.data.name !== undefined) data.name = parsed.data.name.trim();
  if (parsed.data.type !== undefined) data.type = parsed.data.type.trim();
  if (parsed.data.active !== undefined) data.active = parsed.data.active;
  if (parsed.data.sortOrder !== undefined) data.sortOrder = parsed.data.sortOrder;
  if (data.name && data.name !== current.name) {
    const collision = await prisma.kitchenStation.findFirst({
      where: { tenantId: auth.tenant.id, branchId: current.branchId, name: data.name, id: { not: id } },
    });
    if (collision) return NextResponse.json({ error: "Ya existe una estación con ese nombre" }, { status: 409 });
  }
  const station = await prisma.kitchenStation.update({
    where: { id },
    data,
    include: { _count: { select: { products: true } } },
  });
  await recordAudit({
    context: auth,
    action: "kitchen-station.update",
    entityType: "kitchen-station",
    entityId: id,
    oldValues: toAuditValue(serialize(current)),
    newValues: toAuditValue(serialize(station)),
    request,
  });
  return NextResponse.json({ station: stationPayload(station) });
}

/** @summary Elimina una estación; los productos asignados quedan sin estación (onDelete SetNull). */
export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await authorize("order.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const id = Number((await context.params).id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
  const current = await prisma.kitchenStation.findFirst({
    where: { id, tenantId: auth.tenant.id },
    include: { _count: { select: { products: true } } },
  });
  if (!current) return NextResponse.json({ error: "Estación no encontrada" }, { status: 404 });
  if (!canAccessBranch(auth, current.branchId)) {
    return NextResponse.json({ error: "No tenés acceso a la sucursal de esta estación" }, { status: 403 });
  }
  await prisma.kitchenStation.delete({ where: { id } });
  await recordAudit({
    context: auth,
    action: "kitchen-station.delete",
    entityType: "kitchen-station",
    entityId: id,
    oldValues: toAuditValue(serialize(current)),
    request,
  });
  return new NextResponse(null, { status: 204 });
}
