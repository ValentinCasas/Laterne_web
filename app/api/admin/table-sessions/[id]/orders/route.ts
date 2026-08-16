import { NextResponse } from "next/server";
import { z } from "zod";
import { recordAudit, toAuditValue } from "@/lib/audit";
import { authorize } from "@/lib/auth";
import { serialize } from "@/lib/format";
import { addTableOrder, TableServiceError } from "@/lib/table-sessions";

/** @summary Valida los ítems de un consumo de mesa. */
const orderInput = z.object({
  items: z
    .array(
      z.object({
        productId: z.coerce.number().int().positive(),
        quantity: z.coerce.number().int().min(1).max(30),
        variantId: z.coerce.number().int().positive().optional().nullable(),
        extraIds: z.array(z.coerce.number().int().positive()).max(20).default([]),
        notes: z.string().trim().max(500).optional(),
      }),
    )
    .min(1)
    .max(80),
});

/** @summary Agrega una comanda a la mesa abierta con precios y stock validados en el servidor. */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await authorize("order.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const id = Number((await context.params).id);
  const parsed = orderInput.safeParse(await request.json().catch(() => null));
  if (!Number.isInteger(id) || !parsed.success) {
    return NextResponse.json({ error: "Revisá los productos del consumo" }, { status: 400 });
  }
  try {
    const result = await addTableOrder(auth, id, parsed.data.items);
    await recordAudit({
      context: auth,
      action: "table.order.create",
      entityType: "customer-order",
      entityId: result.order.id,
      newValues: toAuditValue(serialize(result.order)),
      request,
    });
    return NextResponse.json(
      { order: serialize(result.order), reference: result.reference, total: result.total },
      { status: 201 },
    );
  } catch (reason) {
    if (reason instanceof TableServiceError) {
      return NextResponse.json({ error: reason.message }, { status: reason.status });
    }
    throw reason;
  }
}
