import { NextResponse } from "next/server";
import { z } from "zod";
import { recordAudit, toAuditValue } from "@/lib/audit";
import { authorize, canAccessBranch } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const inventoryInput = z.object({
  branchId: z.coerce.number().int().positive(),
  productId: z.coerce.number().int().positive(),
  tracked: z.boolean(),
  current: z.coerce.number().min(0).max(100_000_000),
  minimum: z.coerce.number().min(0).max(100_000_000),
  unit: z.string().trim().min(1).max(40),
  reason: z.string().trim().min(3).max(300),
});

/** @summary Actualiza una existencia por sucursal y registra un movimiento trazable por la diferencia. */
export async function POST(request: Request) {
  const auth = await authorize("product.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const parsed = inventoryInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Revisá los datos de inventario" }, { status: 400 });
  if (!canAccessBranch(auth, parsed.data.branchId)) {
    return NextResponse.json({ error: "No tenés acceso a esa sucursal" }, { status: 403 });
  }

  const [branch, product, previous] = await Promise.all([
    prisma.branch.findFirst({ where: { id: parsed.data.branchId, tenantId: auth.tenant.id } }),
    prisma.product.findFirst({ where: { id: parsed.data.productId, tenantId: auth.tenant.id } }),
    prisma.inventoryStock.findUnique({
      where: {
        branchId_productId: {
          branchId: parsed.data.branchId,
          productId: parsed.data.productId,
        },
      },
    }),
  ]);
  if (!branch || !product)
    return NextResponse.json({ error: "Sucursal o producto inválido" }, { status: 404 });

  const difference = parsed.data.current - Number(previous?.current ?? 0);
  const stock = await prisma.$transaction(async (transaction) => {
    const saved = await transaction.inventoryStock.upsert({
      where: {
        branchId_productId: {
          branchId: branch.id,
          productId: product.id,
        },
      },
      create: {
        tenantId: auth.tenant.id,
        branchId: branch.id,
        productId: product.id,
        tracked: parsed.data.tracked,
        current: parsed.data.current,
        minimum: parsed.data.minimum,
        unit: parsed.data.unit,
      },
      update: {
        tracked: parsed.data.tracked,
        current: parsed.data.current,
        minimum: parsed.data.minimum,
        unit: parsed.data.unit,
      },
    });
    if (difference !== 0) {
      await transaction.stockMovement.create({
        data: {
          tenantId: auth.tenant.id,
          stockId: saved.id,
          userId: auth.session.userId,
          type: difference > 0 ? "manual_in" : "manual_out",
          quantity: difference,
          balanceAfter: parsed.data.current,
          reason: parsed.data.reason,
        },
      });
    }
    if (parsed.data.tracked && parsed.data.current <= parsed.data.minimum) {
      await transaction.notification.create({
        data: {
          tenantId: auth.tenant.id,
          type: "stock.low",
          title: `Stock bajo · ${product.name}`,
          message: `${branch.name}: ${parsed.data.current} ${parsed.data.unit}.`,
          link: "/admin/inventario",
        },
      });
    }
    return saved;
  });

  await recordAudit({
    context: auth,
    action: "inventory.update",
    entityType: "inventory",
    entityId: stock.id,
    oldValues: toAuditValue(previous),
    newValues: toAuditValue(stock),
    request,
  });
  return NextResponse.json({ stock });
}
