import { notFound } from "next/navigation";
import Link from "next/link";
import QRCode from "qrcode";
import { PrintButton } from "@/components/admin/print-button";
import { InvoiceDocumentPreview } from "@/components/admin/invoice-document-preview";
import { InvoiceRenderer, type InvoiceRenderData } from "@/components/invoice-renderer";
import {
  DocumentHeader,
  DocumentLines,
  FactBox,
  PageHeader,
  RelatedDocuments,
  SectionHeader,
  StatusBadge,
} from "@/components/admin/ui";
import { Icon } from "@/components/admin/ui/icons";
import { requirePermission } from "@/lib/auth";
import { resolveInvoiceDesign } from "@/lib/invoice-design";
import { prisma } from "@/lib/prisma";
import { adminHrefForContext } from "@/lib/routes";

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

/** @summary Estado legible del comprobante en la interfaz. */
const invoiceStatusLabel: Record<string, string> = {
  draft: "Borrador",
  issued: "Emitido",
  cancelled: "Anulado",
};

function invoiceStatusTone(status: string): "default" | "info" | "success" | "warning" | "danger" {
  if (status === "issued") return "success";
  if (status === "cancelled") return "danger";
  return "warning";
}

/** @summary Formatea un importe con la moneda del comprobante. */
function formatMoney(value: number | string, currency: string) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency }).format(Number(value));
}

/** @summary Presenta la ficha de un comprobante con líneas snapshot, documentos relacionados e impresión. */
export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const context = await requirePermission("order.manage");
  const id = Number((await params).id);
  const [invoice, issuerSettings] = await Promise.all([
    prisma.invoiceRecord.findFirst({
      where: {
        id,
        tenantId: context.tenant.id,
        ...(context.activeBranchId && context.activeBranchId > 0 ? { branchId: context.activeBranchId } : {}),
      },
      include: {
        branch: true,
        order: { include: { items: true } },
        delivery: { select: { id: true, number: true, status: true } },
        items: true,
        document: true,
      },
    }),
    prisma.invoiceSettings.findUnique({ where: { tenantId: context.tenant.id } }),
  ]);
  if (!invoice) notFound();

  const activeBranch = context.branches.find((branch) => branch.id === context.activeBranchId);
  const adminHref = (href: string) =>
    adminHrefForContext(context.tenant.slug, href, activeBranch?.slug, context.tenant.publicGuid);

  const lines = invoice.items.length
    ? invoice.items
    : invoice.order.items.map((item) => ({
        id: item.id,
        orderItemId: item.id,
        productName: item.productName,
        variantName: item.variantName,
        extras: item.extras,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        extrasTotal: item.extrasTotal,
        notes: item.notes,
        lineTotal: item.lineTotal,
        costSnapshot: item.costSnapshot,
      }));

  let documentPreview: React.ReactNode = null;
  if (invoice.document) {
    documentPreview = (
      <InvoiceDocumentPreview
        invoiceId={invoice.id}
        number={invoice.number ?? `Comprobante ${invoice.id}`}
        pdfStatus={invoice.document.pdfStatus}
        conversionMessage={invoice.document.conversionMessage}
      />
    );
  } else {
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
    documentPreview = (
      <div className="rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 print:border-0 print:bg-transparent print:p-0">
        <div className="max-w-full overflow-x-auto">
          <div className="invoice-legacy-preview min-w-[680px] origin-top-left sm:min-w-0">
            <InvoiceRenderer design={design} data={data} />
          </div>
        </div>
      </div>
    );
  }

  const status = invoiceStatusLabel[invoice.status] ?? invoice.status;

  return (
    <main className="mx-auto min-w-0 max-w-6xl p-4 sm:p-8 print:max-w-none print:p-0">
      <div className="print:hidden">
        <PageHeader
          eyebrow="Facturación"
          title="Comprobante"
          description="Documento comercial con líneas snapshot históricas, vinculado a su pedido y remitos."
          section="facturacion"
          actions={
            <>
              <Link
                className="btn btn-secondary flex items-center gap-1"
                href={adminHref(`/admin/pedidos?id=${invoice.orderId}`)}
              >
                <Icon name="arrow-left" className="h-4 w-4" />
                Volver al pedido
              </Link>
              {invoice.delivery && (
                <Link
                  className="btn btn-secondary flex items-center gap-1"
                  href={adminHref(`/admin/entregas/${invoice.delivery.id}`)}
                >
                  <Icon name="arrow-left" className="h-4 w-4" />
                  Volver al remito
                </Link>
              )}
              <PrintButton />
            </>
          }
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-6">
          <DocumentHeader
            reference={invoice.number ?? `Comprobante ${invoice.id}`}
            title={invoice.customerName}
            status={<StatusBadge status={status} tone={invoiceStatusTone(invoice.status)} />}
          >
            <dl className="mt-4 grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <dt className="text-xs text-zinc-500">Fecha</dt>
                <dd className="font-semibold text-zinc-200">
                  {invoice.issuedAt
                    ? invoice.issuedAt.toLocaleString("es-AR")
                    : invoice.createdAt.toLocaleString("es-AR")}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500">Sucursal</dt>
                <dd className="font-semibold text-zinc-200">{invoice.branch?.name ?? "Consolidado"}</dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500">Pedido</dt>
                <dd className="font-semibold text-zinc-200">
                  <Link
                    className="text-[var(--admin-primary-strong)] hover:underline"
                    href={adminHref(`/admin/pedidos?id=${invoice.orderId}`)}
                  >
                    {invoice.order.reference}
                  </Link>
                </dd>
              </div>
              {invoice.delivery && (
                <div>
                  <dt className="text-xs text-zinc-500">Remito origen</dt>
                  <dd className="font-semibold text-zinc-200">
                    <Link
                      className="text-[var(--admin-primary-strong)] hover:underline"
                      href={adminHref(`/admin/entregas/${invoice.delivery.id}`)}
                    >
                      {invoice.delivery.number}
                    </Link>
                  </dd>
                </div>
              )}
              {invoice.customerTaxId && (
                <div>
                  <dt className="text-xs text-zinc-500">Documento / CUIT</dt>
                  <dd className="font-semibold text-zinc-200">{invoice.customerTaxId}</dd>
                </div>
              )}
            </dl>
          </DocumentHeader>

          <section>
            <SectionHeader
              title="Líneas del comprobante"
              description={`${lines.reduce((sum, line) => sum + line.quantity, 0)} productos en este documento.`}
            />
            <div className="mt-3">
              <DocumentLines headers={["Producto", "Cantidad", "P. unitario", "Importe"]}>
                {lines.map((line) => {
                  const extras = extrasText(line.extras);
                  return (
                    <tr key={line.id}>
                      <td className="px-4 py-2 text-sm text-zinc-200">
                        {line.productName}
                        {line.variantName && (
                          <span className="ml-1 text-xs text-zinc-500">· {line.variantName}</span>
                        )}
                        {extras && <span className="ml-1 text-xs text-zinc-500">+ {extras}</span>}
                        {line.notes && <span className="ml-1 text-xs italic text-zinc-600">{line.notes}</span>}
                      </td>
                      <td className="px-4 py-2 text-right text-sm tabular-nums text-zinc-400">
                        x{line.quantity}
                      </td>
                      <td className="px-4 py-2 text-right text-sm tabular-nums text-zinc-400">
                        {formatMoney(Number(line.unitPrice), invoice.currency)}
                      </td>
                      <td className="px-4 py-2 text-right text-sm font-semibold tabular-nums text-zinc-200">
                        {formatMoney(Number(line.lineTotal), invoice.currency)}
                      </td>
                    </tr>
                  );
                })}
              </DocumentLines>
            </div>
          </section>

          <section className="rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5">
            <SectionHeader title="Totales" description="Importes del comprobante." />
            <dl className="mt-4 max-w-sm space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-zinc-500">Subtotal</dt>
                <dd className="tabular-nums text-zinc-200">{formatMoney(Number(invoice.subtotal), invoice.currency)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-zinc-500">Impuestos</dt>
                <dd className="tabular-nums text-zinc-200">{formatMoney(Number(invoice.tax), invoice.currency)}</dd>
              </div>
              <div className="flex justify-between border-t border-white/10 pt-3 text-base">
                <dt className="font-black">Total</dt>
                <dd className="font-black tabular-nums">{formatMoney(Number(invoice.total), invoice.currency)}</dd>
              </div>
            </dl>
          </section>
        </div>

        <aside className="space-y-6">
          <FactBox title="Pedido origen">
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-zinc-500">Referencia</dt>
                <dd className="font-semibold text-zinc-200">{invoice.order.reference}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-zinc-500">Estado</dt>
                <dd className="font-semibold text-zinc-200">{invoice.order.status}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-zinc-500">Total</dt>
                <dd className="font-semibold tabular-nums text-zinc-200">
                  {formatMoney(Number(invoice.order.total), invoice.currency)}
                </dd>
              </div>
            </dl>
          </FactBox>

          <RelatedDocuments
            title="Documentos relacionados"
            items={[
              {
                href: adminHref(`/admin/pedidos?id=${invoice.orderId}`),
                label: "Pedido",
                count: 1,
              },
              {
                href: adminHref(`/admin/entregas?orderId=${invoice.orderId}`),
                label: "Remitos y entregas",
              },
              {
                href: adminHref("/admin/cobros"),
                label: "Pagos y cuenta corriente",
              },
            ]}
          />

          {invoice.notes && (
            <div className="rounded-2xl border border-white/10 bg-white/[.02] p-4 text-sm text-zinc-300">
              <strong className="mr-2">Nota:</strong>
              {invoice.notes}
            </div>
          )}
        </aside>
      </div>

      <section className="mt-8 print:hidden">
        <SectionHeader title="Vista previa del documento" description="Tal como se imprime o se comparte." />
        <div className="mt-3">{documentPreview}</div>
      </section>
      <div className="hidden print:block">{documentPreview}</div>
    </main>
  );
}