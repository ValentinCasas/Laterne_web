import {
  InvoiceManagerV2,
  type AvailableInvoiceOrder,
  type InvoiceListItem,
  type InvoiceSettingsData,
} from "@/components/admin/invoice-manager-v2";
import { requirePermission } from "@/lib/auth";
import { serialize } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** @summary Carga comprobantes, pedidos disponibles y la configuración de emisor del negocio. */
export default async function InvoicesPage() {
  const context = await requirePermission("order.manage");
  const activeId = context.activeBranchId && context.activeBranchId > 0 ? context.activeBranchId : null;
  const branchScope = activeId ? { branchId: activeId } : { branchId: { in: context.branches.map((branch) => branch.id) } };
  const [invoices, orders, issuerSettings] = await Promise.all([
    prisma.invoiceRecord.findMany({
      where: { tenantId: context.tenant.id, ...branchScope },
      include: {
        order: true,
        branch: true,
        document: { select: { pdfStatus: true, conversionMessage: true, templateVersion: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 300,
    }),
    prisma.customerOrder.findMany({
      where: { tenantId: context.tenant.id, invoice: null, ...branchScope },
      select: { id: true, reference: true, customerName: true, total: true, currency: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.invoiceSettings.findUnique({ where: { tenantId: context.tenant.id } }),
  ]);
  return (
    <InvoiceManagerV2
      initialInvoices={serialize(invoices) as unknown as InvoiceListItem[]}
      availableOrders={serialize(orders) as unknown as AvailableInvoiceOrder[]}
      initialSettings={serialize(issuerSettings) as unknown as InvoiceSettingsData | null}
    />
  );
}
