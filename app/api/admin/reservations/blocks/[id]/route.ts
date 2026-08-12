import { NextResponse } from "next/server";
import { recordAudit, toAuditValue } from "@/lib/audit";
import { authorize } from "@/lib/auth";
import { serialize } from "@/lib/format";
import { prisma } from "@/lib/prisma";

/** @summary Elimina un bloqueo después de verificar que pertenezca al negocio activo. */
export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await authorize("reservation.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const id = Number((await context.params).id);
  const block = await prisma.reservationBlock.findFirst({ where: { id, tenantId: auth.tenant.id } });
  if (!block) return NextResponse.json({ error: "Bloqueo no encontrado" }, { status: 404 });
  if (block.branchId && !auth.branches.some((branch) => branch.id === block.branchId)) {
    return NextResponse.json({ error: "No tenés acceso a la sucursal de este bloqueo" }, { status: 403 });
  }
  await prisma.reservationBlock.delete({ where: { id } });
  await recordAudit({
    context: auth,
    action: "delete",
    entityType: "reservation-block",
    entityId: id,
    oldValues: toAuditValue(serialize(block)),
    request,
  });
  return new NextResponse(null, { status: 204 });
}
