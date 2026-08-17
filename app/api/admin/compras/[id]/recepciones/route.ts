import { NextResponse } from "next/server";
import { z } from "zod";
import { recordAudit, toAuditValue } from "@/lib/audit";
import { authorize } from "@/lib/auth";
import { serialize } from "@/lib/format";
import { receivePurchaseOrder } from "@/lib/purchases";

const receiptLineInput = z.object({
  orderItemId: z.coerce.number().int().positive(),
  quantity: z.coerce.number().positive(),
  unit: z.string().trim().max(40).default("unidad"),
  unitCost: z.coerce.number().min(0).optional(),
});

const receiptInput = z.object({
  notes: z.string().trim().max(2000).optional(),
  receivedAt: z.string().optional(),
  items: z.array(receiptLineInput).min(1),
});

/** @summary Confirma una recepción física: consume pendiente y aumenta stock de la sucursal. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorize("purchase.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const { id } = await params;
  const parsed = receiptInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Revisá las cantidades a recibir" }, { status: 400 });

  const branchId = auth.activeBranchId && auth.activeBranchId > 0 ? auth.activeBranchId : null;
  if (!branchId) {
    return NextResponse.json(
      { error: "Seleccioná una sucursal para recibir mercadería" },
      { status: 400 },
    );
  }

  try {
    const result = await receivePurchaseOrder(auth.tenant.id, branchId, auth.session.userId, {
      orderId: Number(id),
      notes: parsed.data.notes,
      receivedAt: parsed.data.receivedAt,
      items: parsed.data.items.map((line) => ({
        orderItemId: line.orderItemId,
        quantity: line.quantity,
        unit: line.unit || "unidad",
        unitCost: line.unitCost ?? 0,
      })),
    });
    await recordAudit({
      context: auth,
      action: "receive",
      entityType: "purchase-receipt",
      entityId: result.receipt.id,
      newValues: toAuditValue(serialize(result.receipt)),
      request,
    });
    return NextResponse.json({ item: serialize(result.receipt) }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo registrar la recepción" },
      { status: error instanceof Error && "status" in error ? (error as { status?: number }).status ?? 400 : 400 },
    );
  }
}
