import { NextResponse } from "next/server";
import { z } from "zod";
import { recordAudit } from "@/lib/audit";
import { authorize } from "@/lib/auth";
import { TableServiceError, transferOrders } from "@/lib/table-sessions";

const transferInput = z.object({
  orderIds: z.array(z.coerce.number().int().positive()).min(1).max(60),
  targetSessionId: z.coerce.number().int().positive(),
});

/** @summary Mueve comandas seleccionadas a otra mesa abierta de la misma sucursal con auditoría. */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await authorize("table.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const id = Number((await context.params).id);
  const parsed = transferInput.safeParse(await request.json().catch(() => null));
  if (!Number.isInteger(id) || !parsed.success) {
    return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
  }
  try {
    const result = await transferOrders(auth, id, parsed.data.orderIds, parsed.data.targetSessionId);
    await recordAudit({
      context: auth,
      action: "table.orders.transfer",
      entityType: "table-session",
      entityId: id,
      newValues: { ...parsed.data, moved: result.moved },
      request,
    });
    return NextResponse.json(result);
  } catch (reason) {
    if (reason instanceof TableServiceError) {
      return NextResponse.json({ error: reason.message }, { status: reason.status });
    }
    throw reason;
  }
}
