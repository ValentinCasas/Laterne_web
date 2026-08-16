import { NextResponse } from "next/server";
import { z } from "zod";
import { recordAudit, toAuditValue } from "@/lib/audit";
import { authorize, canAccessBranch } from "@/lib/auth";
import { serialize } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { printDestinationTypes } from "@/lib/print-provider";

const destinationInput = z.object({
  branchId: z.coerce.number().int().positive(),
  name: z.string().trim().min(1).max(120),
  type: z.enum(printDestinationTypes).default("ETHERNET"),
  connection: z.string().trim().max(2000).optional(),
  areaId: z.coerce.number().int().positive().nullable().optional(),
});

/** @summary Registra un destino de impresión (solo configuración, sin conectar nada). */
export async function POST(request: Request) {
  const auth = await authorize("order.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const parsed = destinationInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !canAccessBranch(auth, parsed.data.branchId)) {
    return NextResponse.json({ error: "Revisá los datos de la impresora" }, { status: 400 });
  }
  const areaId: number | null = parsed.data.areaId ?? null;
  if (areaId !== null) {
    const area = await prisma.printArea.findFirst({
      where: { id: areaId, tenantId: auth.tenant.id, branchId: parsed.data.branchId },
      select: { id: true },
    });
    if (!area) return NextResponse.json({ error: "El área elegida no existe en esta sucursal" }, { status: 400 });
  }
  const destination = await prisma.printDestination.create({
    data: {
      tenantId: auth.tenant.id,
      branchId: parsed.data.branchId,
      areaId,
      name: parsed.data.name.trim(),
      type: parsed.data.type,
      connection: parsed.data.connection?.trim() || null,
      // Estado inicial declarativo: aún no hay conexión real que probar.
      status: "unknown",
    },
  });
  await recordAudit({
    context: auth,
    action: "print-destination.create",
    entityType: "print-destination",
    entityId: destination.id,
    newValues: toAuditValue(serialize(destination)),
    request,
  });
  return NextResponse.json({ destination: serialize(destination) }, { status: 201 });
}
