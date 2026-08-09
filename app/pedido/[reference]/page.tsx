import Link from "next/link";
import { notFound } from "next/navigation";
import { orderStatusLabel, orderTokenHash, whatsappPhone } from "@/lib/orders";
import { prisma } from "@/lib/prisma";
import { getDefaultTenant } from "@/lib/tenant";

type OrderTrackingProps = {
  params: Promise<{ reference: string }>;
  searchParams: Promise<{ token?: string }>;
};

const flow = ["received", "confirmed", "preparing", "ready", "on_the_way", "delivered"];

/** @summary Formatea importes almacenados para la pantalla privada de seguimiento. */
function formatPrice(value: number, currency: string) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency }).format(value);
}

/** @summary Muestra el detalle y avance de un pedido únicamente a quien posee su token privado. */
export default async function OrderTrackingPage({ params, searchParams }: OrderTrackingProps) {
  const [{ reference }, { token }] = await Promise.all([params, searchParams]);
  if (!token) notFound();
  const tenant = await getDefaultTenant();
  const [order, business] = await Promise.all([
    prisma.customerOrder.findFirst({
      where: { tenantId: tenant.id, reference, publicTokenHash: orderTokenHash(token) },
      include: { table: true, items: true, history: { orderBy: { createdAt: "asc" } } },
    }),
    prisma.businessInfo.findUnique({ where: { tenantId: tenant.id } }),
  ]);
  if (!order) notFound();
  const currentIndex = flow.indexOf(order.status);
  const message = `Hola, consulto por el pedido ${order.reference}.`;

  return (
    <main className="shell py-10 sm:py-16">
      <section className="mx-auto max-w-4xl overflow-hidden rounded-[2rem] border border-white/10 bg-zinc-950 shadow-2xl">
        <header className="bg-[radial-gradient(circle_at_top_right,rgba(236,72,153,.3),transparent_45%)] p-6 sm:p-10">
          <p className="section-eyebrow">Pedido {order.reference}</p>
          <h1 className="mt-3 text-4xl font-black sm:text-6xl">{orderStatusLabel(order.status)}</h1>
          <p className="mt-3 text-zinc-400">
            Hola, {order.customerName}. Guardá este enlace para volver cuando quieras.
          </p>
        </header>

        {order.status === "cancelled" ? (
          <div className="border-y border-red-500/20 bg-red-500/10 p-5 text-red-200">
            El pedido fue cancelado. Contactá al local si necesitás más información.
          </div>
        ) : (
          <ol
            className="grid gap-2 border-y border-white/10 p-5 sm:grid-cols-6 sm:p-8"
            aria-label="Progreso del pedido"
          >
            {flow.map((status, index) => (
              <li className={index <= currentIndex ? "text-pink-300" : "text-zinc-600"} key={status}>
                <span
                  className={`mb-2 block h-2 rounded-full ${index <= currentIndex ? "bg-pink-500" : "bg-white/10"}`}
                />
                <span className="text-xs font-bold">{orderStatusLabel(status)}</span>
              </li>
            ))}
          </ol>
        )}

        <div className="grid gap-8 p-6 sm:p-10 lg:grid-cols-[1fr_280px]">
          <div>
            <h2 className="text-2xl font-black">Detalle</h2>
            <div className="mt-4 space-y-3">
              {order.items.map((item) => (
                <article className="flex justify-between gap-4 rounded-2xl bg-white/5 p-4" key={item.id}>
                  <div>
                    <h3 className="font-bold">
                      {item.quantity} × {item.productName}
                    </h3>
                    {item.variantName && <p className="text-sm text-zinc-400">{item.variantName}</p>}
                    {Array.isArray(item.extras) && item.extras.length > 0 && (
                      <p className="text-sm text-zinc-500">Con agregados seleccionados</p>
                    )}
                    {item.notes && <p className="mt-1 text-sm text-zinc-500">“{item.notes}”</p>}
                  </div>
                  <strong>{formatPrice(Number(item.lineTotal), order.currency)}</strong>
                </article>
              ))}
            </div>
          </div>
          <aside className="h-fit rounded-2xl border border-white/10 p-5">
            {order.table && (
              <p className="mb-3 text-sm text-zinc-400">
                Mesa: <strong className="text-white">{order.table.name}</strong>
              </p>
            )}
            <div className="flex justify-between text-sm text-zinc-400">
              <span>Subtotal</span>
              <span>{formatPrice(Number(order.subtotal), order.currency)}</span>
            </div>
            {Number(order.discount) > 0 && (
              <div className="mt-2 flex justify-between text-sm text-emerald-300">
                <span>Descuento</span>
                <span>− {formatPrice(Number(order.discount), order.currency)}</span>
              </div>
            )}
            <div className="mt-4 flex justify-between border-t border-white/10 pt-4 text-xl font-black">
              <span>Total</span>
              <span>{formatPrice(Number(order.total), order.currency)}</span>
            </div>
            <p className="mt-4 text-xs text-zinc-500">
              Última actualización: {order.updatedAt.toLocaleString("es-AR")}
            </p>
            <div className="mt-5 grid gap-2">
              {business?.phoneNumber && (
                <a
                  className="btn w-full"
                  href={`https://wa.me/${whatsappPhone(String(business.phoneNumber))}?text=${encodeURIComponent(message)}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Consultar por WhatsApp
                </a>
              )}
              <Link className="btn btn-secondary w-full" href="/carta">
                Volver a la carta
              </Link>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}
