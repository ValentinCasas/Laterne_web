import { DeliveryCenter } from "@/components/admin/delivery-center";
import { requirePermission } from "@/lib/auth";
import { serialize } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { deliveryDetailInclude } from "@/lib/delivery-detail";

export const dynamic = "force-dynamic";

/** @summary Centro de delivery: cola de entregas, repartidores activos y detalle. */
export default async function AdminDeliveryPage() {
  const context = await requirePermission("order.manage");
  const accessibleBranchIds = context.branches.map((branch) => branch.id);

  const [deliveries, branches, drivers] = await Promise.all([
    prisma.orderDelivery.findMany({
      where: { tenantId: context.tenant.id, branchId: { in: accessibleBranchIds } },
      include: deliveryDetailInclude,
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    prisma.branch.findMany({ where: { tenantId: context.tenant.id, active: true }, select: { id: true, name: true, slug: true } }),
    prisma.driverProfile.findMany({
      where: { tenantId: context.tenant.id, active: true },
      select: { id: true, name: true, phone: true, status: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const providerConfig = await prisma.deliveryProviderConfig.findMany({
    where: { tenantId: context.tenant.id, enabled: true },
    select: { provider: true, status: true },
  });
  const mapProviders = providerConfig.filter((config) => config.status === "active");

  return (
    <DeliveryCenter
      initialDeliveries={serialize(deliveries)}
      branches={serialize(branches)}
      drivers={serialize(drivers)}
      mapProviders={serialize(mapProviders)}
    />
  );
}