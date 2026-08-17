"use client";

import { useMemo, useState } from "react";
import Swal from "sweetalert2";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { scopedFetch } from "@/lib/client-routing";
import type { OrderDeliveryData } from "@/lib/delivery-types";

type DeliveryManagerProps = {
  initialDeliveries: OrderDeliveryData[];
  orderId?: number;
};

export type { OrderDeliveryData };

type DeliveryForm = {
  orderId: number;
  deliveryType: "full" | "partial";
  notes: string;
  items: Array<{ orderItemId: number; quantityDelivered: number; notes: string }>;
};

const statusStyle: Record<string, string> = {
  delivered: "border-emerald-500/30 bg-emerald-500/5",
  reversed: "border-red-500/30 bg-red-500/5",
};

const statusBadge: Record<string, string> = {
  delivered: "bg-emerald-500/15 text-emerald-300",
  reversed: "bg-red-500/15 text-red-300",
};

/** @summary Gestor visual de remitos/entregas con filtros y acciones operativas. */
export function DeliveryManager({ initialDeliveries, orderId }: DeliveryManagerProps) {
  const [deliveries, setDeliveries] = useState<OrderDeliveryData[]>(initialDeliveries);
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<DeliveryForm>({
    orderId: orderId ?? 0,
    deliveryType: "full",
    notes: "",
    items: [],
  });

  const visible = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("es");
    if (!normalized) return deliveries;
    return deliveries.filter((delivery) =>
      [delivery.number, delivery.customerName, delivery.order?.reference, delivery.branch?.name]
        .filter(Boolean)
        .some((value) => value!.toLocaleLowerCase("es").includes(normalized)),
    );
  }, [deliveries, query]);

  async function createDelivery() {
    if (!form.orderId || form.items.length === 0) {
      await Swal.fire({ title: "Datos incompletos", text: "Indicá el pedido y al menos una línea.", icon: "warning", background: "#18181b", color: "#fafafa" });
      return;
    }
    setCreating(true);
    try {
      const response = await scopedFetch(`/api/admin/orders/${form.orderId}/deliveries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deliveryType: form.deliveryType, notes: form.notes, items: form.items }),
      });
      const body = (await response.json().catch(() => ({}))) as { delivery?: OrderDeliveryData; error?: string };
      if (!response.ok || !body.delivery) {
        await Swal.fire({ title: "No se pudo generar la entrega", text: body.error ?? "Intentá nuevamente.", icon: "error", background: "#18181b", color: "#fafafa" });
        return;
      }
      const delivery = body.delivery;
      setDeliveries((current) => [delivery, ...current]);
      setForm((current) => ({ ...current, notes: "", items: [] }));
      await Swal.fire({ title: "Entrega generada", text: delivery.number, icon: "success", background: "#18181b", color: "#fafafa" });
    } finally {
      setCreating(false);
    }
  }

  async function reverseDelivery(delivery: OrderDeliveryData) {
    const confirmed = await Swal.fire({
      title: "¿Anular entrega?",
      text: `Se revertirán las cantidades de ${delivery.number} al pedido original.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Anular",
      cancelButtonText: "Cancelar",
      background: "#18181b",
      color: "#fafafa",
    });
    if (!confirmed.isConfirmed) return;
    const response = await scopedFetch(`/api/admin/deliveries/${delivery.id}/reverse`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note: "Anulación manual desde el panel" }),
    });
    const body = (await response.json().catch(() => ({}))) as { delivery?: OrderDeliveryData; error?: string };
    if (!response.ok || !body.delivery) {
      await Swal.fire({ title: "No se pudo anular", text: body.error ?? "Intentá nuevamente.", icon: "error", background: "#18181b", color: "#fafafa" });
      return;
    }
    setDeliveries((current) => current.map((item) => (item.id === delivery.id ? body.delivery! : item)));
    await Swal.fire({ title: "Entrega anulada", text: "Las cantidades volvieron al pedido.", icon: "success", background: "#18181b", color: "#fafafa" });
  }

  return (
    <section>
      <AdminPageHeader eyebrow="Remitos y entregas" title="Entregas confirmadas" description="Documento histórico por cada entrega generada desde tus pedidos." section="entregas" />
      <div className="card mt-6 space-y-4 p-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
          <input className="input" placeholder="Buscar por número, cliente o pedido…" value={query} onChange={(event) => setQuery(event.target.value)} />
          <select className="input w-auto" value={form.orderId} onChange={(event) => setForm((current) => ({ ...current, orderId: Number(event.target.value) }))}>
            <option value="0">Pedido…</option>
            {Array.from(new Set(deliveries.map((delivery) => delivery.orderId))).map((orderId) => {
              const ref = deliveries.find((d) => d.orderId === orderId)?.order?.reference ?? `#${orderId}`;
              return <option key={orderId} value={orderId}>{ref}</option>;
            })}
          </select>
          <button type="button" className="btn" disabled={creating || !form.orderId} onClick={createDelivery}>
            {creating ? "Generando…" : "Nueva entrega"}
          </button>
        </div>
      </div>

      <div className="mt-6 space-y-4">
        {visible.length === 0 && <p className="text-center text-[var(--admin-muted)]">No hay entregas registradas.</p>}
        {visible.map((delivery) => (
          <div key={delivery.id} className={`card overflow-hidden ${statusStyle[delivery.status] ?? ""}`}>
            <div className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <p className="text-sm font-black text-white">{delivery.number}</p>
                <p className="text-xs text-zinc-500">
                  {new Date(delivery.deliveryDate).toLocaleString("es-AR")} · {delivery.customerName} · {delivery.branch?.name ?? "—"}
                </p>
              </div>
              <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${statusBadge[delivery.status] ?? "bg-zinc-500/15 text-zinc-300"}`}>{delivery.status.toUpperCase()}</span>
            </div>
            <div className="border-t border-white/[.06] p-4">
              <div className="grid gap-2 sm:grid-cols-2">
                {delivery.items.map((item) => (
                  <div key={item.id} className="flex items-start gap-3 rounded-xl bg-white/[.03] p-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-white">{item.productName}</p>
                      <p className="text-xs text-zinc-500">Cantidad entregada: {item.quantityDelivered}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {delivery.status !== "reversed" && (
              <div className="border-t border-white/[.06] p-4">
                <button type="button" className="btn btn-secondary" onClick={() => reverseDelivery(delivery)}>
                  Anular entrega
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
