import { prisma } from "@/lib/prisma";

/**
 * @summary Recupera la última ubicación conocida de cada repartidor dentro de
 * las sucursales autorizadas, sin exponer posiciones de otros tenants o sedes.
 */
export async function listLatestDriverPositions(
  tenantId: number,
  accessibleBranchIds: number[],
  branchId?: number | null,
) {
  const scopedBranchIds = branchId ? [branchId] : accessibleBranchIds;
  if (scopedBranchIds.length === 0) return [];

  const positions = await prisma.driverPosition.findMany({
    where: {
      tenantId,
      driverProfile: { active: true },
      OR: [
        { branchId: { in: scopedBranchIds } },
        { delivery: { branchId: { in: scopedBranchIds } } },
      ],
    },
    select: {
      id: true,
      branchId: true,
      deliveryId: true,
      driverProfileId: true,
      latitude: true,
      longitude: true,
      accuracy: true,
      recordedAt: true,
      driverProfile: {
        select: {
          id: true,
          name: true,
          status: true,
          user: { select: { imageUrl: true } },
        },
      },
    },
    orderBy: { recordedAt: "desc" },
    take: 1000,
  });

  const latest = new Map<number, (typeof positions)[number]>();
  for (const position of positions) {
    if (position.driverProfileId && !latest.has(position.driverProfileId)) {
      latest.set(position.driverProfileId, position);
    }
  }
  return [...latest.values()];
}
