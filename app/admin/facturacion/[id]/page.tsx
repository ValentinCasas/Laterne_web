import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { PrintButton } from "@/components/admin/print-button";
import { InvoiceRenderer, type InvoiceRenderData } from "@/components/invoice/invoice-renderer";
import { requirePermission } from "@/lib/auth";
import { resolveInvoiceDesign } from "@/lib/invoice-design";
import { prisma } from "@/lib/prisma";

/** @summary Convierte el JSON de extras de una línea en texto legible. */
function extrasText(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    const parts = value
      .map((entry) => {
        if (typeof entry === "string") return entry;
        if (entry && typeof entry === "object" && typeof (entry as { name?: unknown }).name === "string") {
          return (entry as { name: string }).name;
        }
        return null;
      })
      .filter((entry): entry is string => typeof entry === "string");
    return parts.length ? parts.join(", ") : null;
  }
  return null;
}

/** @summary Presenta un comprobante interno imprimible con el renderizador compartido del diseñador. */
export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const context = await requirePermission("order.manage");
  const id = Number((await params).id);
  const [invoice, issuerSettings] = await Promise.all([
    prisma.invoiceRecord.findFirst({
      where: { id, tenantId: context.tenant.id },
      include: { branch: true, order: { include: { items: true } } },
    }),
    prisma.invoiceSettings.findUnique({ where: { tenantId: context.tenant.id } }),
  ]);
  if (!invoice) notFound();
  const design = resolveInvoiceDesign(issuerSettings?.design);
  const issuerName = issuerSettings?.issuerName?.trim() || context.tenant.name;
  let qrUrl = "";
  try {
    qrUrl = await QRCode.toDataURL(`${invoice.number ?? invoice.order.reference}`, {
      width: 240,
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#18181b", light: "#ffffff" },
    });
  } catch {
    qrUrl = "";
  }
  const order = invoice.order;
  const data: InvoiceRenderData = {
    issuerName,
    taxId: issuerSettings?.taxId ?? null,
    address: issuerSettings?.address ?? null,
    city: issuerSettings?.city ?? null,
    number: invoice.number ?? "",
    customerName: invoice.customerName,
    customerTaxId: invoice.customerTaxId,
    orderReference: order.reference,
    orderDate: invoice.createdAt.toLocaleString("es-AR"),
    items: order.items.map((item) => ({
      productName: item.productName,
      variantName: item.variantName,
      extras: extrasText(item.extras),
      quantity: item.quantity,
      unitPrice: item.quantity > 0 ? Number(item.lineTotal) / item.quantity : 0,
      total: Number(item.lineTotal),
    })),
    currency: invoice.currency,
    subtotal: Number(invoice.subtotal),
    discount: Number(order.discount),
    deliveryFee: Number(order.deliveryFee),
    total: Number(invoice.total),
    notes: invoice.notes,
    terms: issuerSettings?.terms,
    qrUrl: qrUrl || null,
  };

  return (
    <main className="mx-auto max-w-[740px] p-6 sm:p-10 print:max-w-none print:p-0">
      <InvoiceRenderer design={design} data={data} />
      <footer className="mt-8 flex justify-end print:hidden">
        <PrintButton />
      </footer>
    </main>
  );
}