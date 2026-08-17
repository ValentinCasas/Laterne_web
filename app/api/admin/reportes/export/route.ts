import { authorize, canAccessBranch } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** @summary Protege celdas CSV que podrían interpretarse como fórmulas. */
function csvCell(value: string | number | null) {
  let text = value === null ? "" : String(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

/** @summary Exporta tablas de reportes a CSV según el tipo solicitado. */
export async function GET(request: Request) {
  const auth = await authorize("analytics.read");
  if (!auth) return new Response("No autorizado", { status: 403 });

  const url = new URL(request.url);
  const type = url.searchParams.get("type") || "ventas";
  const rawFrom = url.searchParams.get("from");
  const rawTo = url.searchParams.get("to");
  const requestedBranchId = url.searchParams.has("branchId") ? Number(url.searchParams.get("branchId")) : null;

  let branchId: number | null = null;
  if (requestedBranchId && requestedBranchId > 0) {
    if (!canAccessBranch(auth, requestedBranchId)) return new Response("No autorizado", { status: 403 });
    branchId = requestedBranchId;
  } else if (auth.allBranches && auth.activeBranchId === 0) {
    branchId = null;
  } else if (auth.activeBranchId && auth.activeBranchId > 0) {
    branchId = auth.activeBranchId;
  }

  const from = rawFrom ? new Date(rawFrom) : new Date();
  from.setUTCHours(0, 0, 0, 0);
  const to = rawTo ? new Date(rawTo) : new Date();
  to.setUTCHours(23, 59, 59, 999);

  let csv = "";

  if (type === "ventas") {
    const where = {
      tenantId: auth.tenant.id,
      status: { not: "cancelled" },
      createdAt: { gte: from, lte: to },
      ...(branchId ? { branchId } : {}),
    };

    const orders = await prisma.customerOrder.findMany({
      where,
      include: {
        tableSession: { select: { waiter: { select: { name: true } } } },
        deliveries: { select: { createdBy: { select: { name: true } } }, take: 1 },
      },
      orderBy: { createdAt: "desc" },
      take: 10_000,
    });

    csv = "referencia,fecha,estado,tipo,canal,origen,medio_pago,total,descuento,cliente,usuario\n";
    for (const order of orders) {
      const userName = order.tableSession?.waiter?.name || order.deliveries[0]?.createdBy?.name || "";
      csv += [
        order.reference,
        order.createdAt.toISOString(),
        order.status,
        order.orderType,
        order.channel,
        order.source,
        order.paymentMethod,
        Number(order.total),
        Number(order.discount),
        order.customerName,
        userName,
      ]
        .map(csvCell)
        .join(",") + "\n";
    }
  } else if (type === "compras") {
    const where = {
      tenantId: auth.tenant.id,
      receivedAt: { gte: from, lte: to },
      ...(branchId ? { branchId } : {}),
    };

    const items = await prisma.purchaseReceiptItem.findMany({
      where: { receipt: where },
      select: {
        quantity: true,
        unit: true,
        unitCost: true,
        receipt: {
          select: {
            receivedAt: true,
            number: true,
            branch: { select: { name: true } },
            supplier: { select: { name: true } },
          },
        },
        product: { select: { name: true } },
      },
      orderBy: { receipt: { receivedAt: "desc" } },
      take: 10_000,
    });

    csv = "fecha,proveedor,documento,producto,cantidad,unidad,costo_unitario,total,sucursal\n";
    for (const item of items) {
      csv += [
        item.receipt.receivedAt.toISOString().slice(0, 10),
        item.receipt.supplier.name,
        item.receipt.number,
        item.product.name,
        Number(item.quantity),
        item.unit,
        Number(item.unitCost),
        Number(item.quantity) * Number(item.unitCost),
        item.receipt.branch.name,
      ]
        .map(csvCell)
        .join(",") + "\n";
    }
  } else if (type === "sucursales") {
    const orders = await prisma.customerOrder.findMany({
      where: {
        tenantId: auth.tenant.id,
        status: { not: "cancelled" },
        createdAt: { gte: from, lte: to },
        ...(branchId ? { branchId } : {}),
      },
      select: {
        branch: { select: { name: true } },
        total: true,
        discount: true,
        channel: true,
      },
    });

    const grouped = new Map<string, { total: number; discount: number; count: number }>();
    for (const order of orders) {
      const name = order.branch?.name || "Sin sucursal";
      const current = grouped.get(name) || { total: 0, discount: 0, count: 0 };
      current.total += Number(order.total);
      current.discount += Number(order.discount);
      current.count += 1;
      grouped.set(name, current);
    }

    csv = "sucursal,ventas_netas,pedidos,ticket_promedio,descuentos\n";
    for (const [name, values] of grouped) {
      csv += [
        name,
        values.total - values.discount,
        values.count,
        values.count > 0 ? (values.total - values.discount) / values.count : 0,
        values.discount,
      ]
        .map(csvCell)
        .join(",") + "\n";
    }
  }

  const filename = `laterne-reportes-${type}-${from.toISOString().slice(0, 10)}-${to.toISOString().slice(0, 10)}.csv`;
  return new Response(`\uFEFF${csv}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
