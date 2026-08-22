import { NextResponse } from "next/server";
import { z } from "zod";
import { recordAudit, toAuditValue } from "@/lib/audit";
import { authorize, canAccessBranch } from "@/lib/auth";
import { serialize } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import {
  loadPurchaseOrder,
  setPurchaseOrderStatus,
  updatePurchaseOrder,
} from "@/lib/purchases";

const orderLineInput = z.object({
  orderItemId: z.coerce.number().int().positive().optional(),
  productId: z.coerce.number().int().positive(),
  quantity: z.coerce.number().positive(),
  unit: z.string().trim().max(40).default("unidad"),
  unitCost: z.coerce.number().min(0),
  discountPercent: z.coerce.number().min(0).max(100).optional().default(0),
  taxPercent: z.coerce.number().min(0).max(100).optional().default(0),
  quantityToReceive: z.coerce.number().min(0).optional(),
  quantityToInvoice: z.coerce.number().min(0).optional(),
});

/** @summary Detalle completo de un pedido (con recepciones, facturas e historial). */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorize("purchase.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const { id } = await params;
  try {
    const order = await loadPurchaseOrder(
      auth.tenant.id,
      Number(id),
      auth.branches.map((branch) => branch.id),
    );
    return NextResponse.json(serialize(order));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo cargar el pedido" },
      { status: 404 },
    );
  }
}

/** @summary Edita un pedido en Borrador (reemplaza líneas). */
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorize("purchase.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const { id } = await params;
  const parsed = z
    .object({
      supplierId: z.coerce.number().int().positive().optional(),
      branchId: z.coerce.number().int().positive().optional(),
      orderDate: z.string().optional(),
      postingDate: z.string().optional(),
      expectedDate: z.string().nullable().optional(),
      externalReference: z.string().trim().max(120).optional(),
      notes: z.string().trim().max(2000).optional(),
      lines: z.array(orderLineInput).min(1).optional(),
    })
    .safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Revisá los datos del pedido" }, { status: 400 });
  if (parsed.data.branchId && !canAccessBranch(auth, parsed.data.branchId)) {
    return NextResponse.json({ error: "No tenés acceso a esa sucursal" }, { status: 403 });
  }
  const visibleOrder = await prisma.purchaseOrder.findFirst({
    where: {
      id: Number(id),
      tenantId: auth.tenant.id,
      branchId: { in: auth.branches.map((branch) => branch.id) },
    },
    select: { id: true },
  });
  if (!visibleOrder) return NextResponse.json({ error: "El pedido no existe" }, { status: 404 });

  try {
    const order = await updatePurchaseOrder(auth.tenant.id, Number(id), {
      ...parsed.data,
      postingDate: parsed.data.postingDate,
      lines: parsed.data.lines?.map((line) => ({
        ...line,
        unit: line.unit || "unidad",
        quantityToReceive: line.quantityToReceive,
        quantityToInvoice: line.quantityToInvoice,
      })),
    });
    await recordAudit({
      context: auth,
      action: "update",
      entityType: "purchase-order",
      entityId: order.id,
      newValues: toAuditValue(serialize(order)),
      request,
    });
    return NextResponse.json({ item: serialize(order) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo actualizar el pedido" },
      { status: error instanceof Error && "status" in error ? (error as { status?: number }).status ?? 400 : 400 },
    );
  }
}

/** @summary Cambia el estado de un pedido (enviar, cerrar, cancelar). */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorize("purchase.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const { id } = await params;
  const parsed = z.object({ status: z.string().min(1).max(24) }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Indicá el estado" }, { status: 400 });
  const visibleOrder = await prisma.purchaseOrder.findFirst({
    where: {
      id: Number(id),
      tenantId: auth.tenant.id,
      branchId: { in: auth.branches.map((branch) => branch.id) },
    },
    select: { id: true },
  });
  if (!visibleOrder) return NextResponse.json({ error: "El pedido no existe" }, { status: 404 });

  try {
    const order = await setPurchaseOrderStatus(auth.tenant.id, Number(id), parsed.data.status);
    await recordAudit({
      context: auth,
      action: "status",
      entityType: "purchase-order",
      entityId: order.id,
      newValues: { status: parsed.data.status },
      request,
    });
    return NextResponse.json({ item: serialize(order) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo cambiar el estado" },
      { status: error instanceof Error && "status" in error ? (error as { status?: number }).status ?? 400 : 400 },
    );
  }
}

/** @summary Elimina un pedido solo si está en Borrador y sin recepciones. */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorize("purchase.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const { id } = await params;
  const visibleOrder = await prisma.purchaseOrder.findFirst({
    where: {
      id: Number(id),
      tenantId: auth.tenant.id,
      branchId: { in: auth.branches.map((branch) => branch.id) },
    },
    select: { id: true },
  });
  if (!visibleOrder) return NextResponse.json({ error: "El pedido no existe" }, { status: 404 });
  try {
    const result = await prisma.$transaction(async (transaction) => {
      const order = await transaction.purchaseOrder.findFirst({
        where: { id: Number(id), tenantId: auth.tenant.id },
        include: { receipts: { select: { id: true } } },
      });
      if (!order) throw new Error("El pedido no existe");
      if (order.status !== "draft") throw new Error("Solo se eliminan pedidos en Borrador");
      if (order.receipts.length) throw new Error("No se puede eliminar un pedido con recepciones");
      return transaction.purchaseOrder.delete({ where: { id: order.id } });
    });
    await recordAudit({
      context: auth,
      action: "delete",
      entityType: "purchase-order",
      entityId: result.id,
      request,
    });
    return NextResponse.json({ deleted: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo eliminar el pedido" },
      { status: 409 },
    );
  }
}
