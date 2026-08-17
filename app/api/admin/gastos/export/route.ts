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
      "content-disposition": `attachment; filename="gastos-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}

/** @summary Exporta gastos aplicando los filtros actuales del listado. */
export async function GET(request: Request) {
  const auth = await authorize("purchase.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const url = new URL(request.url);
  const branchId = url.searchParams.get("branchId") ? Number(url.searchParams.get("branchId")) : null;
  const supplierId = url.searchParams.get("supplierId") ? Number(url.searchParams.get("supplierId")) : null;
  const categoryId = url.searchParams.get("categoryId") ? Number(url.searchParams.get("categoryId")) : null;
  const status = url.searchParams.get("status") || undefined;
  const query = url.searchParams.get("q") || undefined;
  const from = url.searchParams.get("from") || undefined;
  const to = url.searchParams.get("to") || undefined;

  const expenses = await prisma.expense.findMany({
    where: {
      tenantId: auth.tenant.id,
      status: { not: "cancelled" },
      ...(branchId ? { branchId } : {}),
      ...(supplierId ? { supplierId } : {}),
      ...(categoryId ? { categoryId } : {}),
      ...(status ? { status } : {}),
      ...(from ? { expenseDate: { gte: new Date(from) } } : {}),
      ...(to ? { expenseDate: { lte: new Date(to) } } : {}),
      ...(query ? { OR: [{ number: { contains: query } }, { notes: { contains: query } }] } : {}),
    },
    include: { category: { select: { name: true } }, supplier: { select: { name: true } } },
    orderBy: { expenseDate: "desc" },
    take: 2000,
  });

  const rows: unknown[][] = [
    ["Número", "Fecha", "Vencimiento", "Categoría", "Proveedor", "Neto", "Impuestos", "Total", "Pagado", "Saldo", "Medio", "Estado"],
    ...expenses.map((expense) => [
      expense.number,
      expense.expenseDate.toISOString(),
      expense.dueDate?.toISOString() ?? "",
      expense.category.name,
      expense.supplier?.name ?? "",
      expense.amountNet,
      expense.taxAmount,
      expense.total,
      expense.paidAmount,
      Number(expense.total) - Number(expense.paidAmount),
      expense.paymentMethod ?? "",
      expense.status,
    ]),
  ];
  return csvResponse(rows);
}
