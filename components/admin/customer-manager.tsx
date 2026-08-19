"use client";

import { useMemo, useState } from "react";
import Swal from "sweetalert2";
import { PageHeader, SearchBox, StatusBadge, ActionMenu, EmptyState, Drawer, DataTable } from "@/components/admin/ui";
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

const tierTone: Record<string, "success" | "info" | "warning" | "default" | "danger"> = {
  diamante: "success",
  oro: "info",
  plata: "warning",
  inicial: "default",
};

/** @summary Permite buscar clientes frecuentes, ver su ficha 360 y registrar ajustes manuales de puntos. */
export function CustomerManager({ initialCustomers }: { initialCustomers: LoyaltyCustomerData[] }) {
  const [customers, setCustomers] = useState(initialCustomers);
  const [query, setQuery] = useState("");
  const [detail, setDetail] = useState<CustomerDetail | null>(null);
  const [view, setView] = useViewMode("clientes-frecuentes");
  const isCards = view === "cards" || view === "cards-compact";
  const compactCards = view === "cards-compact";

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
    <section className="space-y-6">
      <PageHeader
        eyebrow="Fidelización"
        title="Clientes frecuentes"
        description="Perfiles consentidos, niveles, pedidos y movimientos de puntos."
        section="clientes-frecuentes"
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <SearchBox value={query} onChange={setQuery} placeholder="Buscar nombre, email o teléfono" className="min-w-[220px] flex-1" />
            <ViewModeToggle value={view} onChange={setView} />
          </div>
        }
      />
      {isCards ? (
        <div className={`grid sm:grid-cols-2 xl:grid-cols-3 ${compactCards ? "gap-2.5" : "gap-4"}`}>
          {visible.map((customer) => (
            <article className={`card ${compactCards ? "p-3" : "p-5"}`} key={customer.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <StatusBadge status={customer.tier} tone={tierTone[customer.tier] ?? "default"} />
                  <h2 className={`mt-1 font-black ${compactCards ? "text-base" : "text-xl"}`}>{customer.name}</h2>
                  <p className="text-sm text-zinc-500">{customer.email || customer.phone}</p>
                </div>
                <strong className={`text-pink-300 ${compactCards ? "text-xl" : "text-3xl"}`}>{customer.points}</strong>
              </div>
              <div className="mt-4 flex gap-3 text-xs text-zinc-500">
                <span>{customer._count.orders} pedidos</span>
                <span>{customer._count.transactions} movimientos</span>
              </div>
              <div className={`grid gap-2 sm:grid-cols-2 ${compactCards ? "mt-3" : "mt-4"}`}>
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
            <EmptyState title="Sin clientes" description="No hay clientes con esos datos." />
          )}
        </div>
      ) : (
        <div className="shadow-xl shadow-black/10">
          <DataTable
            viewStorageKey="clientes-frecuentes"
            columns={[
              { key: "name", label: "Cliente" },
              { key: "tier", label: "Nivel" },
              { key: "points", label: "Puntos", align: "right" as const },
              { key: "activity", label: "Actividad" },
              { key: "actions", label: "", align: "right" as const },
            ]}
            data={visible.map((customer) => ({
              id: customer.id,
              name: (
                <div>
                  <strong className="block">{customer.name}</strong>
                  <p className="text-xs text-zinc-500">{customer.email || customer.phone}</p>
                </div>
              ),
              tier: <StatusBadge status={customer.tier} tone={tierTone[customer.tier] ?? "default"} />,
              points: <strong className="tabular-nums text-pink-300">{customer.points}</strong>,
              activity: `${customer._count.orders} pedidos · ${customer._count.transactions} mov.`,
              actions: (
                <ActionMenu
                  align="right"
                  items={[
                    { label: "Ver ficha 360", onClick: () => void openDetail(customer) },
                    { label: "Ajustar puntos", onClick: () => adjust(customer) },
                  ]}
                />
              ),
            }))}
            keyExtractor={(row) => row.id as number}
            emptyMessage="No hay clientes con esos datos."
            density="normal"
          />
        </div>
      )}

      <Drawer open={!!detail} onClose={() => setDetail(null)} title={detail ? `Ficha 360 · ${detail.name}` : ""} width="560px">
        {detail && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <StatusBadge status={detail.tier} tone={tierTone[detail.tier] ?? "default"} />
                <h3 className="mt-1 text-xl font-black">{detail.name}</h3>
                <p className="text-sm text-zinc-500">
                  {detail.email ?? "Sin email"} · {detail.phone ?? "Sin teléfono"}
                  {detail.birthday ? ` · Cumple ${detail.birthday.slice(0, 10)}` : ""}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs uppercase text-zinc-600">Puntos</p>
                <strong className="text-3xl text-pink-300">{detail.points}</strong>
              </div>
            </div>

            <section>
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

            <section>
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

            <div className="flex flex-wrap gap-3">
              <button className="btn" onClick={() => adjust(detail)} type="button">
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
          </div>
        )}
      </Drawer>
    </section>
  );
}
