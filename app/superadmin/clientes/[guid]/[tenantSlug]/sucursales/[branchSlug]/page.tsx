import { notFound, redirect } from "next/navigation";
import { BranchDetail, type BranchDetailData } from "@/components/platform/branch-detail";
import { requireSuperAdmin } from "@/lib/auth";
import { serialize } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { branchUserUsage } from "@/lib/license";
import { platformBranchPath } from "@/lib/routes";

/**
 * @summary Carga el detalle operativo de una sucursal desde Platform por GUID (URL canónica).
 */
export default async function PlatformBranchDetailPage({
  params,
}: {
  params: Promise<{ guid: string; tenantSlug: string; branchSlug: string }>;
}) {
  await requireSuperAdmin();
  const [guid, tenantSlug, branchSlug] = await Promise.all([
    (await params).guid,
    (await params).tenantSlug,
    (await params).branchSlug,
  ]);
  const tenant = await prisma.tenant.findUnique({
    where: { publicGuid: guid.trim().toLocaleLowerCase("es") },
    select: { id: true, name: true, slug: true, status: true, publicGuid: true },
  });
  if (!tenant) notFound();
  if (tenant.slug !== tenantSlug.trim().toLocaleLowerCase("es")) {
    redirect(platformBranchPath(tenant.publicGuid, tenant.slug, branchSlug));
  }

  const branch = await prisma.branch.findFirst({
    where: { tenantId: tenant.id, slug: branchSlug.trim().toLocaleLowerCase("es") },
    include: {
      licenses: {
        include: { plan: { select: { id: true, name: true, slug: true, capacity: true } } },
        orderBy: { id: "desc" },
      },
      membershipAccess: {
        include: {
          membership: {
            include: {
              user: { select: { name: true, email: true } },
              role: { select: { name: true, key: true } },
            },
          },
        },
        orderBy: { id: "asc" },
      },
      _count: { select: { orders: true, inventoryStocks: true, reservations: true } },
      auditLogs: { orderBy: { createdAt: "desc" }, take: 30 },
    },
  });
  if (!branch) notFound();

  const [plans, userUsage] = await Promise.all([
    prisma.plan.findMany({
      where: { active: true },
      select: { id: true, name: true },
      orderBy: { displayOrder: "asc" },
    }),
    branchUserUsage(tenant.id, branch.id),
  ]);

  return (
    <BranchDetail
      data={
        serialize({
          tenant,
          branch: { ...branch, userUsage },
        }) as unknown as BranchDetailData
      }
      plans={plans}
    />
  );
}