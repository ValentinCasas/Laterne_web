"use client";

import { useMemo, useState } from "react";
import Swal from "sweetalert2";
import { PageHeader, StatusBadge, DataTable, EmptyState } from "@/components/admin/ui";
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

const statusLabel: Record<string, string> = {
  delivered: "Entregado",
  reversed: "Anulado",
};

const DELIVERY_COLUMNS = [
  { key: "number", label: "Nº" },
  { key: "deliveryDate", label: "Fecha", align: "right" as const, hideOnMobile: true },
  { key: "order", label: "Pedido", hideOnMobile: true },
  { key: "customerName", label: "Cliente" },
  { key: "branch", label: "Sucursal", hideOnMobile: true },
  { key: "status", label: "Estado", align: "right" as const },
  { key: "itemsCount", label: "Productos", align: "right" as const, hideOnMobile: true },
];

/** @summary Gestor visual de remitos/entregas con tabla filtrable, opciones de vista y acciones operativas. */
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
    <section className="space-y-6">
      <PageHeader eyebrow="Remitos y entregas" title="Entregas confirmadas" description="Documento histórico por cada entrega generada desde tus pedidos." section="entregas" />

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <input
            type="search"
            placeholder="Buscar por número, cliente o pedido…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 pl-9 text-sm text-zinc-300 outline-none transition-colors placeholder:text-zinc-500 focus:border-pink-500/50 focus:bg-white/10"
          />
          <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-zinc-500">🔎</span>
        </div>
        <select
          className="input w-auto"
          value={form.orderId}
          onChange={(event) => setForm((current) => ({ ...current, orderId: Number(event.target.value) }))}
        >
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

      {visible.length === 0 ? (
        <EmptyState title="No hay entregas registradas" description="Las entregas que generes desde los pedidos aparecerán acá." />
      ) : (
        <DataTable
          columns={DELIVERY_COLUMNS}
          data={visible.map((delivery) => ({
            id: delivery.id,
            number: delivery.number,
            deliveryDate: new Date(delivery.deliveryDate).toLocaleString("es-AR"),
            order: delivery.order?.reference ?? `#${delivery.orderId}`,
            customerName: delivery.customerName,
            branch: delivery.branch?.name ?? "—",
            status: <StatusBadge status={statusLabel[delivery.status] ?? delivery.status} tone={delivery.status === "delivered" ? "success" : "danger"} />,
            itemsCount: delivery.items.reduce((sum, item) => sum + item.quantityDelivered, 0),
          }))}
          keyExtractor={(row) => row.id as number}
          emptyMessage="No hay entregas registradas."
          rowActions={(row) => {
            const delivery = visible.find((d) => d.id === row.id as number);
            if (!delivery || delivery.status === "reversed") return null;
            return (
              <button type="button" className="btn btn-secondary" onClick={() => reverseDelivery(delivery)}>
                Anular
              </button>
            );
          }}
        />
      )}
    </section>
  );
}
