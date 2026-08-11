import { notFound } from "next/navigation";
import { ClientDetail, type ClientDetailData } from "@/components/superadmin/client-detail";
import { requireSuperAdmin } from "@/lib/auth";
import { serialize } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export default async function PlatformClientDetailPage({ params, searchParams }: { params: Promise<{ tenantId: string }>; searchParams: Promise<{ branchId?: string }> }) {
  await requireSuperAdmin();
  const id = Number((await params).tenantId); const branchId = Number((await searchParams).branchId);
  if (!Number.isInteger(id)) notFound();
  const tenant = await prisma.tenant.findUnique({ where: { id }, include: { brandSettings: { select: { customDomain: true } }, subscription: { include: { plan: { include: { features: { include: { feature: true }, orderBy: { displayOrder: "asc" } } } } } }, branches: { include: { _count: { select: { orders: true, membershipAccess: true, inventoryStocks: true } } }, orderBy: [{ isPrimary: "desc" }, { name: "asc" }] }, memberships: { include: { user: { select: { name: true, email: true } }, role: true, branchAccess: { include: { branch: { select: { id: true, name: true } } } } } }, platformPayments: { orderBy: { paidAt: "desc" } }, auditLogs: { orderBy: { createdAt: "desc" }, take: 40 }, _count: { select: { products: true, memberships: true, customerOrders: true, reservations: true, mediaAssets: true, errorLogs: true } } } });
  if (!tenant) notFound();
  const storage = await prisma.mediaAsset.aggregate({ where: { tenantId: id }, _sum: { sizeBytes: true } });
  return <ClientDetail data={serialize({ ...tenant, storageBytes: Number(storage._sum.sizeBytes ?? 0) }) as unknown as ClientDetailData} developmentOnly={process.env.NODE_ENV === "development"} selectedBranchId={Number.isInteger(branchId) ? branchId : undefined} />;
}
