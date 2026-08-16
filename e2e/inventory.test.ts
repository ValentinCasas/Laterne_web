/**
 * Prueba end-to-end del módulo de inventario contra la base real de desarrollo.
 * Ejecuta merma, reserva/liberación, transferencia entre sucursales y un conteo
 * físico a través de los servicios reales, y restaura el estado original al
 * terminar. Se excluye del suite por defecto (directorio `e2e/`); correr con:
 *   npx vitest run e2e/inventory.test.ts
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  completeCountSession,
  createCountSession,
  createStockTransfer,
  registerWaste,
  reserveStock,
  updateCountSessionItems,
} from "@/lib/inventory";

describe("inventario end-to-end (DB real)", () => {
  let tenantId = -1;
  let origin: { id: number; branchId: number; productId: number; unit: string };
  let dest: { id: number; branchId: number } | null = null;
  let productName = "";
  let before = new Date();
  const createdTransfers: number[] = [];
  const createdCountSessions: number[] = [];
  const snapshots = new Map<number, { current: unknown; reserved: unknown }>();
  let skipped = false;

  beforeAll(async () => {
    const tenant = await prisma.tenant.findFirst({ where: { status: "active" } });
    const stock = tenant
      ? await prisma.inventoryStock.findFirst({
          where: { tenantId: tenant.id, tracked: true },
          include: { product: { select: { name: true } } },
        })
      : null;
    if (!tenant || !stock) {
      skipped = true;
      return;
    }
    tenantId = tenant.id;
    origin = {
      id: stock.id,
      branchId: stock.branchId,
      productId: stock.productId,
      unit: stock.unit,
    };
    productName = stock.product.name;
    const otherBranch = await prisma.branch.findFirst({
      where: { tenantId: tenant.id, id: { not: stock.branchId } },
    });
    if (otherBranch) {
      dest = await prisma.inventoryStock.upsert({
        where: { branchId_productId: { branchId: otherBranch.id, productId: stock.productId } },
        create: {
          tenantId: tenant.id,
          branchId: otherBranch.id,
          productId: stock.productId,
          tracked: true,
          current: 0,
          minimum: 0,
          unit: stock.unit,
        },
        update: {},
      });
      dest = { id: dest.id, branchId: otherBranch.id };
    }
    snapshots.set(origin.id, { current: stock.current, reserved: stock.reserved });
    if (dest) {
      const destRow = await prisma.inventoryStock.findUnique({ where: { id: dest.id } });
      snapshots.set(dest.id, { current: destRow!.current, reserved: destRow!.reserved });
    }
    before = new Date();
  });

  afterAll(async () => {
    if (skipped) return;
    const movementIds = (
      await prisma.stockMovement.findMany({
        where: { createdAt: { gte: before }, stockId: { in: [origin.id, ...(dest ? [dest.id] : [])] } },
        select: { id: true },
      })
    ).map((row) => row.id);
    if (movementIds.length) await prisma.stockMovement.deleteMany({ where: { id: { in: movementIds } } });
    if (createdTransfers.length) await prisma.stockTransfer.deleteMany({ where: { id: { in: createdTransfers } } });
    if (createdCountSessions.length) {
      await prisma.inventoryCountSession.deleteMany({ where: { id: { in: createdCountSessions } } });
    }
    await prisma.notification.deleteMany({
      where: { type: "stock.low", createdAt: { gte: before }, title: { contains: productName } },
    });
    for (const [stockId, snapshot] of snapshots) {
      await prisma.inventoryStock.update({
        where: { id: stockId },
        data: { current: snapshot.current as never, reserved: Number(snapshot.reserved) },
      });
    }
    if (dest) {
      const destRow = await prisma.inventoryStock.findUnique({ where: { id: dest.id } });
      if (destRow && Number(destRow.current) === 0 && Number(destRow.reserved) === 0) {
        await prisma.inventoryStock.delete({ where: { id: dest.id } });
      }
    }
  });

  it("registra una merma con snapshot de costo y descuenta stock", async () => {
    if (skipped) return;
    const quantity = Math.max(0.001, Math.min(0.05, Number(snapshots.get(origin.id)!.current) * 0.05));
    const result = await registerWaste(tenantId, origin.branchId, {
      productId: origin.productId,
      quantity,
      reason: "Verificación e2e (se restaura)",
    });
    expect(String(result.movement.quantity)).toBe(`-${quantity}`);
    expect(result.movement.reference).toMatch(/^MER-/);
    const after = await prisma.inventoryStock.findUnique({ where: { id: origin.id } });
    expect(Number(after!.current)).toBeLessThan(Number(snapshots.get(origin.id)!.current));
  });

  it("reserva y libera stock sin tocar el físico", async () => {
    if (skipped) return;
    await reserveStock(tenantId, origin.branchId, {
      productId: origin.productId,
      quantity: 0.01,
      reason: "Verificación e2e (se libera)",
      action: "reserve",
    });
    let after = await prisma.inventoryStock.findUnique({ where: { id: origin.id } });
    expect(Number(after!.reserved)).toBeGreaterThan(Number(snapshots.get(origin.id)!.reserved));

    await reserveStock(tenantId, origin.branchId, {
      productId: origin.productId,
      quantity: 0.01,
      reason: "Verificación e2e",
      action: "release",
    });
    after = await prisma.inventoryStock.findUnique({ where: { id: origin.id } });
    expect(Number(after!.reserved)).toBe(Number(snapshots.get(origin.id)!.reserved));
  });

  it("transfiere stock entre sucursales de forma atómica", async () => {
    if (skipped || !dest) return;
    const quantity = Math.max(0.001, Math.min(0.05, Number(snapshots.get(origin.id)!.current) * 0.1));
    const result = await createStockTransfer(tenantId, {
      fromBranchId: origin.branchId,
      toBranchId: dest.branchId,
      productId: origin.productId,
      quantity,
      note: "Verificación e2e (se restaura)",
    });
    createdTransfers.push(result.transfer.id);
    expect(result.transfer.status).toBe("completed");
    expect(String(result.transfer.reference)).toMatch(/^TRF-/);

    const originAfter = await prisma.inventoryStock.findUnique({ where: { id: origin.id } });
    const destAfter = await prisma.inventoryStock.findUnique({ where: { id: dest.id } });
    expect(Number(originAfter!.current)).toBeLessThan(Number(snapshots.get(origin.id)!.current));
    expect(Number(destAfter!.current)).toBeGreaterThan(Number(snapshots.get(dest.id)!.current));
    const linked = await prisma.stockMovement.findMany({ where: { transferId: result.transfer.id } });
    expect(linked.map((row) => row.type).sort()).toEqual(["transfer_in", "transfer_out"]);
  });

  it("abre un conteo, carga cantidades y aplica el ajuste", async () => {
    if (skipped) return;
    const session = await createCountSession(tenantId, origin.branchId, {
      note: "Verificación e2e (se restaura)",
    });
    createdCountSessions.push(session.id);
    expect(session.status).toBe("open");
    expect(String(session.reference)).toMatch(/^CNT-/);
    expect(session.items.length).toBeGreaterThan(0);

    const item = session.items.find((candidate) => candidate.productId === origin.productId);
    expect(item).toBeDefined();
    const system = Number(item!.systemQuantity);
    await updateCountSessionItems(tenantId, session.id, [
      { id: item!.id, countedQuantity: system + 0.02 },
    ]);

    const result = await completeCountSession(tenantId, session.id);
    expect(result.session.status).toBe("completed");
    expect(result.adjustments).toBeGreaterThanOrEqual(1);

    const adjustment = await prisma.stockMovement.findFirst({
      where: { reference: session.reference, type: "count_adjustment" },
    });
    expect(adjustment).not.toBeNull();
    expect(Number(adjustment!.quantity)).toBeCloseTo(0.02, 6);
  });
});
