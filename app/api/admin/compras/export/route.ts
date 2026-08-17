import { NextResponse } from "next/server";
import { authorize } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** @summary Escapa un valor para CSV (comas, comillas y saltos). */
function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);
  if (/[",\n\r]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

/** @summary Arma el archivo CSV con separador ; y codificación UTF-8. */
function csvResponse(rows: unknown[][]): NextResponse {
  const content = rows.map((row) => row.map(csvCell).join(";")).join("\r\n");
  return new NextResponse(`\uFEFF${content}`, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="compras-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}

/** @summary Exporta pedidos, recepciones o facturas según el filtro `type`. */
export async function GET(request: Request) {
  const auth = await authorize("purchase.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const url = new URL(request.url);
  const type = url.searchParams.get("type") ?? "orders";
  const branchId = url.searchParams.get("branchId") ? Number(url.searchParams.get("branchId")) : null;
  const supplierId = url.searchParams.get("supplierId") ? Number(url.searchParams.get("supplierId")) : null;
  const status = url.searchParams.get("status") || undefined;
  const query = url.searchParams.get("q") || undefined;
  const from = url.searchParams.get("from") || undefined;
  const to = url.searchParams.get("to") || undefined;

  if (type === "receipts") {
    const receipts = await prisma.purchaseReceipt.findMany({
      where: {
        tenantId: auth.tenant.id,
        ...(branchId ? { branchId } : {}),
        ...(supplierId ? { supplierId } : {}),
        ...(from ? { receivedAt: { gte: new Date(from) } } : {}),
        ...(to ? { receivedAt: { lte: new Date(to) } } : {}),
        ...(query
          ? {
              OR: [
                { number: { contains: query } },
                { order: { number: { contains: query } } },
                { supplier: { name: { contains: query } } },
              ],
            }
          : {}),
      },
      include: { supplier: { select: { name: true } }, branch: { select: { name: true } }, order: { select: { number: true } }, items: true },
      orderBy: { receivedAt: "desc" },
      take: 2000,
    });
    const rows: unknown[][] = [
      ["Número", "Fecha", "Pedido", "Proveedor", "Sucursal", "Producto", "Cantidad", "Unidad", "Costo unit."],
      ...receipts.flatMap((receipt) =>
        receipt.items.map((item) => [
          receipt.number,
          receipt.receivedAt.toISOString(),
          receipt.order?.number ?? "",
          receipt.supplier.name,
          receipt.branch.name,
          item.productId,
          item.quantity,
          item.unit,
          item.unitCost,
        ]),
      ),
    ];
    return csvResponse(rows);
  }

  if (type === "invoices") {
    const invoices = await prisma.purchaseInvoice.findMany({
      where: {
        tenantId: auth.tenant.id,
        ...(branchId ? { branchId } : {}),
        ...(supplierId ? { supplierId } : {}),
        ...(status ? { status } : {}),
        ...(from ? { documentDate: { gte: new Date(from) } } : {}),
        ...(to ? { documentDate: { lte: new Date(to) } } : {}),
        ...(query
          ? {
              OR: [
                { number: { contains: query } },
                { externalNumber: { contains: query } },
                { supplier: { name: { contains: query } } },
              ],
            }
          : {}),
      },
      include: { supplier: { select: { name: true } }, payments: { select: { amount: true } } },
      orderBy: { documentDate: "desc" },
      take: 2000,
    });
    const rows: unknown[][] = [
      ["Número", "Fecha", "Vencimiento", "Proveedor", "Comprobante", "Subtotal", "Impuestos", "Total", "Pagado", "Saldo", "Estado"],
      ...invoices.map((invoice) => [
        invoice.number,
        invoice.documentDate.toISOString(),
        invoice.dueDate?.toISOString() ?? "",
        invoice.supplier.name,
        invoice.externalNumber ?? "",
        invoice.subtotal,
        invoice.taxAmount,
        invoice.total,
        invoice.paidAmount,
        Number(invoice.total) - Number(invoice.paidAmount),
        invoice.status,
      ]),
    ];
    return csvResponse(rows);
  }

  // Pedidos por defecto.
  const orders = await prisma.purchaseOrder.findMany({
    where: {
      tenantId: auth.tenant.id,
      ...(branchId ? { branchId } : {}),
      ...(supplierId ? { supplierId } : {}),
      ...(status ? { status } : {}),
      ...(from ? { orderDate: { gte: new Date(from) } } : {}),
      ...(to ? { orderDate: { lte: new Date(to) } } : {}),
      ...(query
        ? {
            OR: [
              { number: { contains: query } },
              { externalReference: { contains: query } },
              { supplier: { name: { contains: query } } },
            ],
          }
        : {}),
    },
    include: { supplier: { select: { name: true } }, branch: { select: { name: true } }, items: true },
    orderBy: { createdAt: "desc" },
    take: 2000,
  });
  const rows: unknown[][] = [
    ["Número", "Fecha", "Esperada", "Proveedor", "Sucursal", "Producto", "Pedido", "Recibido", "Pendiente", "Unidad", "Costo esperado", "Estado"],
    ...orders.flatMap((order) =>
      order.items.map((item) => [
        order.number,
        order.orderDate.toISOString(),
        order.expectedDate?.toISOString() ?? "",
        order.supplier.name,
        order.branch.name,
        item.productId,
        item.quantity,
        item.receivedQuantity,
        Number(item.quantity) - Number(item.receivedQuantity),
        item.unit,
        item.unitCost,
        order.status,
      ]),
    ),
  ];
  return csvResponse(rows);
}
