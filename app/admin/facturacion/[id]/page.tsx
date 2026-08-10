import { notFound } from "next/navigation";
import { PrintButton } from "@/components/admin/print-button";
import { requirePermission } from "@/lib/auth";
import { money } from "@/lib/format";
import { prisma } from "@/lib/prisma";

/** @summary Presenta un comprobante interno imprimible y aislado al tenant autenticado. */
export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const context = await requirePermission("order.manage");
  const id = Number((await params).id);
  const invoice = await prisma.invoiceRecord.findFirst({
    where: { id, tenantId: context.tenant.id },
    include: { branch: true, order: { include: { items: true } } },
  });
  if (!invoice) notFound();
  return (
    <main className="mx-auto max-w-3xl rounded-2xl bg-white p-8 text-zinc-950 print:max-w-none print:rounded-none">
      <header className="flex justify-between gap-8 border-b border-zinc-200 pb-6">
        <div>
          <p className="text-sm font-black uppercase tracking-widest">Comprobante interno no fiscal</p>
          <h1 className="mt-2 text-3xl font-black">{invoice.number}</h1>
        </div>
        <div className="text-right">
          <strong>{context.tenant.name}</strong>
          <p className="text-sm text-zinc-500">{invoice.branch?.address}</p>
        </div>
      </header>
      <section className="grid gap-4 border-b border-zinc-200 py-6 sm:grid-cols-2">
        <div>
          <p className="text-xs uppercase text-zinc-500">Cliente</p>
          <strong>{invoice.customerName}</strong>
          <p>{invoice.customerTaxId}</p>
        </div>
        <div>
          <p className="text-xs uppercase text-zinc-500">Pedido</p>
          <strong>{invoice.order.reference}</strong>
          <p>{invoice.createdAt.toLocaleString("es-AR")}</p>
        </div>
      </section>
      <table className="my-6 w-full text-left">
        <thead>
          <tr className="border-b border-zinc-200">
            <th className="py-2">Producto</th>
            <th>Cant.</th>
            <th className="text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {invoice.order.items.map((item) => (
            <tr className="border-b border-zinc-100" key={item.id}>
              <td className="py-3">
                {item.productName}
                {item.variantName ? ` · ${item.variantName}` : ""}
              </td>
              <td>{item.quantity}</td>
              <td className="text-right">{money(item.lineTotal, invoice.currency)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="ml-auto max-w-xs space-y-2">
        <p className="flex justify-between">
          <span>Subtotal</span>
          <strong>{money(invoice.subtotal, invoice.currency)}</strong>
        </p>
        <p className="flex justify-between text-xl">
          <span>Total</span>
          <strong>{money(invoice.total, invoice.currency)}</strong>
        </p>
      </div>
      <footer className="mt-10 flex items-center justify-between gap-4 border-t border-zinc-200 pt-6">
        <p className="text-xs text-zinc-500">Documento operativo. No válido como comprobante fiscal.</p>
        <PrintButton />
      </footer>
    </main>
  );
}
