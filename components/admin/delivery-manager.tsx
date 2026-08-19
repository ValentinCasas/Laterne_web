"use client";

import { useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import Swal from "sweetalert2";
import { PageHeader, StatusBadge, DataTable, EmptyState, SearchBox, ActionMenu, Drawer } from "@/components/admin/ui";
import { scopedFetch } from "@/lib/client-routing";
import { adminHrefFromPathname } from "@/lib/routes";
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
  const pathname = usePathname();
  const [deliveries, setDeliveries] = useState<OrderDeliveryData[]>(initialDeliveries);
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
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
    if (!form.orderId) {
      await Swal.fire({ title: "Datos incompletos", text: "Indicá el pedido.", icon: "warning", background: "#18181b", color: "#fafafa" });
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
      setDrawerOpen(false);
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
    await Swal.fire({ title: "Entrega anulada", text: "Las cantidades volvieron al pedido.", icon: "success", timer: 1500, showConfirmButton: false, background: "#18181b", color: "#fafafa" });
  }

  return (
    <section className="space-y-6">
      <PageHeader eyebrow="Remitos y entregas" title="Entregas confirmadas" description="Documento histórico por cada entrega generada desde tus pedidos." section="entregas" actions={
        <button type="button" className="btn" onClick={() => setDrawerOpen(true)}>
          Nueva entrega
        </button>
      } />

      <div className="flex flex-wrap items-center gap-3">
        <SearchBox value={query} onChange={setQuery} placeholder="Buscar por número, cliente o pedido…" className="min-w-[220px] flex-1" />
      </div>

      {visible.length === 0 ? (
        <EmptyState title="No hay entregas registradas" description="Las entregas que generes desde los pedidos aparecerán acá." />
      ) : (
        <div className="shadow-xl shadow-black/10">
          <DataTable
            viewStorageKey="entregas"
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
              if (!delivery) return null;
              return (
                <ActionMenu
                  align="right"
                  items={[
                    { label: "Ver remito", onClick: () => { window.location.href = adminHrefFromPathname(pathname, `/admin/entregas/${delivery.id}`); } },
                    ...(delivery.status !== "reversed" ? [{ label: "Anular", tone: "danger" as const, onClick: () => { void reverseDelivery(delivery); } }] : []),
                  ]}
                />
              );
            }}
          />
        </div>
      )}

      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title="Nueva entrega" width="520px">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-zinc-400 mb-1">Pedido</label>
            <select
              className="input w-full"
              value={form.orderId}
              onChange={(event) => setForm((current) => ({ ...current, orderId: Number(event.target.value) }))}
            >
              <option value="0">Pedido…</option>
              {Array.from(new Set(deliveries.map((delivery) => delivery.orderId))).map((oid) => {
                const ref = deliveries.find((d) => d.orderId === oid)?.order?.reference ?? `#${oid}`;
                return <option key={oid} value={oid}>{ref}</option>;
              })}
            </select>
          </div>
          <div>
            <label className="block text-sm font-bold text-zinc-400 mb-1">Tipo</label>
            <select
              className="input w-full"
              value={form.deliveryType}
              onChange={(event) => setForm((current) => ({ ...current, deliveryType: event.target.value as "full" | "partial" }))}
            >
              <option value="full">Completa</option>
              <option value="partial">Parcial</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-bold text-zinc-400 mb-1">Notas</label>
            <textarea
              className="input w-full"
              rows={3}
              value={form.notes}
              onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
            />
          </div>
          <button type="button" className="btn w-full" disabled={creating || !form.orderId} onClick={createDelivery}>
            {creating ? "Generando…" : "Generar entrega"}
          </button>
        </div>
      </Drawer>
    </section>
  );
}
