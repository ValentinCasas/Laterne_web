import { NextResponse } from "next/server";
import { z } from "zod";
import { recordAudit, toAuditValue } from "@/lib/audit";
import { authorize, canAccessBranch } from "@/lib/auth";
import { reserveStock } from "@/lib/inventory";
import { serialize } from "@/lib/format";

/**
 * @summary Reserva o libera stock de una sucursal.
 * La reserva compromete unidades (disponible = físico − reservado) sin tocar el
 * físico; genera movimientos `reserve` / `release` con `reservedAfter`.
 */
const reserveInput = z.object({
  action: z.enum(["reserve", "release"]),
  branchId: z.coerce.number().int().positive(),
  productId: z.coerce.number().int().positive(),
  quantity: z.coerce.number().positive().max(1_000_000),
  reason: z.string().trim().min(3).max(300),
});

export async function POST(request: Request) {
  const auth = await authorize("product.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const parsed = reserveInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Revisá los datos de la reserva" }, { status: 400 });
  if (!canAccessBranch(auth, parsed.data.branchId)) {
    return NextResponse.json({ error: "No tenés acceso a esa sucursal" }, { status: 403 });
  }

  try {
    const result = await reserveStock(auth.tenant.id, parsed.data.branchId, {
      productId: parsed.data.productId,
      quantity: parsed.data.quantity,
      reason: parsed.data.reason,
      action: parsed.data.action,
      userId: auth.session.userId,
    });
    await recordAudit({
      context: auth,
      action: `inventory.${parsed.data.action}`,
      entityType: "inventory",
      entityId: parsed.data.productId,
      newValues: toAuditValue({ ...parsed.data, result }),
      request,
    });
    return NextResponse.json({ result: serialize(result) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo completar la reserva" },
      { status: 400 },
    );
  }
}
