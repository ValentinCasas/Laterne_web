import { NextResponse } from "next/server";
import { z } from "zod";
import { recordAudit, toAuditValue } from "@/lib/audit";
import { authorize, canAccessBranch } from "@/lib/auth";
import { serialize } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { printDestinationTypes } from "@/lib/print-provider";

const destinationUpdate = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  type: z.enum(printDestinationTypes).optional(),
  connection: z.string().trim().max(2000).nullable().optional(),
  active: z.boolean().optional(),
  areaId: z.coerce.number().int().positive().nullable().optional(),
});

/** @summary Actualiza un destino de impresión verificando tenant y acceso a la sucursal. */
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await authorize("order.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const id = Number((await context.params).id);
  const parsed = destinationUpdate.safeParse(await request.json().catch(() => null));
  if (!Number.isInteger(id) || !parsed.success) {
    return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
  }
  const current = await prisma.printDestination.findFirst({
    where: { id, tenantId: auth.tenant.id },
  });
  if (!current) return NextResponse.json({ error: "Impresora no encontrada" }, { status: 404 });
  if (!canAccessBranch(auth, current.branchId)) {
    return NextResponse.json({ error: "No tenés acceso a la sucursal de esta impresora" }, { status: 403 });
  }
  const data: {
    name?: string;
    type?: string;
    connection?: string | null;
    active?: boolean;
    areaId?: number | null;
  } = {};
  if (parsed.data.name !== undefined) data.name = parsed.data.name.trim();
  if (parsed.data.type !== undefined) data.type = parsed.data.type;
  if (parsed.data.connection !== undefined) data.connection = parsed.data.connection?.trim() || null;
  if (parsed.data.active !== undefined) data.active = parsed.data.active;
  if (parsed.data.areaId !== undefined) data.areaId = parsed.data.areaId;
  if (data.areaId !== undefined && data.areaId !== null) {
    const area = await prisma.printArea.findFirst({
      where: { id: data.areaId, tenantId: auth.tenant.id, branchId: current.branchId },
      select: { id: true },
    });
    if (!area) return NextResponse.json({ error: "El área elegida no existe en esta sucursal" }, { status: 400 });
  }
  const destination = await prisma.printDestination.update({ where: { id }, data });
  await recordAudit({
    context: auth,
    action: "print-destination.update",
    entityType: "print-destination",
    entityId: id,
    oldValues: toAuditValue(serialize(current)),
    newValues: toAuditValue(serialize(destination)),
    request,
  });
  return NextResponse.json({ destination: serialize(destination) });
}

/** @summary Elimina un destino de impresión configurado. */
export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await authorize("order.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const id = Number((await context.params).id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
  const current = await prisma.printDestination.findFirst({
    where: { id, tenantId: auth.tenant.id },
  });
  if (!current) return NextResponse.json({ error: "Impresora no encontrada" }, { status: 404 });
  if (!canAccessBranch(auth, current.branchId)) {
    return NextResponse.json({ error: "No tenés acceso a la sucursal de esta impresora" }, { status: 403 });
  }
  await prisma.printDestination.delete({ where: { id } });
  await recordAudit({
    context: auth,
    action: "print-destination.delete",
    entityType: "print-destination",
    entityId: id,
    oldValues: toAuditValue(serialize(current)),
    request,
  });
  return new NextResponse(null, { status: 204 });
}
