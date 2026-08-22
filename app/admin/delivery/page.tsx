import { DeliveryCenter } from "@/components/admin/delivery-center";
import { requirePermission } from "@/lib/auth";
import { serialize } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { deliveryDetailInclude } from "@/lib/delivery-detail";
import { listLatestDriverPositions } from "@/lib/delivery-positions";
import { tenantDriverGuidPath } from "@/lib/routes";

export const dynamic = "force-dynamic";

/** @summary Ordena grupos de acceso sin inventar relaciones de supervisión inexistentes. */
function hierarchyPriority(key: string) {
  const normalized = key.toLocaleLowerCase("es");
  if (normalized.includes("admin") || normalized.includes("owner")) return 0;
  if (normalized.includes("manager") || normalized.includes("gerente")) return 1;
  if (normalized.includes("employee") || normalized.includes("empleado")) return 2;
  if (normalized.includes("driver") || normalized.includes("repart")) return 3;
  return 2;
}

/** @summary Centro de delivery: cola de entregas, repartidores activos y detalle. */
export default async function AdminDeliveryPage() {
  const context = await requirePermission("order.manage");
  const accessibleBranchIds = context.branches.map((branch) => branch.id);
  const canViewTeam = context.permissions.includes("user.manage");

  const [deliveries, branches, drivers, mapProvider, initialPositions, memberships] = await Promise.all([
    prisma.orderDelivery.findMany({
      where: {
        tenantId: context.tenant.id,
        branchId: { in: accessibleBranchIds },
        order: { is: { tenantId: context.tenant.id } },
      },
      include: deliveryDetailInclude,
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    prisma.branch.findMany({
      where: { tenantId: context.tenant.id, id: { in: accessibleBranchIds }, active: true },
      select: { id: true, name: true, slug: true, address: true, phone: true, latitude: true, longitude: true },
      orderBy: { name: "asc" },
    }),
    prisma.driverProfile.findMany({
      where: {
        tenantId: context.tenant.id,
        active: true,
        branches: { some: { branchId: { in: accessibleBranchIds }, tenantId: context.tenant.id } },
      },
      select: {
        id: true,
        name: true,
        phone: true,
        status: true,
        user: { select: { imageUrl: true } },
        branches: { select: { branchId: true } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.deliveryProviderConfig.findUnique({
      where: { tenantId_provider: { tenantId: context.tenant.id, provider: "openfreemap" } },
      select: { enabled: true },
    }),
    listLatestDriverPositions(context.tenant.id, accessibleBranchIds),
    canViewTeam
      ? prisma.tenantMembership.findMany({
          where: { tenantId: context.tenant.id, status: "active" },
          select: {
            id: true,
            role: { select: { key: true, name: true } },
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                imageUrl: true,
                driverProfiles: {
                  where: { tenantId: context.tenant.id, active: true },
                  select: { id: true, status: true },
                  take: 1,
                },
              },
            },
          },
          orderBy: [{ role: { name: "asc" } }, { user: { name: "asc" } }],
        })
      : Promise.resolve([]),
  ]);

  // OpenFreeMap es el default sin credenciales: solo una desactivación explícita lo oculta.
  const mapEnabled = mapProvider?.enabled ?? true;
  const hierarchy = memberships.reduce<
    Array<{
      key: string;
      name: string;
      members: Array<{
        id: number;
        name: string;
        email: string;
        imageUrl: string;
        driverProfile?: { id: number; status: string } | null;
      }>;
    }>
  >((groups, membership) => {
    let group = groups.find((item) => item.key === membership.role.key);
    if (!group) {
      group = { key: membership.role.key, name: membership.role.name, members: [] };
      groups.push(group);
    }
    group.members.push({
      id: membership.user.id,
      name: membership.user.name,
      email: membership.user.email,
      imageUrl: membership.user.imageUrl,
      driverProfile: membership.user.driverProfiles[0] ?? null,
    });
    return groups;
  }, []);
  hierarchy.sort((a, b) => hierarchyPriority(a.key) - hierarchyPriority(b.key) || a.name.localeCompare(b.name, "es"));

  return (
    <DeliveryCenter
      initialDeliveries={serialize(deliveries)}
      branches={branches.map((branch) => ({
        ...branch,
        latitude: branch.latitude?.toString() ?? null,
        longitude: branch.longitude?.toString() ?? null,
      }))}
      drivers={serialize(drivers)}
      mapEnabled={mapEnabled}
      initialPositions={serialize(initialPositions)}
      teamHierarchy={serialize(hierarchy)}
      canViewTeam={canViewTeam}
      canViewDrivers={context.permissions.includes("driver.view")}
      canConfigureDelivery={context.permissions.includes("business.manage")}
      driverPanelHref={
        tenantDriverGuidPath(context.tenant.publicGuid, context.tenant.slug)
      }
    />
  );
}
