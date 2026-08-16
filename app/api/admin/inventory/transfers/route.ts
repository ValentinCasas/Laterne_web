import { NextResponse } from "next/server";
import { z } from "zod";
import { recordAudit, toAuditValue } from "@/lib/audit";
import { authorize, canAccessBranch } from "@/lib/auth";
import { serialize } from "@/lib/format";
import { createStockTransfer, loadTransfers } from "@/lib/inventory";
import { prisma } from "@/lib/prisma";

/**
 * @summary Transferencias de stock entre sucursales.
 * POST crea una transferencia atómica (salida origen + entrada destino);
 * GET lista el historial reciente.
 */
const transferInput = z.object({
  fromBranchId: z.coerce.number().int().positive(),
  toBranchId: z.coerce.number().int().positive(),
  productId: z.coerce.number().int().positive(),
  quantity: z.coerce.number().positive().max(1_000_000),
  unit: z.string().trim().max(40).optional(),
  note: z.string().trim().max(300).optional(),
});

/** @summary Lista transferencias recientes del tenant (filtradas por sucursal si corresponde). */
export async function GET(request: Request) {
  const auth = await authorize("product.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const url = new URL(request.url);
  const branchId = Number(url.searchParams.get("branchId") ?? 0);
  const transfers = await loadTransfers(auth.tenant.id, branchId > 0 ? branchId : undefined);
  return NextResponse.json({ transfers: serialize(transfers) });
}

/** @summary Crea una transferencia con salida y entrada atómicas. */
export async function POST(request: Request) {
  const auth = await authorize("product.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const parsed = transferInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Revisá los datos de la transferencia" }, { status: 400 });
  if (!canAccessBranch(auth, parsed.data.fromBranchId) || !canAccessBranch(auth, parsed.data.toBranchId)) {
    return NextResponse.json({ error: "No tenés acceso a una de las sucursales" }, { status: 403 });
  }

  try {
    const result = await createStockTransfer(auth.tenant.id, {
      fromBranchId: parsed.data.fromBranchId,
      toBranchId: parsed.data.toBranchId,
      productId: parsed.data.productId,
      quantity: parsed.data.quantity,
      unit: parsed.data.unit,
      note: parsed.data.note,
      userId: auth.session.userId,
    });
    // Respuesta con relaciones para que la UI muestre producto y sucursales.
    const transfer = await prisma.stockTransfer.findUniqueOrThrow({
      where: { id: result.transfer.id },
      include: {
        fromBranch: { select: { name: true } },
        toBranch: { select: { name: true } },
        product: { select: { name: true } },
        createdBy: { select: { name: true } },
      },
    });
    await recordAudit({
      context: auth,
      action: "inventory.transfer",
      entityType: "transferencias",
      entityId: result.transfer.id,
      newValues: toAuditValue({ ...parsed.data, reference: result.transfer.reference }),
      request,
    });
    return NextResponse.json({ transfer: serialize(transfer) }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo crear la transferencia" },
      { status: 400 },
    );
  }
}
