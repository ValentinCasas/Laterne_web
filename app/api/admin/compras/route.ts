import { NextResponse } from "next/server";
import { z } from "zod";
import { recordAudit, toAuditValue } from "@/lib/audit";
import { authorize, canAccessBranch } from "@/lib/auth";
import { serialize } from "@/lib/format";
import {
  createPurchaseOrder,
  listPurchaseOrders,
} from "@/lib/purchases";

const orderLineInput = z.object({
  productId: z.coerce.number().int().positive(),
  quantity: z.coerce.number().positive(),
  unit: z.string().trim().max(40).default("unidad"),
  unitCost: z.coerce.number().min(0),
  discountPercent: z.coerce.number().min(0).max(100).optional().default(0),
  taxPercent: z.coerce.number().min(0).max(100).optional().default(0),
});

const orderInput = z.object({
  supplierId: z.coerce.number().int().positive(),
  branchId: z.coerce.number().int().positive(),
  orderDate: z.string().optional(),
  expectedDate: z.string().nullable().optional(),
  externalReference: z.string().trim().max(120).optional(),
  notes: z.string().trim().max(2000).optional(),
  lines: z.array(orderLineInput).min(1),
});

/** @summary Lista pedidos de compra con filtros de operación. */
export async function GET(request: Request) {
  const auth = await authorize("purchase.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const url = new URL(request.url);
  const result = await listPurchaseOrders(auth.tenant.id, {
    branchId: url.searchParams.get("branchId") ? Number(url.searchParams.get("branchId")) : null,
    supplierId: url.searchParams.get("supplierId") ? Number(url.searchParams.get("supplierId")) : null,
    status: url.searchParams.get("status") || undefined,
    query: url.searchParams.get("q") || undefined,
    from: url.searchParams.get("from") || undefined,
    to: url.searchParams.get("to") || undefined,
    limit: Number(url.searchParams.get("limit") ?? 60),
    offset: Number(url.searchParams.get("offset") ?? 0),
  });
  return NextResponse.json(serialize(result));
}

/** @summary Crea un pedido de compra (no modifica inventario). */
export async function POST(request: Request) {
  const auth = await authorize("purchase.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const parsed = orderInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Revisá los datos del pedido" }, { status: 400 });
  if (!canAccessBranch(auth, parsed.data.branchId)) {
    return NextResponse.json({ error: "No tenés acceso a esa sucursal" }, { status: 403 });
  }

  try {
    const order = await createPurchaseOrder(
      auth.tenant.id,
      parsed.data.branchId,
      auth.session.userId,
      {
        supplierId: parsed.data.supplierId,
        orderDate: parsed.data.orderDate,
        expectedDate: parsed.data.expectedDate,
        externalReference: parsed.data.externalReference,
        notes: parsed.data.notes,
        lines: parsed.data.lines.map((line) => ({ ...line, unit: line.unit || "unidad" })),
      },
    );
    await recordAudit({
      context: auth,
      action: "create",
      entityType: "purchase-order",
      entityId: order.id,
      newValues: toAuditValue(serialize(order)),
      request,
    });
    return NextResponse.json({ item: serialize(order) }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo crear el pedido" },
      { status: error instanceof Error && "status" in error ? (error as { status?: number }).status ?? 400 : 400 },
    );
  }
}
