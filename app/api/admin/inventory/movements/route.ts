import { NextResponse } from "next/server";
import { authorize, canAccessBranch } from "@/lib/auth";
import { serialize } from "@/lib/format";
import { loadMovementHistory } from "@/lib/inventory";

/**
 * @summary Historial de movimientos con filtros grandes.
 * Filtros: sucursal, producto, tipo, rango de fechas y texto libre sobre
 * motivo/referencia. Devuelve movimientos paginados y el total coincidente.
 */
export async function GET(request: Request) {
  const auth = await authorize("product.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const url = new URL(request.url);

  const branchId = Number(url.searchParams.get("branchId") ?? 0);
  if (branchId > 0 && !canAccessBranch(auth, branchId)) {
    return NextResponse.json({ error: "No tenés acceso a esa sucursal" }, { status: 403 });
  }
  const productId = Number(url.searchParams.get("productId") ?? 0);
  const from = url.searchParams.get("from") ? new Date(url.searchParams.get("from") as string) : undefined;
  const to = url.searchParams.get("to") ? new Date(url.searchParams.get("to") as string) : undefined;
  if (from && Number.isNaN(from.getTime())) {
    return NextResponse.json({ error: "Fecha inicial inválida" }, { status: 400 });
  }
  if (to && Number.isNaN(to.getTime())) {
    return NextResponse.json({ error: "Fecha final inválida" }, { status: 400 });
  }

  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit") ?? 50)));
  const offset = Math.max(0, Number(url.searchParams.get("offset") ?? 0));

  const result = await loadMovementHistory({
    tenantId: auth.tenant.id,
    branchId: branchId > 0 ? branchId : undefined,
    productId: productId > 0 ? productId : undefined,
    type: url.searchParams.get("type") || undefined,
    from,
    to,
    search: url.searchParams.get("search") || undefined,
    limit,
    offset,
  });
  return NextResponse.json({ movements: serialize(result.movements), total: result.total });
}
