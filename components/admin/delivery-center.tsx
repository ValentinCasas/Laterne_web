"use client";

import { useMemo, useState } from "react";
import Swal from "sweetalert2";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { scopedFetch } from "@/lib/client-routing";

type Delivery = {
  id: number;
  number: string;
  status: string;
  provider: string;
  externalOrderId?: string | null;
  deliveryType: string;
  deliveryDate: Date | string;
  createdAt: Date | string;
  customerName: string;
  deliveryAddress?: string | null;
  contactPhone?: string | null;
  contactName?: string | null;
  instructions?: string | null;
  receiverName?: string | null;
  latitude?: string | null;
  longitude?: string | null;
  assignedAt?: Date | string | null;
  pickedUpAt?: Date | string | null;
  deliveredAt?: Date | string | null;
  driver?: { id: number; name: string } | null;
  branch?: { id: number; name: string } | null;
  order?: {
    id: number;
    reference: string;
    status: string;
    orderType: string;
    channel: string;
    source: string;
    total: string | number | object;
    customerName: string;
  } | null;
  items: Array<{ id: number; productName: string; quantityDelivered: number; unitPrice: string | number | object }>;
};

type Branch = { id: number; name: string; slug: string };
type Driver = { id: number; name: string; email?: string };

type DeliveryCenterProps = {
  initialDeliveries: Delivery[];
  branches: Branch[];
  drivers: Driver[];
  mapProviders: Array<{ provider: string }>;
};

type DeliveryStatus = "PENDING_ASSIGNMENT" | "ASSIGNED" | "PICKED_UP" | "ON_THE_WAY" | "DELIVERED" | "FAILED" | "CANCELLED";

const STATUS_LABELS: Record<DeliveryStatus, string> = {
  PENDING_ASSIGNMENT: "Pendiente asignación",
  ASSIGNED: "Asignado",
  PICKED_UP: "Retirado",
  ON_THE_WAY: "En camino",
  DELIVERED: "Entregado",
  FAILED: "Fallido",
  CANCELLED: "Cancelado",
};

const STATUS_COLORS: Record<string, string> = {
  PENDING_ASSIGNMENT: "bg-amber-500/15 text-amber-300",
  ASSIGNED: "bg-sky-500/15 text-sky-300",
  PICKED_UP: "bg-indigo-500/15 text-indigo-300",
  ON_THE_WAY: "bg-violet-500/15 text-violet-300",
  DELIVERED: "bg-emerald-500/15 text-emerald-300",
  FAILED: "bg-red-500/15 text-red-300",
  CANCELLED: "bg-zinc-500/15 text-zinc-300",
};

function statusColor(status: string) {
  return STATUS_COLORS[status] ?? "bg-zinc-500/15 text-zinc-300";
}

function statusLabel(status: string) {
  return STATUS_LABELS[status as DeliveryStatus] ?? status;
}

/** @summary Centro de delivery con lista, mapa abstracto y detalle de entregas. */
export function DeliveryCenter({ initialDeliveries, branches, drivers, mapProviders }: DeliveryCenterProps) {
  const [deliveries, setDeliveries] = useState<Delivery[]>(initialDeliveries);
  const [filterStatus, setFilterStatus] = useState("");
  const [filterBranch, setFilterBranch] = useState("");
  const [filterDriver, setFilterDriver] = useState("");
  const [filterQ, setFilterQ] = useState("");
  const [selected, setSelected] = useState<Delivery | null>(null);
  const [saving, setSaving] = useState(false);

  const hasMap = mapProviders.length > 0;

  const visible = useMemo(() => {
    const q = filterQ.trim().toLocaleLowerCase("es");
    return deliveries.filter((d) => {
      if (filterStatus && d.status !== filterStatus) return false;
      if (filterBranch && d.branch?.id !== Number(filterBranch)) return false;
      if (filterDriver && d.driver?.id !== Number(filterDriver)) return false;
      if (!q) return true;
      return [d.number, d.customerName, d.order?.reference, d.externalOrderId, d.deliveryAddress]
        .filter(Boolean)
        .some((value) => value!.toLocaleLowerCase("es").includes(q));
    });
  }, [deliveries, filterStatus, filterBranch, filterDriver, filterQ]);

  async function assignDriver(deliveryId: number, driverId: number) {
    setSaving(true);
    try {
      const response = await scopedFetch(`/api/admin/deliveries/${deliveryId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "ASSIGNED", driverId }),
      });
      const body = (await response.json().catch(() => ({}))) as { delivery?: Delivery; error?: string };
      if (!response.ok || !body.delivery) {
        await Swal.fire({ title: "No se pudo asignar", text: body.error ?? "Intentá nuevamente.", icon: "error", background: "#18181b", color: "#fafafa" });
        return;
      }
      setDeliveries((current) => current.map((d) => (d.id === deliveryId ? body.delivery! : d)));
      setSelected((current) => (current?.id === deliveryId ? body.delivery! : current));
      await Swal.fire({ title: "Repartidor asignado", icon: "success", timer: 1500, showConfirmButton: false, background: "#18181b", color: "#fafafa" });
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(deliveryId: number, status: DeliveryStatus) {
    setSaving(true);
    try {
      const response = await scopedFetch(`/api/admin/deliveries/${deliveryId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const body = (await response.json().catch(() => ({}))) as { delivery?: Delivery; error?: string };
      if (!response.ok || !body.delivery) {
        await Swal.fire({ title: "No se pudo actualizar", text: body.error ?? "Intentá nuevamente.", icon: "error", background: "#18181b", color: "#fafafa" });
        return;
      }
      setDeliveries((current) => current.map((d) => (d.id === deliveryId ? body.delivery! : d)));
      setSelected((current) => (current?.id === deliveryId ? body.delivery! : current));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section>
      <AdminPageHeader eyebrow="Delivery" title="Centro de delivery" description="Seguimiento de entregas, repartidores y estado de pedidos." section="delivery" />
      {!hasMap && (
        <div className="card mt-4 border border-amber-500/20 bg-amber-500/[0.04] p-4 text-sm text-amber-200">
          Configurá un proveedor de mapas para habilitar la vista geográfica. La lista de entregas sigue funcionando sin mapa.
        </div>
      )}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <select className="input w-auto" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} aria-label="Filtrar por estado">
          <option value="">Todos los estados</option>
          {Object.entries(STATUS_LABELS).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
        <select className="input w-auto" value={filterBranch} onChange={(e) => setFilterBranch(e.target.value)} aria-label="Filtrar por sucursal">
          <option value="">Todas las sucursales</option>
          {branches.map((branch) => (
            <option key={branch.id} value={String(branch.id)}>{branch.name}</option>
          ))}
        </select>
        <select className="input w-auto" value={filterDriver} onChange={(e) => setFilterDriver(e.target.value)} aria-label="Filtrar por repartidor">
          <option value="">Todos los repartidores</option>
          {drivers.map((driver) => (
            <option key={driver.id} value={String(driver.id)}>{driver.name}</option>
          ))}
        </select>
        <input className="input max-w-xs flex-1" placeholder="Buscar por número, pedido o cliente…" value={filterQ} onChange={(e) => setFilterQ(e.target.value)} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <div className="space-y-2">
          {visible.length === 0 && <p className="p-6 text-center text-[var(--admin-muted)]">Sin entregas.</p>}
          {visible.map((delivery) => (
            <button
              key={delivery.id}
              className={`w-full rounded-2xl border p-4 text-left transition hover:bg-white/[.03] ${selected?.id === delivery.id ? "border-pink-500/40 bg-pink-500/[.04]" : "border-white/10 bg-white/[.02]"}`}
              onClick={() => setSelected(delivery)}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${statusColor(delivery.status)}`}>{statusLabel(delivery.status)}</span>
                <span className="text-xs text-[var(--admin-muted)]">{delivery.number}</span>
                <span className="text-xs text-[var(--admin-muted)]">{delivery.provider}</span>
              </div>
              <p className="mt-1 text-sm font-bold text-white">{delivery.customerName}</p>
              <p className="text-xs text-[var(--admin-muted)]">{delivery.order?.reference ?? "—"} · {delivery.branch?.name ?? "—"}</p>
              {delivery.driver && <p className="text-xs text-[var(--admin-muted)]">Repartidor: {delivery.driver.name}</p>}
            </button>
          ))}
        </div>

        <div>
          {selected ? (
            <div className="space-y-4">
              <div className="rounded-2xl border border-white/10 bg-white/[.02] p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-lg font-black">{selected.number}</h3>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${statusColor(selected.status)}`}>{statusLabel(selected.status)}</span>
              </div>
                <p className="mt-1 text-sm text-[var(--admin-muted)]">{selected.customerName} · {selected.order?.reference ?? "—"}</p>
                <p className="text-sm text-[var(--admin-muted)]">{selected.deliveryAddress}</p>
                <p className="text-sm text-[var(--admin-muted)]">{selected.contactPhone} · {selected.contactName}</p>
                {selected.instructions && <p className="text-xs text-[var(--admin-muted)]">Instrucciones: {selected.instructions}</p>}
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                  <div><span className="text-[var(--admin-muted)]">Lat:</span> {selected.latitude ?? "—"}</div>
                  <div><span className="text-[var(--admin-muted)]">Lng:</span> {selected.longitude ?? "—"}</div>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[.02] p-4">
                <p className="text-xs font-black uppercase tracking-widest text-[var(--admin-muted)]">Repartidor</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <select className="input w-auto" defaultValue={selected.driver?.id ? String(selected.driver.id) : ""} onChange={(e) => { const val = e.target.value; if (!val) return; assignDriver(selected.id, Number(val)); }} aria-label="Asignar repartidor">
                    <option value="">Asignar repartidor…</option>
                    {drivers.map((driver) => (
                      <option key={driver.id} value={String(driver.id)}>{driver.name}</option>
                    ))}
                  </select>
                  {selected.driver && <span className="text-sm text-white">{selected.driver.name}</span>}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[.02] p-4">
                <p className="text-xs font-black uppercase tracking-widest text-[var(--admin-muted)]">Estado</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(Object.keys(STATUS_LABELS) as DeliveryStatus[]).map((status) => (
                    <button
                      key={status}
                      type="button"
                      className={`btn btn-secondary text-xs ${selected.status === status ? "btn-primary" : ""}`}
                      onClick={() => updateStatus(selected.id, status)}
                      disabled={saving}
                    >
                      {STATUS_LABELS[status]}
                    </button>
                  ))}
                </div>
              </div>

              {hasMap && selected.latitude && selected.longitude && (
                <div className="rounded-2xl border border-white/10 bg-white/[.02] p-4">
                  <p className="text-xs font-black uppercase tracking-widest text-[var(--admin-muted)]">Ubicación</p>
                  <p className="mt-1 text-sm text-white">Lat: {selected.latitude} · Lng: {selected.longitude}</p>
                </div>
              )}

              <div className="rounded-2xl border border-white/10 bg-white/[.02] p-4">
                <p className="text-xs font-black uppercase tracking-widest text-[var(--admin-muted)]">Items</p>
                <div className="mt-2 space-y-1">
                  {selected.items.map((item) => (
                    <div key={item.id} className="flex justify-between text-sm">
                      <span>{item.productName}</span>
                      <span className="tabular-nums text-[var(--admin-muted)]">x{item.quantityDelivered}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-white/10 p-10 text-center text-[var(--admin-muted)]">
              Seleccioná una entrega para ver el detalle.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
