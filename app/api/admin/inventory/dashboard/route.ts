import { NextResponse } from "next/server";
import { authorize, canAccessBranch } from "@/lib/auth";
import { serialize } from "@/lib/format";
import { loadInventoryDashboard } from "@/lib/inventory";
import { prisma } from "@/lib/prisma";

/**
 * @summary Dashboard de inventario: valorizado, stock bajo, sin stock,
 * mermas del período y movimientos recientes.
 */
export async function GET(request: Request) {
  const auth = await authorize("product.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const url = new URL(request.url);
  const branchId = Number(url.searchParams.get("branchId") ?? 0);
  if (branchId > 0 && !canAccessBranch(auth, branchId)) {
    return NextResponse.json({ error: "No tenés acceso a esa sucursal" }, { status: 403 });
  }

  const conversions = await prisma.unitConversion.findMany({
    where: { tenantId: auth.tenant.id },
    select: { fromUnit: true, toUnit: true, factor: true },
  });
  const dashboard = await loadInventoryDashboard(
    auth.tenant.id,
    branchId > 0 ? branchId : null,
    conversions.map((row) => ({ fromUnit: row.fromUnit, toUnit: row.toUnit, factor: Number(row.factor) })),
  );
  return NextResponse.json({ dashboard: serialize(dashboard) });
}
