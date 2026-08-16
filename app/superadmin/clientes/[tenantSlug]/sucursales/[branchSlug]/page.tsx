import { notFound } from "next/navigation";
import { BranchDetail, type BranchDetailData } from "@/components/platform/branch-detail";
import { requireSuperAdmin } from "@/lib/auth";
import { serialize } from "@/lib/format";
import { prisma } from "@/lib/prisma";

/**
 * @summary Carga el detalle operativo de una sucursal desde la plataforma.
 */
export default async function PlatformBranchDetailPage({
  params,
}: {
  params: Promise<{ tenantSlug: string; branchSlug: string }>;
}) {
  await requireSuperAdmin();
  const [tenantSlug, branchSlug] = await Promise.all([(await params).tenantSlug, (await params).branchSlug]);
  const tenant = await prisma.tenant.findUnique({
    where: { slug: tenantSlug.trim().toLocaleLowerCase("es") },
    select: { id: true, name: true, slug: true, status: true },
  });
  if (!tenant) notFound();

  const branch = await prisma.branch.findFirst({
    where: { tenantId: tenant.id, slug: branchSlug.trim().toLocaleLowerCase("es") },
    include: {
      licenses: {
        include: { plan: { select: { id: true, name: true, slug: true } } },
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

  const plans = await prisma.plan.findMany({
    where: { active: true },
    select: { id: true, name: true },
    orderBy: { displayOrder: "asc" },
  });

  return <BranchDetail data={serialize({ tenant, branch }) as unknown as BranchDetailData} plans={plans} />;
}
