import { notFound, redirect } from "next/navigation";
import { ClientDetail, type ClientDetailData } from "@/components/platform/client-detail";
import { requireSuperAdmin } from "@/lib/auth";
import { serialize } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { LicenseAssignment } from "@/components/platform/license-assignment";
import { sumBranchAllowedUsers, effectiveLicenseStatus } from "@/lib/license";
import { platformClientPath } from "@/lib/routes";

/**
 * @summary Carga el detalle integral de un cliente por su GUID público (URL canónica de Platform).
 */
export default async function PlatformClientDetailPage({
  params,
}: {
  params: Promise<{ guid: string; tenantSlug: string }>;
}) {
  await requireSuperAdmin();
  const [guid, slug] = await Promise.all([(await params).guid, (await params).tenantSlug]);
  const tenant = await prisma.tenant.findUnique({
    where: { publicGuid: guid.trim().toLocaleLowerCase("es") },
    include: {
      brandSettings: { select: { customDomain: true } },
      activePalette: { select: { name: true, presetKey: true, baseMode: true } },
      subscription: {
        include: {
          plan: { include: { features: { include: { feature: true }, orderBy: { displayOrder: "asc" } } } },
        },
      },
      branches: {
        include: {
          licenses: {
            select: {
              status: true,
              planId: true,
              plan: { select: { id: true, name: true, capacity: true } },
              currentPeriodEnd: true,
              graceUntil: true,
              usersAllowed: true,
              priceOverride: true,
              pricePerUser: true,
              notes: true,
            },
            orderBy: { id: "asc" },
          },
          _count: { select: { orders: true, membershipAccess: true, inventoryStocks: true } },
        },
        orderBy: [{ isPrimary: "desc" }, { name: "asc" }],
      },
      memberships: {
        include: {
          user: { select: { name: true, email: true } },
          role: true,
          branchAccess: { include: { branch: { select: { id: true, name: true } } } },
        },
      },
      platformPayments: { orderBy: { paidAt: "desc" } },
      auditLogs: { orderBy: { createdAt: "desc" }, take: 40 },
      _count: {
        select: {
          products: true,
          memberships: true,
          customerOrders: true,
          reservations: true,
          mediaAssets: true,
          errorLogs: true,
        },
      },
    },
  });
  if (!tenant) notFound();
  if (tenant.slug !== slug.trim().toLocaleLowerCase("es")) {
    redirect(platformClientPath(tenant.publicGuid, tenant.slug));
  }

  const [storage, plans, allBranchesMembers, accessRows] = await Promise.all([
    prisma.mediaAsset.aggregate({ where: { tenantId: tenant.id }, _sum: { sizeBytes: true } }),
    prisma.plan.findMany({
      where: { active: true },
      select: { id: true, name: true },
      orderBy: { displayOrder: "asc" },
    }),
    prisma.tenantMembership.count({
      where: { tenantId: tenant.id, status: "active", role: { key: { not: "owner" } }, allBranches: true },
    }),
    prisma.branchMembership.groupBy({
      by: ["branchId"],
      where: {
        membership: { tenantId: tenant.id, status: "active", role: { key: { not: "owner" } } },
      },
      _count: true,
    }),
  ]);
  const usedByBranch = new Map(accessRows.map((row) => [row.branchId, row._count]));
  const now = new Date();
  const branches = tenant.branches.map((branch) => {
    const allowed = sumBranchAllowedUsers(
      branch.licenses.filter((license) => effectiveLicenseStatus(license, now) === "ACTIVE"),
    );
    const used = (usedByBranch.get(branch.id) ?? 0) + allBranchesMembers;
    return { ...branch, userUsage: { allowed, used } };
  });

  return (
    <>
      <ClientDetail
        data={
          serialize({
            ...tenant,
            branches,
            storageBytes: Number(storage._sum.sizeBytes ?? 0),
          }) as unknown as ClientDetailData
        }
        developmentOnly={process.env.NODE_ENV === "development"}
        selectedBranchId={undefined}
        plans={plans}
      />
      <div className="mx-auto mt-6 w-full max-w-[1440px] rounded-2xl border border-white/10 bg-[#151a24] px-5 py-4 text-sm text-slate-300">
        Paleta activa:{" "}
        <strong className="text-amber-200">{tenant.activePalette?.name ?? "Sin paleta asignada"}</strong>
        {tenant.activePalette?.presetKey && (
          <span className="ml-2 text-slate-500">({tenant.activePalette.presetKey})</span>
        )}
      </div>
      <LicenseAssignment
        tenantId={tenant.id}
        plans={plans}
        currentPlanId={tenant.subscription?.planId ?? null}
        currentStatus={tenant.subscription?.status ?? "ACTIVE"}
        currentEndsAt={tenant.subscription?.endsAt?.toISOString() ?? null}
      />
    </>
  );
}