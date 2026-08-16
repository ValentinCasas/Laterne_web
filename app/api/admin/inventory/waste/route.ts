import { NextResponse } from "next/server";
import { z } from "zod";
import { recordAudit, toAuditValue } from "@/lib/audit";
import { authorize, canAccessBranch } from "@/lib/auth";
import { registerWaste } from "@/lib/inventory";
import { serialize } from "@/lib/format";

/**
 * @summary Registra una merma/desperdicio con motivo y costo estimado.
 * Genera un movimiento `waste` con cantidad negativa y snapshot de costo.
 */
const wasteInput = z.object({
  branchId: z.coerce.number().int().positive(),
  productId: z.coerce.number().int().positive(),
  quantity: z.coerce.number().positive().max(1_000_000),
  unit: z.string().trim().max(40).optional(),
  reason: z.string().trim().min(3).max(300),
});

export async function POST(request: Request) {
  const auth = await authorize("product.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const parsed = wasteInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Revisá los datos de la merma" }, { status: 400 });
  if (!canAccessBranch(auth, parsed.data.branchId)) {
    return NextResponse.json({ error: "No tenés acceso a esa sucursal" }, { status: 403 });
  }

  try {
    const result = await registerWaste(auth.tenant.id, parsed.data.branchId, {
      productId: parsed.data.productId,
      quantity: parsed.data.quantity,
      unit: parsed.data.unit,
      reason: parsed.data.reason,
    });
    await recordAudit({
      context: auth,
      action: "inventory.waste",
      entityType: "inventory",
      entityId: result.stockId,
      newValues: toAuditValue({ ...parsed.data, result }),
      request,
    });
    return NextResponse.json({ result: serialize(result) }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo registrar la merma" },
      { status: 400 },
    );
  }
}
