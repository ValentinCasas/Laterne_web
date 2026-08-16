"use client";

import { useMemo, useState } from "react";
import Swal from "sweetalert2";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { useViewMode, ViewModeToggle } from "@/components/admin/view-mode-toggle";
import { scopedFetch } from "@/lib/client-routing";
import { orderStatusLabel } from "@/lib/orders";

export type LoyaltyCustomerData = {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  birthday: string | null;
  points: number;
  tier: string;
  createdAt: string;
  _count: { orders: number; transactions: number };
};

type CustomerDetail = LoyaltyCustomerData & {
  orders: Array<{
    id: number;
    reference: string;
    status: string;
    orderType: string;
    total: string | number;
    currency: string;
    createdAt: string;
    branch: { name: string } | null;
  }>;
  transactions: Array<{
    id: number;
    points: number;
    reason: string;
    reference: string | null;
    createdAt: string;
  }>;
};

const modalityLabel: Record<string, string> = {
  takeaway: "Retiro",
  dine_in: "Mesa",
  delivery: "Delivery",
};

/** @summary Permite buscar clientes frecuentes, ver su ficha 360 y registrar ajustes manuales de puntos. */
export function CustomerManager({ initialCustomers }: { initialCustomers: LoyaltyCustomerData[] }) {
  const [customers, setCustomers] = useState(initialCustomers);
  const [query, setQuery] = useState("");
  const [detail, setDetail] = useState<CustomerDetail | null>(null);
  const [view, setView] = useViewMode("clientes-frecuentes");

  /** @summary Carga la ficha completa del cliente con sus pedidos y movimientos. */
  async function openDetail(customer: LoyaltyCustomerData) {
    const response = await scopedFetch(`/api/admin/customers/${customer.id}`);
    const body = (await response.json().catch(() => ({}))) as { customer?: CustomerDetail; error?: string };
    if (!response.ok || !body.customer) {
      await Swal.fire({
        title: "No se pudo abrir la ficha",
        text: body.error ?? "Intentá nuevamente.",
        icon: "error",
        background: "#18181b",
        color: "#fafafa",
      });
      return;
    }
    setDetail(body.customer);
  }
  const visible = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("es");
    return normalized
      ? customers.filter((customer) =>
          `${customer.name} ${customer.email ?? ""} ${customer.phone ?? ""}`
            .toLocaleLowerCase("es")
            .includes(normalized),
        )
      : customers;
  }, [customers, query]);

  /** @summary Solicita puntos y motivo, y actualiza el perfil después de validarlo en el servidor. */
  async function adjust(customer: LoyaltyCustomerData) {
    const result = await Swal.fire({
      title: `Ajustar puntos · ${customer.name}`,
      html: '<input id="points-value" class="swal2-input" type="number" placeholder="Ej. 20 o -10"><input id="points-reason" class="swal2-input" maxlength="220" placeholder="Motivo">',
      showCancelButton: true,
      confirmButtonText: "Guardar",
      cancelButtonText: "Cancelar",
      background: "#18181b",
      color: "#fafafa",
      preConfirm: () => ({
        points: Number((document.querySelector("#points-value") as HTMLInputElement).value),
        reason: (document.querySelector("#points-reason") as HTMLInputElement).value,
      }),
    });
    if (!result.isConfirmed || !result.value) return;
    const response = await scopedFetch(`/api/admin/customers/${customer.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(result.value),
    });
    const body = (await response.json().catch(() => ({}))) as {
      customer?: LoyaltyCustomerData;
      error?: string;
    };
    if (!response.ok || !body.customer) {
      await Swal.fire({
        title: "No se pudo ajustar",
        text: body.error ?? "Intentá nuevamente.",
        icon: "error",
        background: "#18181b",
        color: "#fafafa",
      });
      return;
    }
    setCustomers((current) =>
      current.map((item) => (item.id === customer.id ? { ...item, ...body.customer! } : item)),
    );
  }

  return (
    <section>
      <AdminPageHeader
        eyebrow="Fidelización"
        title="Clientes frecuentes"
        description="Perfiles consentidos, niveles, pedidos y movimientos de puntos."
        section="clientes-frecuentes"
      >
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <input
            className="input max-w-md flex-1"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            type="search"
            placeholder="Buscar nombre, email o teléfono"
          />
          <ViewModeToggle value={view} onChange={setView} />
        </div>
      </AdminPageHeader>
      {view === "cards" ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((customer) => (
            <article className="card p-5" key={customer.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-wider text-pink-300">
                    Nivel {customer.tier}
                  </p>
                  <h2 className="mt-1 text-xl font-black">{customer.name}</h2>
                  <p className="text-sm text-zinc-500">{customer.email || customer.phone}</p>
                </div>
                <strong className="text-3xl text-pink-300">{customer.points}</strong>
              </div>
              <div className="mt-4 flex gap-3 text-xs text-zinc-500">
                <span>{customer._count.orders} pedidos</span>
                <span>{customer._count.transactions} movimientos</span>
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <button className="btn btn-secondary w-full" onClick={() => void openDetail(customer)}>
                  Ver ficha 360
                </button>
                <button className="btn btn-secondary w-full" onClick={() => adjust(customer)}>
                  Ajustar puntos
                </button>
              </div>
            </article>
          ))}
          {!visible.length && (
            <p className="card p-10 text-center text-zinc-500">No hay clientes con esos datos.</p>
          )}
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-2xl border border-white/10 bg-white/[.02]">
          <div className="hidden grid-cols-[minmax(200px,1.4fr)_140px_120px_130px_auto_auto] gap-4 border-b border-white/10 px-5 py-3 text-xs font-black uppercase tracking-wider text-zinc-500 lg:grid">
            <span>Cliente</span>
            <span>Nivel</span>
            <span>Puntos</span>
            <span>Actividad</span>
            <span />
            <span />
          </div>
          <div className="divide-y divide-white/10">
            {visible.map((customer) => (
              <div
                className="grid gap-3 px-5 py-4 lg:grid-cols-[minmax(200px,1.4fr)_140px_120px_130px_auto_auto] lg:items-center"
                key={customer.id}
              >
                <div className="min-w-0">
                  <strong className="block truncate">{customer.name}</strong>
                  <p className="truncate text-sm text-zinc-500">{customer.email || customer.phone}</p>
                </div>
                <span className="rounded-full bg-white/5 px-2.5 py-1 text-xs font-black uppercase text-pink-300 w-fit">
                  {customer.tier}
                </span>
                <strong className="text-lg text-pink-300 tabular-nums">{customer.points}</strong>
                <span className="text-sm text-zinc-500">
                  {customer._count.orders} pedidos · {customer._count.transactions} mov.
                </span>
                <div className="flex gap-2">
                  <button
                    className="rounded-lg bg-white/5 px-3 py-1.5 text-xs font-bold hover:bg-white/10"
                    onClick={() => void openDetail(customer)}
                    type="button"
                  >
                    Ficha 360
                  </button>
                  <button
                    className="rounded-lg bg-white/5 px-3 py-1.5 text-xs font-bold hover:bg-white/10"
                    onClick={() => adjust(customer)}
                    type="button"
                  >
                    Ajustar puntos
                  </button>
                </div>
              </div>
            ))}
            {!visible.length && (
              <p className="p-10 text-center text-zinc-500">No hay clientes con esos datos.</p>
            )}
          </div>
        </div>
      )}

      {detail && (
        <div
          className="fixed inset-0 z-[100] grid place-items-center overflow-y-auto bg-black/85 p-4"
          onClick={() => setDetail(null)}
        >
          <article
            className="w-full max-w-3xl rounded-[2rem] border border-white/10 bg-zinc-950 p-6 sm:p-8"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="section-eyebrow">Ficha 360 · Nivel {detail.tier}</p>
                <h2 className="mt-1 text-3xl font-black">{detail.name}</h2>
                <p className="mt-1 text-sm text-zinc-500">
                  {detail.email ?? "Sin email"} · {detail.phone ?? "Sin teléfono"}
                  {detail.birthday ? ` · Cumple ${detail.birthday.slice(0, 10)}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="text-xs uppercase text-zinc-600">Puntos</p>
                  <strong className="text-3xl text-pink-300">{detail.points}</strong>
                </div>
                <button
                  className="grid h-10 w-10 place-items-center rounded-full bg-white/5 text-xl"
                  onClick={() => setDetail(null)}
                  type="button"
                  aria-label="Cerrar ficha"
                >
                  ×
                </button>
              </div>
            </div>

            <section className="mt-6">
              <h3 className="text-lg font-black">Pedidos recientes</h3>
              <div className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-1">
                {detail.orders.map((order) => (
                  <div
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white/[.03] p-3"
                    key={order.id}
                  >
                    <div>
                      <strong>{order.reference}</strong>
                      <p className="text-xs text-zinc-500">
                        {new Date(order.createdAt).toLocaleString("es-AR")} ·{" "}
                        {modalityLabel[order.orderType] ?? order.orderType}
                        {order.branch ? ` · ${order.branch.name}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-black tabular-nums">
                        {new Intl.NumberFormat("es-AR", {
                          style: "currency",
                          currency: order.currency,
                        }).format(Number(order.total))}
                      </span>
                      <span className="rounded-full bg-white/5 px-2 py-1 text-[10px] font-black uppercase">
                        {orderStatusLabel(order.status)}
                      </span>
                    </div>
                  </div>
                ))}
                {!detail.orders.length && <p className="text-sm text-zinc-500">Sin pedidos todavía.</p>}
              </div>
            </section>

            <section className="mt-6">
              <h3 className="text-lg font-black">Movimientos de puntos</h3>
              <div className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-1">
                {detail.transactions.map((movement) => (
                  <div
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white/[.03] p-3"
                    key={movement.id}
                  >
                    <div>
                      <strong>{movement.reason}</strong>
                      <p className="text-xs text-zinc-500">
                        {new Date(movement.createdAt).toLocaleString("es-AR")}
                        {movement.reference ? ` · ${movement.reference}` : ""}
                      </p>
                    </div>
                    <span
                      className={`text-sm font-black ${movement.points >= 0 ? "text-emerald-300" : "text-red-300"}`}
                    >
                      {movement.points >= 0 ? "+" : ""}
                      {movement.points}
                    </span>
                  </div>
                ))}
                {!detail.transactions.length && (
                  <p className="text-sm text-zinc-500">Sin movimientos todavía.</p>
                )}
              </div>
            </section>

            <div className="mt-6 flex flex-wrap gap-3">
              <button className="btn" onClick={() => void adjust(detail)} type="button">
                Ajustar puntos
              </button>
              {detail.phone && (
                <a
                  className="btn btn-secondary"
                  href={`https://wa.me/${detail.phone.replace(/\D/g, "")}?text=${encodeURIComponent(`Hola ${detail.name}, te escribimos por tu cuenta en MenuClick.`)}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  WhatsApp
                </a>
              )}
            </div>
          </article>
        </div>
      )}
    </section>
  );
}
