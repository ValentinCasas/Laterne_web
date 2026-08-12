import { notFound } from "next/navigation";
import { ClientDetail, type ClientDetailData } from "@/components/platform/client-detail";
import { requireSuperAdmin } from "@/lib/auth";
import { serialize } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { LicenseAssignment } from "@/components/platform/license-assignment";

export default async function PlatformClientDetailPage({ params }: { params: Promise<{ tenantId: string }> }) {
  await requireSuperAdmin();
  const id = Number((await params).tenantId);
  if (!Number.isInteger(id)) notFound();
  const tenant = await prisma.tenant.findUnique({ where: { id }, include: { brandSettings: { select: { customDomain: true } }, activePalette: { select: { name: true, presetKey: true, baseMode: true } }, subscription: { include: { plan: { include: { features: { include: { feature: true }, orderBy: { displayOrder: "asc" } } } } } }, branches: { include: { licenses: { select: { status: true, planId: true, currentPeriodEnd: true, graceUntil: true } }, _count: { select: { orders: true, membershipAccess: true, inventoryStocks: true } } }, orderBy: [{ isPrimary: "desc" }, { name: "asc" }] }, memberships: { include: { user: { select: { name: true, email: true } }, role: true, branchAccess: { include: { branch: { select: { id: true, name: true } } } } } }, platformPayments: { orderBy: { paidAt: "desc" } }, auditLogs: { orderBy: { createdAt: "desc" }, take: 40 }, _count: { select: { products: true, memberships: true, customerOrders: true, reservations: true, mediaAssets: true, errorLogs: true } } } });
  if (!tenant) notFound();
  const [storage, plans] = await Promise.all([
    prisma.mediaAsset.aggregate({ where: { tenantId: id }, _sum: { sizeBytes: true } }),
    prisma.plan.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { displayOrder: "asc" } }),
  ]);
  return <><ClientDetail data={serialize({ ...tenant, storageBytes: Number(storage._sum.sizeBytes ?? 0) }) as unknown as ClientDetailData} developmentOnly={process.env.NODE_ENV === "development"} selectedBranchId={undefined} /><div className="mx-auto mt-6 w-full max-w-[1440px] rounded-2xl border border-white/10 bg-[#151a24] px-5 py-4 text-sm text-slate-300">Paleta activa: <strong className="text-amber-200">{tenant.activePalette?.name ?? "Sin paleta asignada"}</strong>{tenant.activePalette?.presetKey && <span className="ml-2 text-slate-500">({tenant.activePalette.presetKey})</span>}</div><LicenseAssignment tenantId={id} plans={plans} currentPlanId={tenant.subscription?.planId ?? null} currentStatus={tenant.subscription?.status ?? "ACTIVE"} currentEndsAt={tenant.subscription?.endsAt?.toISOString() ?? null} /></>;
}
