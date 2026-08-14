import Image from "next/image";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { PrintButton } from "@/components/admin/print-button";
import { requirePermission } from "@/lib/auth";
import { money } from "@/lib/format";
import { invoiceFontClass, resolveInvoiceDesign } from "@/lib/invoice-design";
import { prisma } from "@/lib/prisma";

/** @summary Presenta un comprobante interno imprimible aplicando el diseño configurado. */
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
  const issuerAddress = [issuerSettings?.address?.trim(), issuerSettings?.city?.trim()]
    .filter(Boolean)
    .join(", ");
  const accent = design.accent;
  let qrUrl = "";
  if (design.showQr) {
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
  }
  const order = invoice.order;
  const hasDiscount = Number(order.discount) > 0;
  const hasDelivery = Number(order.deliveryFee) > 0;
  return (
    <main
      className={`mx-auto max-w-3xl rounded-2xl bg-white p-8 text-zinc-950 print:max-w-none print:rounded-none ${invoiceFontClass[design.font]}`}
    >
      <header className={`flex justify-between gap-8 pb-6 ${design.preset === "modern" ? "border-transparent bg-teal-700 p-6 text-white" : "border-b border-zinc-200"}`}>
        <div>
          <p className="text-sm font-black uppercase tracking-widest" style={{ color: design.preset === "modern" ? "#ffffff" : accent }}>
            Comprobante interno no fiscal
          </p>
          <h1 className="mt-2 text-3xl font-black">{invoice.number}</h1>
        </div>
        <div className="flex items-start gap-4 text-right">
          <div>
            <strong>{issuerName}</strong>
            {design.showIssuerAddress && (
              <p className="text-sm text-zinc-500">{issuerAddress || invoice.branch?.address}</p>
            )}
            {design.showTaxId && issuerSettings?.taxId && (
              <p className="text-sm text-zinc-500">CUIT {issuerSettings.taxId}</p>
            )}
          </div>
          {design.showLogo && (
            <span
              className="grid h-12 w-12 shrink-0 place-items-center rounded-full text-sm font-black text-white"
              style={{ backgroundColor: accent }}
            >
              {issuerName.slice(0, 2).toUpperCase()}
            </span>
          )}
        </div>
      </header>
      {design.preset === "modern" && <div className="h-2" style={{ backgroundColor: accent }} />}

      <section className={`grid gap-4 py-6 sm:grid-cols-2 ${design.preset === "compact" ? "" : "border-b border-zinc-200"}`}>
        <div>
          <p className="text-xs uppercase text-zinc-500">Cliente</p>
          <strong>{invoice.customerName}</strong>
          {design.showTaxId && <p>{invoice.customerTaxId}</p>}
        </div>
        <div>
          <p className="text-xs uppercase text-zinc-500">Pedido</p>
          <strong>{invoice.order.reference}</strong>
          <p>{invoice.createdAt.toLocaleString("es-AR")}</p>
        </div>
      </section>

      {design.showColumns ? (
        <table className={`my-6 w-full text-left ${design.preset === "classic" ? "" : ""}`}>
          <thead>
            <tr className={`border-b ${design.preset === "modern" ? "text-white" : "border-zinc-200"} ${design.preset === "compact" ? "" : ""}`} style={design.preset === "modern" ? { backgroundColor: accent } : undefined}>
              <th className="py-2 pl-2">Producto</th>
              <th>Cant.</th>
              <th className="pr-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item) => (
              <tr className="border-b border-zinc-100" key={item.id}>
                <td className="py-3 pl-2">
                  {item.productName}
                  {item.variantName ? ` · ${item.variantName}` : ""}
                </td>
                <td>{item.quantity}</td>
                <td className="pr-2 text-right">{money(item.lineTotal, invoice.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <ul className="my-6 divide-y divide-zinc-100">
          {order.items.map((item) => (
            <li className="flex items-center justify-between gap-4 py-3" key={item.id}>
              <span>
                <strong>{item.productName}</strong>
                {item.variantName ? ` · ${item.variantName}` : ""}
                <span className="ml-2 text-sm text-zinc-500">× {item.quantity}</span>
              </span>
              <strong>{money(item.lineTotal, invoice.currency)}</strong>
            </li>
          ))}
        </ul>
      )}

      {design.showQr && qrUrl && (
        <div className="relative mb-6 ml-auto h-24 w-24 overflow-hidden rounded-lg border border-zinc-200">
          <Image src={qrUrl} alt="Código QR del comprobante" fill unoptimized className="object-contain p-1" />
        </div>
      )}

      <div className={`ml-auto max-w-xs space-y-2 ${design.preset === "classic" ? "border border-zinc-200 p-4" : ""}`}>
        {design.showSubtotal && (
          <p className="flex justify-between">
            <span>Subtotal</span>
            <strong>{money(invoice.subtotal, invoice.currency)}</strong>
          </p>
        )}
        {design.showDiscounts && hasDiscount && (
          <p className="flex justify-between">
            <span>Descuento</span>
            <strong>-{money(order.discount, invoice.currency)}</strong>
          </p>
        )}
        {design.showDelivery && hasDelivery && (
          <p className="flex justify-between">
            <span>Envío</span>
            <strong>{money(order.deliveryFee, invoice.currency)}</strong>
          </p>
        )}
        {design.showTotal && (
          <p className="flex justify-between text-xl">
            <span>Total</span>
            <strong style={{ color: accent }}>{money(invoice.total, invoice.currency)}</strong>
          </p>
        )}
      </div>

      {design.showNotes && invoice.notes && (
        <section className="mt-8 rounded-xl bg-zinc-50 p-4 text-sm">
          <p className="text-xs uppercase text-zinc-500">Observaciones</p>
          <p className="mt-1 whitespace-pre-wrap">{invoice.notes}</p>
        </section>
      )}

      {design.showFooter && (
        <footer
          className={`mt-10 whitespace-pre-wrap border-t border-zinc-200 pt-6 text-sm text-zinc-500 ${
            design.preset === "modern" ? "border-t-4" : ""
          }`}
          style={design.preset === "modern" ? { borderColor: accent } : undefined}
        >
          {design.footerText || issuerSettings?.terms || "Documento operativo. No válido como comprobante fiscal."}
        </footer>
      )}

      <footer className={`flex items-center justify-between gap-4 ${design.showFooter ? "mt-4" : "mt-10"} border-t border-zinc-200 pt-6`}>
        <p className="text-xs text-zinc-500">Documento operativo. No válido como comprobante fiscal.</p>
        <PrintButton />
      </footer>
    </main>
  );
}
