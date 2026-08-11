"use client";

import { useMemo, useState } from "react";
import Swal from "sweetalert2";
import { AdminPageHeader } from "@/components/admin/admin-page-header";

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

/** @summary Permite buscar clientes frecuentes y registrar ajustes manuales de puntos. */
export function CustomerManager({ initialCustomers }: { initialCustomers: LoyaltyCustomerData[] }) {
  const [customers, setCustomers] = useState(initialCustomers);
  const [query, setQuery] = useState("");
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
    const response = await fetch(`/api/admin/customers/${customer.id}`, {
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
        <input
          className="input mt-5 max-w-md"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          type="search"
          placeholder="Buscar nombre, email o teléfono"
        />
      </AdminPageHeader>
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
            <button className="btn btn-secondary mt-4 w-full" onClick={() => adjust(customer)}>
              Ajustar puntos
            </button>
          </article>
        ))}
        {!visible.length && (
          <p className="card p-10 text-center text-zinc-500">No hay clientes con esos datos.</p>
        )}
      </div>
    </section>
  );
}
