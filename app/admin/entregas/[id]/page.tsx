import { notFound } from "next/navigation";
import Link from "next/link";
import { PrintButton } from "@/components/admin/print-button";
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
import { deliveryStatusMeta } from "@/lib/delivery-drivers";
import { prisma } from "@/lib/prisma";
import { adminHrefForContext } from "@/lib/routes";
import { formatMoney } from "@/lib/helpers";

/** @summary Presenta la ficha de un remito/entrega con sus líneas despachadas y documentos relacionados. */
export default async function DeliveryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const context = await requirePermission("order.manage");
  const id = Number((await params).id);
  const delivery = await prisma.orderDelivery.findFirst({
    where: {
      id,
      tenantId: context.tenant.id,
      ...(context.activeBranchId && context.activeBranchId > 0 ? { branchId: context.activeBranchId } : {}),
    },
    include: {
      items: true,
      order: { select: { id: true, reference: true, status: true, orderType: true, currency: true, total: true } },
      branch: { select: { name: true } },
      customer: { select: { id: true, name: true, email: true, phone: true } },
      driverProfile: { select: { name: true } },
      createdBy: { select: { name: true } },
      invoices: { select: { id: true, number: true, status: true } },
      payments: { select: { id: true, number: true, amount: true, method: true, status: true } },
    },
  });
  if (!delivery) notFound();

  const activeBranch = context.branches.find((branch) => branch.id === context.activeBranchId);
  const adminHref = (href: string) =>
    adminHrefForContext(context.tenant.slug, href, activeBranch?.slug, context.tenant.publicGuid);

  const status = deliveryStatusMeta(delivery.status);
  const order = delivery.order;
  const currency = order?.currency ?? "ARS";
  const statusTone =
    delivery.status === "DELIVERED"
      ? ("success" as const)
      : delivery.status === "FAILED" || delivery.status === "CANCELLED" || delivery.status === "reversed"
        ? ("danger" as const)
        : delivery.status === "INCIDENT"
          ? ("warning" as const)
          : ("info" as const);

  return (
    <main className="mx-auto min-w-0 max-w-6xl p-4 sm:p-8 print:max-w-none print:p-0">
      <div className="print:hidden">
        <PageHeader
          eyebrow="Remitos y entregas"
          title="Remito"
          description="Documento histórico de lo efectivamente despachado, con su pedido origen y vínculo a factura y pagos."
          section="entregas"
          actions={
            <>
              <Link
                className="btn btn-secondary flex items-center gap-1"
                href={adminHref(`/admin/pedidos?id=${delivery.orderId}`)}
              >
                <Icon name="arrow-left" className="h-4 w-4" />
                Volver al pedido
              </Link>
              <Link className="btn btn-secondary" href={adminHref("/admin/entregas")}>
                Lista de remitos
              </Link>
              <PrintButton />
            </>
          }
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-6">
          <DocumentHeader
            reference={`Remito ${delivery.number}`}
            title={delivery.customerName}
            status={<StatusBadge status={status.label} tone={statusTone} />}
          >
            <dl className="mt-4 grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <dt className="text-xs text-zinc-500">Fecha</dt>
                <dd className="font-semibold text-zinc-200">
                  {delivery.deliveryDate.toLocaleString("es-AR")}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500">Sucursal</dt>
                <dd className="font-semibold text-zinc-200">{delivery.branch?.name ?? "Consolidado"}</dd>
              </div>
              {delivery.driverProfile && (
                <div>
                  <dt className="text-xs text-zinc-500">Repartidor</dt>
                  <dd className="font-semibold text-zinc-200">{delivery.driverProfile.name}</dd>
                </div>
              )}
              <div>
                <dt className="text-xs text-zinc-500">Pedido origen</dt>
                <dd className="font-semibold text-zinc-200">
                  <Link
                    className="text-[var(--admin-primary-strong)] hover:underline"
                    href={adminHref(`/admin/pedidos?id=${delivery.orderId}`)}
                  >
                    {order?.reference ?? `#${delivery.orderId}`}
                  </Link>
                </dd>
              </div>
              {delivery.reversedAt && (
                <div>
                  <dt className="text-xs text-zinc-500">Anulado</dt>
                  <dd className="font-semibold text-red-300">{delivery.reversedAt.toLocaleString("es-AR")}</dd>
                </div>
              )}
              {delivery.notes && (
                <div className="sm:col-span-2 lg:col-span-3">
                  <dt className="text-xs text-zinc-500">Notas</dt>
                  <dd className="font-normal text-zinc-300">{delivery.notes}</dd>
                </div>
              )}
            </dl>
          </DocumentHeader>

          <section>
            <SectionHeader
              title="Líneas del remito"
              description={`${delivery.items.reduce((sum, line) => sum + line.quantityDelivered, 0)} unidades despachadas en ${delivery.items.length} líneas.`}
            />
            <div className="mt-3">
              <DocumentLines headers={["Producto", "Cantidad despachada", "P. unitario", "Importe"]}>
                {delivery.items.map((line) => (
                  <tr key={line.id}>
                    <td className="px-4 py-2 text-sm text-zinc-200">
                      {line.productName}
                      {line.notes && <span className="ml-1 text-xs italic text-zinc-600">{line.notes}</span>}
                    </td>
                    <td className="px-4 py-2 text-right text-sm font-semibold tabular-nums text-zinc-200">
                      x{line.quantityDelivered}
                    </td>
                    <td className="px-4 py-2 text-right text-sm tabular-nums text-zinc-400">
                      {formatMoney(Number(line.unitPrice), currency)}
                    </td>
                    <td className="px-4 py-2 text-right text-sm tabular-nums text-zinc-400">
                      {formatMoney(Number(line.unitPrice) * line.quantityDelivered, currency)}
                    </td>
                  </tr>
                ))}
              </DocumentLines>
            </div>
          </section>

          {delivery.payments.length > 0 && (
            <section>
              <SectionHeader title="Pagos" description="Cobros registrados contra este remito." />
              <div className="mt-3">
                <DocumentLines headers={["Nº", "Método", "Importe", "Estado"]}>
                  {delivery.payments.map((payment) => (
                    <tr key={payment.id}>
                      <td className="px-4 py-2 text-sm text-zinc-200">{payment.number}</td>
                      <td className="px-4 py-2 text-sm text-zinc-400">{payment.method}</td>
                      <td className="px-4 py-2 text-right text-sm font-semibold tabular-nums text-zinc-200">
                        {formatMoney(Number(payment.amount), currency)}
                      </td>
                      <td className="px-4 py-2 text-right text-sm text-zinc-400">{payment.status}</td>
                    </tr>
                  ))}
                </DocumentLines>
              </div>
            </section>
          )}
        </div>

        <aside className="space-y-6">
          <FactBox title="Cliente">
            <p className="text-sm font-semibold text-white">{delivery.customerName}</p>
            {delivery.customer?.phone && <p className="text-xs text-zinc-500">{delivery.customer.phone}</p>}
            {delivery.customer?.email && (
              <p className="text-xs text-zinc-500">{delivery.customer.email}</p>
            )}
            {delivery.deliveryAddress && (
              <p className="mt-2 text-xs text-zinc-400">Entrega: {delivery.deliveryAddress}</p>
            )}
            {delivery.contactPhone && (
              <p className="text-xs text-zinc-500">Contacto: {delivery.contactPhone}</p>
            )}
          </FactBox>

          <FactBox title="Pedido origen">
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-zinc-500">Referencia</dt>
                <dd className="font-semibold text-zinc-200">{order?.reference ?? "—"}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-zinc-500">Estado</dt>
                <dd className="font-semibold text-zinc-200">{order?.status ?? "—"}</dd>
              </div>
              {order && (
                <div className="flex justify-between">
                  <dt className="text-zinc-500">Total</dt>
                  <dd className="font-semibold tabular-nums text-zinc-200">
                    {formatMoney(Number(order.total), currency)}
                  </dd>
                </div>
              )}
              {delivery.createdBy && (
                <div className="flex justify-between">
                  <dt className="text-zinc-500">Creado por</dt>
                  <dd className="font-semibold text-zinc-200">{delivery.createdBy.name}</dd>
                </div>
              )}
            </dl>
          </FactBox>

          <RelatedDocuments
            title="Documentos relacionados"
            items={[
              {
                href: adminHref(`/admin/pedidos?id=${delivery.orderId}`),
                label: "Pedido",
                count: 1,
              },
              {
                href: adminHref(`/admin/entregas?orderId=${delivery.orderId}`),
                label: "Remitos del pedido",
              },
              ...delivery.invoices.map((invoice) => ({
                href: adminHref(`/admin/facturacion/${invoice.id}`),
                label: `Comprobante ${invoice.number ?? `#${invoice.id}`}`,
                count: 1,
                tone: (invoice.status === "cancelled" ? "danger" : "success") as "danger" | "success",
              })),
              {
                href: adminHref(
                  delivery.customer?.id
                    ? `/admin/cobros?customerId=${delivery.customer.id}`
                    : "/admin/cobros",
                ),
                label: "Pagos y cuenta corriente",
              },
            ]}
          />
        </aside>
      </div>
    </main>
  );
}