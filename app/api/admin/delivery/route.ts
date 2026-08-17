import { NextResponse } from "next/server";
import { authorize } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/format";
import { deliveryDetailInclude } from "@/lib/delivery-detail";

/**
 * @summary Lista entregas con filtros por estado, sucursal, repartidor, canal y búsqueda.
 */
export async function GET(request: Request) {
  const auth = await authorize("order.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const url = new URL(request.url);
  const status = url.searchParams.get("status") || undefined;
  const branchId = url.searchParams.get("branchId") ? Number(url.searchParams.get("branchId")) : null;
  const driverId = url.searchParams.get("driverId") ? Number(url.searchParams.get("driverId")) : null;
  const driverProfileId = url.searchParams.get("driverProfileId")
    ? Number(url.searchParams.get("driverProfileId"))
    : null;
  const provider = url.searchParams.get("provider") || undefined;
  const q = url.searchParams.get("q") || undefined;
  const limit = Number(url.searchParams.get("limit") ?? 60);
  const offset = Number(url.searchParams.get("offset") ?? 0);

  const accessibleBranchIds = auth.branches.map((branch) => branch.id);
  const where: Record<string, unknown> = { tenantId: auth.tenant.id };
  if (status) where.status = status;
  if (branchId && accessibleBranchIds.includes(branchId)) where.branchId = branchId;
  if (!branchId && accessibleBranchIds.length > 0) where.branchId = { in: accessibleBranchIds };
  if (driverId) where.driverId = driverId;
  if (driverProfileId) where.driverProfileId = driverProfileId;
  if (provider) where.provider = provider;
  if (q) {
    where.OR = [
      { number: { contains: q } },
      { customerName: { contains: q } },
      { order: { reference: { contains: q } } },
      { externalOrderId: { contains: q } },
    ];
  }

  const [deliveries, total] = await Promise.all([
    prisma.orderDelivery.findMany({
      where,
      include: deliveryDetailInclude,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.orderDelivery.count({ where }),
  ]);

  return NextResponse.json({ items: serialize(deliveries), total, limit, offset });
}
